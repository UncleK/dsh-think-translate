import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { DEFAULT_HEADERS } from '../lib/transport.js'

const host = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
// Exercise the shipped internal functions without exposing browser internals or
// touching a user's DSH configuration. Boundaries deliberately fail on refactors.
function sourceBetween(source, from, to) {
  const start = source.indexOf(from)
  const end = source.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, 'source boundary missing: ' + from)
  return source.slice(start, end)
}

it('keeps installer curl arguments usable until the actual download step', async () => {
  let downloadReached = false
  const sandbox = vm.createContext({
    join, tmpdir: () => 'X:/unused', randomUUID: () => 'offline-test', unlink: async () => {},
    isLoopback: () => false, getProxy: async () => 'http://127.0.0.1:10809',
    runProgram: async () => 'Content-Length: 42\r\n',
    subprocessRef: { resolveExecutable: async name => {
      assert.equal(name, 'curl'); downloadReached = true; throw new Error('offline download boundary')
    } },
  })
  vm.runInContext(sourceBetween(host, 'async function curlArgs(', 'async function httpFetch('), sandbox)
  const args = await sandbox.curlArgs(['--fail', '--output', 'test.exe', 'https://ollama.com/download/OllamaSetup.exe'])
  assert.deepEqual(Array.from(args.slice(3)), ['-x', 'http://127.0.0.1:10809', '--fail', '--output', 'test.exe', 'https://ollama.com/download/OllamaSetup.exe'])
  vm.runInContext(sourceBetween(host, 'async function installOllama(', 'const localPreparation'), sandbox)
  await assert.rejects(sandbox.installOllama(() => {}), /offline download boundary/)
  assert.equal(downloadReached, true)
})

it('preserves SOCKS compatibility without silently switching to direct transport', async () => {
  let calls = 0
  const sandbox = vm.createContext({
    DEFAULT_HEADERS, isLoopback: () => false, getProxy: async () => 'socks5://127.0.0.1:1080',
    runProgram: async (program, args) => {
      calls++; assert.equal(program, 'curl')
      assert.ok(Array.from(args).includes('socks5://127.0.0.1:1080'))
      assert.ok(Array.from(args).includes('请求'))
      assert.ok(Array.from(args).includes('User-Agent: ' + DEFAULT_HEADERS['User-Agent']))
      assert.ok(Array.from(args).includes('Accept: ' + DEFAULT_HEADERS.Accept))
      return 'proxied'
    },
    requestTextInfo: () => { throw new Error('unexpected direct request') },
  })
  vm.runInContext(sourceBetween(host, 'async function curlArgs(', '// ---------------------------------------------------------------- providers'), sandbox)
  assert.equal(await sandbox.httpFetch('https://remote.test', { method: 'POST', body: '请求' }), 'proxied')
  assert.equal(calls, 1)
})

it('preserves the final SOCKS session URL and leaves the HTML body intact', async () => {
  const marker = '\n__DSH_RESPONSE_INFO__\n'
  const html = '<html>body may contain ' + marker + ' too</html>\n'
  const sandbox = vm.createContext({
    DEFAULT_HEADERS, isLoopback: () => false, getProxy: async () => 'socks5://127.0.0.1:1080',
    runProgram: async (program, args) => {
      assert.equal(program, 'curl')
      const list = Array.from(args)
      assert.ok(list.includes('socks5://127.0.0.1:1080'))
      assert.ok(list.includes('-L'))
      assert.ok(list.includes('User-Agent: ' + DEFAULT_HEADERS['User-Agent']))
      assert.equal(list[list.indexOf('-w') + 1], marker + '%{url_effective}\n%{http_code}')
      assert.equal(list.at(-1), 'https://www.bing.com/translator')
      return html + marker + 'https://cn.bing.com/translator\n200'
    },
    requestTextInfo: () => { throw new Error('unexpected direct request') },
  })
  vm.runInContext(sourceBetween(host, 'async function curlArgs(', '// ---------------------------------------------------------------- providers'), sandbox)
  const result = await sandbox.curlGetInfo('https://www.bing.com/translator')
  assert.equal(result.text, html)
  assert.equal(result.url, 'https://cn.bing.com/translator')
  assert.equal(result.status, 200)
})

