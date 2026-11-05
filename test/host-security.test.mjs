import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readdir, copyFile, writeFile, readFile, unlink, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import http from 'node:http'

const root = fileURLToPath(new URL('../', import.meta.url))
async function host(t, config, { failStorage = false, lateCredentials = false } = {}) {
  const dir = await mkdtemp(join(root, '.test-host-'))
  const lib = join(dir, 'lib')
  await mkdir(lib)
  t.after(async () => {
    // The fixture owns only regular files it created; no recursive deletion.
    for (const entry of await readdir(lib, { withFileTypes: true })) {
      assert.equal(entry.isFile(), true)
      await unlink(join(lib, entry.name))
    }
    await rmdir(lib)
    await unlink(join(dir, 'package.json'))
    await rmdir(dir)
  })
  for (const entry of await readdir(join(root, 'lib'))) if (entry.endsWith('.js')) await copyFile(join(root, 'lib', entry), join(lib, entry))
  await copyFile(join(root, 'package.json'), join(dir, 'package.json'))
  const configPath = join(lib, 'config.json')
  await writeFile(configPath, JSON.stringify(config))
  const plugin = await import(pathToFileURL(join(lib, 'index.js')).href)
  const routes = new Map(), keys = new Map(), callbacks = []
  let rows = []
  const credentials = {
    set: async (ref, value) => { if (failStorage) throw new Error('storage echoed ' + value); keys.set(ref, value); callbacks.forEach(callback => callback(ref)) },
    unset: async ref => { keys.delete(ref); callbacks.forEach(callback => callback(ref)) },
    resolve: async ref => keys.has(ref) ? { value: keys.get(ref), source: 'file' } : undefined,
    describe: async ref => ({ configured: keys.has(ref), writable: true }),
  }
  const services = { credentials, loader: { entries: () => rows }, profileContext: { home: dir, dir, name: 'test', patchPath: join(dir, 'cordis.patch.yml'), overlays: [] },
    webServer: { register: route => { routes.set(route.path, route.handler); return () => routes.delete(route.path) } } }
  let credentialsReady = !lateCredentials
  plugin.apply({ get: key => key === 'credentials' && !credentialsReady ? undefined : services[key], on: (_event, callback) => { callbacks.push(callback) }, effect: factory => factory() })
  async function request(path, body, headers = {}) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
    req.method = body === undefined ? 'GET' : 'POST'
    req.headers = { host: '127.0.0.1:3080', ...headers }
    return new Promise((resolve, reject) => {
      const res = { statusCode: 200, setHeader() {}, writeHead(code) { this.statusCode = code }, end: data => resolve({ status: res.statusCode, body: JSON.parse(data) }) }
      Promise.resolve(routes.get(path)(req, res)).catch(reject)
    })
  }
  return { request, plugin, keys, enableCredentials: () => { credentialsReady = true }, disk: async () => JSON.parse(await readFile(configPath, 'utf8')),
    official: enabled => { rows = [{ options: { name: '@deepseek-ai/dsh-experimental-client-ui-cot-translation' }, disabled: !enabled, fiber: { state: 2 } }] } }
}
function config(baseURL = 'https://fixture.invalid/v1') {
  return { chain: ['custom'], providers: { google: { enabled: false }, bing: { enabled: false }, openai: { enabled: false },
    custom: { type: 'openai', enabled: true, model: 'first', baseURL, apiKey: 'fixture-private-key' } } }
}