for (const output of ['page without metadata', 'page\n__DSH_RESPONSE_INFO__\n\n200']) {
  it('rejects missing or invalid SOCKS metadata instead of guessing the original URL: ' + JSON.stringify(output), async () => {
    const sandbox = vm.createContext({
      DEFAULT_HEADERS, isLoopback: () => false, getProxy: async () => 'socks5://127.0.0.1:1080',
      runProgram: async () => output,
      requestTextInfo: () => { throw new Error('unexpected direct request') },
    })
    vm.runInContext(sourceBetween(host, 'async function curlArgs(', '// ---------------------------------------------------------------- providers'), sandbox)
    await assert.rejects(sandbox.curlGetInfo('https://www.bing.com/translator'), /curl response metadata (?:missing|invalid)/)
  })
}

it('keeps explicit SOCKS headers while applying native browser defaults', async () => {
  const sandbox = vm.createContext({
    DEFAULT_HEADERS, isLoopback: () => false, getProxy: async () => 'socks5://127.0.0.1:1080',
    runProgram: async (program, args) => {
      const headers = Array.from(args).filter((value, i, list) => list[i - 1] === '-H')
      assert.ok(headers.includes('User-Agent: custom-agent'))
      assert.ok(!headers.includes('User-Agent: ' + DEFAULT_HEADERS['User-Agent']))
      assert.ok(headers.includes('Content-Type: application/x-www-form-urlencoded'))
      assert.ok(headers.includes('Accept: ' + DEFAULT_HEADERS.Accept))
      return 'translated'
    },
  })
  vm.runInContext(sourceBetween(host, 'async function curlArgs(', '// ---------------------------------------------------------------- providers'), sandbox)
  assert.equal(await sandbox.httpFetch('https://cn.bing.com/ttranslatev3', {
    method: 'POST', headers: { 'User-Agent': 'custom-agent', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'text=source',
  }), 'translated')
})

it('keeps native text callers compatible while exposing the final URL to session callers', async () => {
  let proxyGets = 0
  const sandbox = vm.createContext({
    isLoopback: url => url.startsWith('http://127.0.0.1'),
    getProxy: async () => { proxyGets++; return 'http://127.0.0.1:10809' },
    requestTextInfo: async (url, options) => {
      assert.equal(options.proxy, url.startsWith('http://127.0.0.1') ? null : 'http://127.0.0.1:10809')
      return { text: 'session HTML', url: 'https://cn.bing.com/translator', status: 200 }
    },
  })
  vm.runInContext(sourceBetween(host, 'async function httpFetch(', '// ---------------------------------------------------------------- providers'), sandbox)
  assert.equal(await sandbox.curlGet('http://127.0.0.1/test'), 'session HTML')
  assert.equal(proxyGets, 0)
  const result = await sandbox.curlGetInfo('https://www.bing.com/translator')
  assert.equal(result.url, 'https://cn.bing.com/translator')
  assert.equal(result.text, 'session HTML')
  assert.equal(proxyGets, 1)
})

it('reuses a host failure during cooldown, then performs a real retry at expiry', async () => {
  let now = 100000, calls = 0
  const sandbox = vm.createContext({
    Date: { now: () => now }, Map,
    loadConfig: async () => ({}), needsTranslate: () => true,
    translateViaChain: async () => { calls++; return calls === 1 ? { ok: false, text: 'original', error: 'offline' } : { ok: true, text: 'translated' } },
  })
  vm.runInContext(sourceBetween(host, 'const cache = new Map()', 'function isCjk('), sandbox)
  vm.runInContext(sourceBetween(host, 'async function handleTranslate(', '// ---------------------------------------------------------------- http glue'), sandbox)
  const first = await sandbox.handleTranslate({ text: 'original' })
  assert.equal(first.retryAt, 130000)
  now = 102500
  assert.equal((await sandbox.handleTranslate({ text: 'original' })).ok, false)
  assert.equal(calls, 1)
  now = 130000
  assert.equal((await sandbox.handleTranslate({ text: 'original' })).text, 'translated')
  assert.equal(calls, 2)
})

function pipeline() {
  let now = 100000, recovered = false, hostCalls = 0, directCalls = 0, writes = 0
  const sandbox = vm.createContext({
    Date: { now: () => now }, Map, Promise,
    localStorage: { getItem: () => null, setItem: () => { writes++ } },
    fnv: value => value, needsTranslate: () => true, chunkText: value => [value], recordCheck: () => {},
    hostAttempt: async () => {
      hostCalls++
      if (!recovered) { const error = new Error('temporary offline'); error.retryAt = now + 30000; throw error }
      return { ok: true, text: 'translated' }
    },
    gtxChunk: async () => { directCalls++; throw new Error('temporary offline') },
    sleepMs: async ms => { now += ms; recovered = true },
  })
  vm.runInContext(sourceBetween(client, 'var mem = new Map();', 'var providerChecks = {}'), sandbox)
  vm.runInContext(sourceBetween(client, 'function requestTranslate(', 'function useXlate('), sandbox)
  return { sandbox, recover: () => { recovered = true }, advance: ms => { now += ms },
    counts: () => ({ hostCalls, directCalls, writes }), now: () => now }
}

it('does not count a client cache hit as a new network attempt and retries after expiry', async () => {
  const p = pipeline()
  const first = await p.sandbox.requestTranslate('original', 'zh-CN')
  assert.equal(first.ok, false)
  assert.equal(p.counts().hostCalls, 1, 'a host cooldown must stop immediate retry')
  assert.equal(p.counts().writes, 0, 'negative entries must not persist to localStorage')
  p.recover(); p.advance(2500)
  assert.equal((await p.sandbox.requestTranslate('original', 'zh-CN')).ok, false)
  assert.equal(p.counts().hostCalls, 1)
  p.advance(27500)
  assert.equal((await p.sandbox.requestTranslate('original', 'zh-CN')).ok, true)
  assert.equal(p.counts().hostCalls, 2)
})

it('automatically resumes a mounted reasoning row after a temporary failure', async () => {
  const p = pipeline()
  const text = 'This is a complete reasoning sentence.'
  const tRef = { current: { segIdx: 0, transText: '', done: false, failed: false, busy: false } }
  Object.assign(p.sandbox, {
    tRef, stateRef: { current: { text, running: false } }, lang: 'zh-CN',
    splitSentences: value => [{ text: value, end: value.length }],
    XL_STREAM_MARGIN: 120, XL_STREAM_MIN_BATCH: 240, XL_BATCH_CHARS: 400,
    mutate: fn => { tRef.current = fn(tRef.current) },
  })
  const row = client.slice(client.indexOf('function ThinkRow('))
  await vm.runInContext(sourceBetween(row, 'var alive = true;', 'return function () { alive = false;'), p.sandbox)
  assert.equal(tRef.current.transText, 'translated')
  assert.equal(tRef.current.failed, false)
  assert.equal(tRef.current.done, true)
  assert.equal(p.counts().hostCalls, 2)
  assert.ok(p.now() >= 130000, 'the row must wait for failure-cache expiry')
})

it('retries mounted answer text with a cached failure and cancels retry on unmount', async () => {
  const p = pipeline()
  await p.sandbox.requestTranslate('original', 'zh-CN')
  p.recover()
  let entry, callback, delay, cleanup, cancelled = false
  Object.assign(p.sandbox, {
    useStore: () => ({ lang: 'zh-CN' }),
    useState: init => [init(), value => { entry = value }],
    useEffect: effect => { cleanup = effect() },
    setTimeout: (fn, ms) => { callback = fn; delay = ms; return 17 },
    clearTimeout: id => { assert.equal(id, 17); cancelled = true },
  })
  vm.runInContext(sourceBetween(client, 'function useXlate(', '// ------------------------------------------------------------------'), p.sandbox)
  p.sandbox.useXlate('original', true)
  await Promise.resolve(); await Promise.resolve()
  assert.equal(entry.ok, false)
  assert.equal(delay, 30000)
  cleanup()
  assert.equal(cancelled, true)
  callback() // A queued callback must not send a request after unmount.
  assert.equal(p.counts().hostCalls, 1)
  p.sandbox.useXlate('original', true)
  await new Promise(resolve => setImmediate(resolve))
  p.advance(delay); callback()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(entry.text, 'translated')
  cleanup()
  assert.equal(p.counts().hostCalls, 2)
})

it('allows a slow host chain to complete instead of imposing an 8-second browser limit', async () => {
  let timeout
  const sandbox = vm.createContext({
    fetchWithTimeout: async (url, opts, ms) => {
      timeout = ms
      return { ok: true, json: async () => ({ ok: true, text: 'translated' }) }
    }, recordCheck: () => {},
  })
  vm.runInContext(sourceBetween(client, 'async function hostAttempt(', 'function requestTranslate('), sandbox)
  assert.equal((await sandbox.hostAttempt('original', 'zh-CN')).text, 'translated')
  assert.ok(timeout >= 120000 + 15000, 'model loading plus local inference must fit the browser deadline')
})