it('migrates a legacy key, uses DSH resolution for a real local API call, and never returns the value', async t => {
  let authorization
  const server = http.createServer(async (req, res) => {
    authorization = req.headers.authorization
    for await (const _chunk of req) { /* consume the local fixture request */ }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ choices: [{ message: { content: '第一段译文' } }] }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const h = await host(t, config('http://127.0.0.1:' + server.address().port + '/v1'))
  const response = await h.request('/_xlate/config')
  assert.equal(response.status, 200)
  assert.equal(response.body.providers.custom.hasApiKey, true)
  assert.equal(JSON.stringify(response).includes('fixture-private-key'), false)
  assert.equal(JSON.stringify(await h.disk()).includes('fixture-private-key'), false)
  assert.equal(h.keys.size, 1)
  const translation = await h.request('/_xlate/translate', { text: 'Read the build output.', target: 'zh-CN' })
  assert.equal(translation.body.text, '第一段译文')
  assert.equal(authorization, 'Bearer fixture-private-key')
  assert.equal(translation.body.cacheNamespace, response.body.cacheNamespace)
})

it('keeps a masked key through editing, replaces it safely, and deletes only that provider key', async t => {
  const h = await host(t, config())
  const first = (await h.request('/_xlate/config')).body
  const ref = first.providers.custom.apiKeyRef
  await h.request('/_xlate/config', { providers: { custom: { model: 'second' } } })
  assert.equal((await h.disk()).providers.custom.apiKeyRef, ref)
  await h.request('/_xlate/config', { providers: { custom: { apiKey: 'replacement-private-key' } } })
  assert.equal(h.keys.has(ref), false)
  assert.deepEqual([...h.keys.values()], ['replacement-private-key'])
  await h.request('/_xlate/config', { providers: { other: { type: 'openai', model: 'other', apiKey: 'other-private-key' } } })
  const removed = await h.request('/_xlate/config', { providers: { custom: { apiKey: null } } })
  assert.equal(removed.body.providers.custom.hasApiKey, false)
  assert.deepEqual([...h.keys.values()], ['other-private-key'])
})

it('retains the original configuration and hides key values when migration fails', async t => {
  const h = await host(t, config(), { failStorage: true })
  const response = await h.request('/_xlate/config')
  assert.equal(response.status, 500)
  assert.equal(JSON.stringify(response).includes('fixture-private-key'), false)
  assert.equal((await h.disk()).providers.custom.apiKey, 'fixture-private-key')
})

it('blocks translation while official translation is enabled and resumes after it is disabled', async t => {
  const h = await host(t, config())
  let calls = 0
  h.plugin.ADAPTERS.openai = async () => { calls++; return '第一段译文' }
  h.official(true)
  const blocked = await h.request('/_xlate/translate', { text: 'Read the build output.', target: 'zh-CN' })
  assert.equal(blocked.body.conflict, true)
  assert.equal(calls, 0)
  h.official(false)
  assert.equal((await h.request('/_xlate/translate', { text: 'Read the build output.', target: 'zh-CN' })).body.ok, true)
  assert.equal(calls, 1)
})

it('does not let a result already in flight repopulate the Host cache after switching models', async t => {
  const h = await host(t, config())
  await h.request('/_xlate/config')
  let release, started
  const ready = new Promise(resolve => { started = resolve })
  let calls = 0
  h.plugin.ADAPTERS.openai = async (_text, _target, provider) => {
    calls++
    if (provider.model === 'first') { started(); return new Promise(resolve => { release = resolve }) }
    return '第二段译文'
  }
  const old = h.request('/_xlate/translate', { text: 'Read the build output.', target: 'zh-CN' })
  await ready
  const changed = await h.request('/_xlate/config', { providers: { custom: { model: 'second' } } })
  release('第一段译文')
  assert.notEqual((await old).body.cacheNamespace, changed.body.cacheNamespace)
  assert.equal((await h.request('/_xlate/translate', { text: 'Read the build output.', target: 'zh-CN' })).body.text, '第二段译文')
  assert.equal((await h.request('/_xlate/translate', { text: 'Read the build output.', target: 'zh-CN' })).body.text, '第二段译文')
  assert.equal(calls, 2)
})

it('serializes concurrent configuration edits without losing a model change or saved key', async t => {
  const h = await host(t, config())
  await h.request('/_xlate/config')
  const responses = await Promise.all([
    h.request('/_xlate/config', { providers: { custom: { model: 'second' } } }),
    h.request('/_xlate/config', { providers: { custom: { apiKey: 'replacement-private-key' } } }),
  ])
  assert.ok(responses.every(response => response.status === 200))
  assert.equal((await h.disk()).providers.custom.model, 'second')
  assert.deepEqual([...h.keys.values()], ['replacement-private-key'])
  assert.equal(JSON.stringify(responses).includes('replacement-private-key'), false)
})

it('discovers credentials activated after plugin startup and migrates an already cached legacy configuration', async t => {
  const h = await host(t, config(), { lateCredentials: true })
  const before = await h.request('/_xlate/config')
  assert.equal(before.body.credentialStorage, 'unavailable')
  assert.equal(JSON.stringify(before).includes('fixture-private-key'), false)
  assert.equal((await h.disk()).providers.custom.apiKey, 'fixture-private-key')
  h.enableCredentials()
  const ready = await h.request('/_xlate/context')
  assert.equal(ready.body.credentialStorage, 'dsh')
  assert.equal(JSON.stringify(await h.disk()).includes('fixture-private-key'), false)
  assert.deepEqual([...h.keys.values()], ['fixture-private-key'])
  const updated = await h.request('/_xlate/config', { providers: { custom: { apiKey: 'replacement-private-key' } } })
  assert.equal(updated.status, 200)
  assert.deepEqual([...h.keys.values()], ['replacement-private-key'])
})

it('persists per-language glossaries and invalidates old translations when mappings change or are disabled', async t => {
  const h = await host(t, config())
  let calls = 0
  h.plugin.ADAPTERS.openai = async value => { calls++; return value.replace('Please use', '请使用').replace('and keep', '并保留') }
  const first = await h.request('/_xlate/config', { glossary: { enabled: true, entries: {
    'zh-CN': [{ source: 'agent', target: '智能体' }, { source: 'DeepSeek', target: 'DeepSeek' }], ja: [{ source: 'agent', target: 'エージェント' }],
  } } })
  assert.equal(first.status, 200)
  const input = { text: 'Please use agent and keep DeepSeek.', target: 'zh-CN' }
  const one = (await h.request('/_xlate/translate', input)).body
  assert.ok(one.text.includes('智能体') && one.text.includes('DeepSeek'))
  assert.equal(one.text.includes('ZXQ'), false)
  await h.request('/_xlate/translate', input)
  assert.equal(calls, 1)
  const second = await h.request('/_xlate/config', { glossary: { entries: { 'zh-CN': [{ source: 'agent', target: '代理' }] } } })
  assert.notEqual(second.body.cacheNamespace, first.body.cacheNamespace)
  assert.equal(second.body.glossary.entries.ja[0].target, 'エージェント')
  assert.ok((await h.request('/_xlate/translate', input)).body.text.includes('代理'))
  assert.equal(calls, 2)
  await h.request('/_xlate/config', { glossary: { enabled: false } })
  const disabled = (await h.request('/_xlate/translate', input)).body
  assert.ok(disabled.text.includes('agent'))
  assert.equal(disabled.glossaryTargets, undefined)
  assert.equal(calls, 3)
  assert.deepEqual([...h.keys.values()], ['fixture-private-key'])
})

it('rejects malformed glossary updates with 400 and retains configuration and credentials', async t => {
  const h = await host(t, config())
  await h.request('/_xlate/config')
  const before = await h.disk()
  for (const glossary of [{ enabled: 'true' }, { builtin: 'true' }, { entries: { unknown: [] } }, { entries: { 'zh-CN': [{ source: 'agent', target: 'x' }, { source: 'AGENT', target: 'y' }] } }]) {
    assert.equal((await h.request('/_xlate/config', { glossary })).status, 400)
    assert.deepEqual(await h.disk(), before)
  }
  assert.deepEqual([...h.keys.values()], ['fixture-private-key'])
})

it('enables presets without copying entries, invalidates cached results and retains user overrides on disable', async t => {
  const h = await host(t, config())
  let calls = 0
  h.plugin.ADAPTERS.openai = async value => {
    calls++
    return value.replace('Please inspect', '请检查').replace('context window', '上下文范围').replace(/\bagent\b/g, '代理').replace(/\bthe\b/g, '').replace(/\band\b/g, '与')
  }
  const before = (await h.request('/_xlate/config')).body
  assert.equal(before.glossary.builtin, false)
  assert.ok(before.glossaryPreset.entries['zh-CN'].length >= 50)
  const input = { text: 'Please inspect the context window and agent.', target: 'zh-CN' }
  assert.ok((await h.request('/_xlate/translate', input)).body.text.includes('上下文范围'))
  const enabled = (await h.request('/_xlate/config', { glossary: { builtin: true, enabled: true } })).body
  assert.notEqual(enabled.cacheNamespace, before.cacheNamespace)
  const translated = (await h.request('/_xlate/translate', input)).body
  assert.ok(translated.text.includes('上下文窗口') && translated.text.includes('智能体'))
  await h.request('/_xlate/translate', input)
  assert.equal(calls, 2)
  assert.deepEqual((await h.disk()).glossary.entries, {})
  assert.equal((await h.disk()).glossaryPreset, undefined)
  await h.request('/_xlate/config', { glossary: { entries: { 'zh-CN': [{ source: 'AGENT', target: '自定义译法' }] } } })
  assert.ok((await h.request('/_xlate/translate', input)).body.text.includes('自定义译法'))
  await h.request('/_xlate/config', { glossary: { enabled: false } })
  const builtinOnly = (await h.request('/_xlate/translate', input)).body
  assert.ok(builtinOnly.text.includes('上下文窗口') && builtinOnly.text.includes('智能体'))
  assert.equal(builtinOnly.text.includes('自定义译法'), false)
  assert.equal((await h.disk()).glossary.builtin, true)
  await h.request('/_xlate/config', { glossary: { enabled: true } })
  await h.request('/_xlate/config', { glossary: { builtin: false } })
  const disabled = (await h.request('/_xlate/translate', input)).body
  assert.ok(disabled.text.includes('上下文范围') && disabled.text.includes('自定义译法'))
  assert.equal((await h.disk()).glossary.entries['zh-CN'].length, 1)
  assert.deepEqual([...h.keys.values()], ['fixture-private-key'])
})

it('still contacts an explicitly tested provider when a glossary covers the entire input', async t => {
  const h = await host(t, config())
  await h.request('/_xlate/config', { glossary: { enabled: true, entries: { 'zh-CN': [{ source: 'agent', target: '智能体' }] } } })
  let calls = 0
  h.plugin.ADAPTERS.openai = async value => { calls++; return value }
  const result = (await h.request('/_xlate/translate', { text: 'agent', target: 'zh-CN', provider: 'custom' })).body
  assert.equal(result.text, '智能体')
  assert.equal(calls, 1)
})

const POST_BODIES = {
  '/_xlate/config': { providers: { custom: { model: 'second' } } },
  '/_xlate/translate': { text: 'Read the build output.', target: 'zh-CN' },
  '/_xlate/model/pull': { model: 'fixture-model' },
  '/_xlate/local/prepare': {},
  '/_xlate/local/release': {},
}
const NOT_SAME_ORIGIN = [
  { origin: 'https://other.invalid' },
  { origin: 'http://127.0.0.1:3081' },
  { origin: 'null' },
  { origin: 'not a url' },
  { 'sec-fetch-site': 'cross-site' },
]

for (const [path, body] of Object.entries(POST_BODIES)) {
  it('answers 403 on POST ' + path + ' unless the request is same-origin, before reading the body', async t => {
    // No route below may reach a real local model endpoint, even when this test runs against code without the check.
    const fixture = config()
    fixture.providers.openai = { type: 'openai', enabled: false, model: 'first', baseURL: 'https://fixture.invalid/v1' }
    const h = await host(t, fixture)
    await h.request('/_xlate/config')
    const before = await h.disk()
    let calls = 0
    h.plugin.ADAPTERS.openai = async () => { calls++; return '第一段译文' }
    const fetches = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline fixture') })
    for (const headers of NOT_SAME_ORIGIN) {
      assert.equal((await h.request(path, body, headers)).status, 403, JSON.stringify(headers))
      assert.equal((await h.request(path, '{not json', headers)).status, 403, 'malformed body ' + JSON.stringify(headers))
      assert.deepEqual(await h.disk(), before)
    }
    assert.equal(calls, 0)
    assert.equal(fetches.mock.callCount(), 0)
  })
}

it('still accepts POST requests with no Origin or a same-origin Origin', async t => {
  const h = await host(t, config())
  h.plugin.ADAPTERS.openai = async () => '第一段译文'
  for (const headers of [
    {},
    { origin: 'http://127.0.0.1:3080' },
    { origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' },
    { origin: 'https://dsh.example', host: 'dsh.example' },
    { origin: 'https://dsh.example', host: 'dsh.example:443' },
  ]) {
    assert.equal((await h.request('/_xlate/config', POST_BODIES['/_xlate/config'], headers)).status, 200, JSON.stringify(headers))
    assert.equal((await h.request('/_xlate/translate', POST_BODIES['/_xlate/translate'], headers)).body.ok, true, JSON.stringify(headers))
  }
  assert.equal((await h.disk()).providers.custom.model, 'second')
})
