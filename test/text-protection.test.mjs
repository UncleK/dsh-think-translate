import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { protectedTextParts, translateProtectedText } from '../lib/text.js'
import { ADAPTERS, runChainFor, translateViaChain, chunkText, needsTranslate } from '../lib/index.js'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
function between(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start)
  return source.slice(start, end)
}
const client = vm.createContext({})
vm.runInContext(between('function protectedTextParts(', 'function isCjk('), client)
vm.runInContext(between('function splitSentences(', 'var XL_STREAM_MARGIN'), client)

const samples = [
  ['inline', 'Check `const 中文 = "secret"` now.', ['`const 中文 = "secret"`']],
  ['multiple inline delimiters', 'Read ``a ` nested tick`` and `other()`.', ['``a ` nested tick``', '`other()`']],
  ['multiline inline', 'Read `first\nsecond` now.', ['`first\nsecond`']],
  ['fenced CRLF', 'Before.\r\n```js\r\nconst 中文 = "secret";\r\n```\r\nAfter.', ['```js\r\nconst 中文 = "secret";\r\n```\r\n']],
  ['long fence', 'Before.\n```js\n' + 'const key = "secret";\n'.repeat(300) + '```\nAfter.', ['```js\n' + 'const key = "secret";\n'.repeat(300) + '```\n']],
  ['longer fence with nested shorter fence', 'Before.\n````md\n```js\nconst key = 1;\n```\n````\nAfter.', ['````md\n```js\nconst key = 1;\n```\n````\n']],
  ['list fence with ticks in code', 'Before.\n- ```js\n  const secret = "```";\n  ```\nAfter.', ['- ```js\n  const secret = "```";\n  ```\n']],
  ['tilde fence', 'Before.\n~~~python\nsecret = "中文"\n~~~\nAfter.', ['~~~python\nsecret = "中文"\n~~~\n']],
  ['indented fence', 'Before.\n  ```sh\n  echo secret\n  ```\nAfter.', ['  ```sh\n  echo secret\n  ```\n']],
  ['quoted fence', 'Before.\n> ```sh\n> echo secret\n> ```\nAfter.', ['> ```sh\n> echo secret\n> ```\n']],
  ['indented code', 'Before.\n    const key = "secret";\nAfter.', ['    const key = "secret";\n']],
  ['unfinished fence', 'Before.\n```js\nconst key = "secret"', ['```js\nconst key = "secret"']],
  ['unfinished inline', 'Before `const key = "secret"', ['`const key = "secret"']],
]

for (const [label, text, codes] of samples) {
  it('preserves exact code and excludes it from provider payloads: ' + label, async () => {
    const parts = protectedTextParts(text)
    assert.equal(parts.map(part => part.text).join(''), text)
    assert.deepEqual(parts.filter(part => part.code).map(part => part.text), codes)
    assert.deepEqual(JSON.parse(JSON.stringify(client.protectedTextParts(text))), parts)
    const payloads = []
    const result = await translateProtectedText(text, async prose => { payloads.push(prose); return '译文' }, chunkText)
    assert.ok(payloads.length > 0)
    assert.ok(payloads.every(payload => !payload.includes('secret') && !payload.includes('const 中文')))
    for (const code of codes) assert.ok(result.includes(code), 'code changed: ' + label)
    const batches = JSON.parse(JSON.stringify(client.splitSentences(text)))
    assert.equal(batches.map(batch => batch.text).join(''), text)
    assert.deepEqual(batches.filter(batch => batch.code).map(batch => batch.text), codes)
  })
}

it('preserves whitespace around inline code without provider placeholders', async () => {
  const seen = []
  const result = await translateProtectedText('  First `x()` then  `y()`!\n', async text => {
    seen.push(text)
    return text === 'First' ? '首先' : '然后'
  })
  assert.deepEqual(seen, ['First', 'then'])
  assert.equal(result, '  首先 `x()` 然后  `y()`!\n')
})

it('keeps escaped backticks as prose and consumes matching multi-backtick spans', () => {
  const text = 'An escaped \\` mark, followed by ``a ` b``.'
  assert.deepEqual(protectedTextParts(text).filter(part => part.code).map(part => part.text), ['``a ` b``'])
})

it('does not send code-only inputs or unfinished code to a provider', async () => {
  for (const text of ['```js\nconst secret = "中文";\n```', '~~~sh\necho secret\n~~~', '`const secret = 1;', '    const secret = 1;\n']) {
    assert.equal(needsTranslate(text, 'ja'), false)
    assert.equal(await translateProtectedText(text, () => { throw new Error('code reached provider') }), text)
  }
})

it('holds an unfinished streaming code span until its closing delimiter arrives', () => {
  const prefix = 'Before.\n```js\nconst value = 1;\n'
  const unfinished = client.splitSentences(prefix).find(part => part.code)
  const finished = client.splitSentences(prefix + '```\nAfter.').find(part => part.code)
  assert.equal(unfinished.complete, false)
  assert.equal(finished.complete, true)
  assert.equal(unfinished.start, finished.start)
  assert.equal(finished.text, '```js\nconst value = 1;\n```\n')
})

it('protects mixed code when an enabled provider fails and the next provider succeeds', async t => {
  const calls = []
  ADAPTERS['protection-fail'] = async text => { calls.push(['fail', text]); throw new Error('temporary failure') }
  ADAPTERS['protection-ok'] = async text => { calls.push(['ok', text]); return '译文' }
  t.after(() => { delete ADAPTERS['protection-fail']; delete ADAPTERS['protection-ok'] })
  const text = 'Before `secret()` after.\n```js\nconst secret = 1;\n```\nEnd.'
  const result = await runChainFor(['first', 'second'], text, 'zh-CN', { providers: {
    first: { enabled: true, type: 'protection-fail' }, second: { enabled: true, type: 'protection-ok' },
  } })
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'second')
  assert.deepEqual(result.attempts.map(attempt => attempt.ok), [false, true])
  assert.ok(calls.every(([, payload]) => !payload.includes('secret')))
  assert.ok(result.text.includes('`secret()`'))
  assert.ok(result.text.includes('```js\nconst secret = 1;\n```\n'))
})

it('never invokes disabled or removed providers in either configured chain', async t => {
  const calls = []
  ADAPTERS['switch-test'] = async (text, target, provider) => { calls.push(provider.id); return '译文' }
  t.after(() => { delete ADAPTERS['switch-test'] })
  const providers = {
    disabled: { id: 'disabled', enabled: false, type: 'switch-test' },
    removed: { id: 'removed', enabled: true, type: 'switch-test' },
    allowed: { id: 'allowed', enabled: true, type: 'switch-test' },
  }
  const off = await translateViaChain('Text to translate.', 'zh-CN', {
    chain: ['disabled'], fallback: { enabled: false, chain: ['allowed'] }, providers,
  })
  assert.equal(off.ok, false)
  assert.deepEqual(calls, [])
  const on = await translateViaChain('Text to translate.', 'zh-CN', {
    chain: ['disabled'], fallback: { enabled: true, chain: ['disabled', 'allowed'] }, providers,
  })
  assert.equal(on.provider, 'allowed')
  assert.deepEqual(calls, ['allowed'])
})

it('keeps the original after Host failure without any direct browser request', async () => {
  const requests = []
  const box = vm.createContext({ Date, Map, Promise, needsTranslate: () => true, fnv: value => value,
    localStorage: { length: 0, getItem: () => null, setItem: () => {} }, recordCheck: () => {},
    fetch: async (url, options) => {
      requests.push({ url, method: options?.method })
      assert.equal(url, '/_xlate/translate', 'browser bypassed configured routing')
      return { ok: true, json: async () => ({ ok: false, error: 'No enabled provider', retryAt: Date.now() + 30000 }) }
    },
    sleepMs: async () => {},
    fetchWithTimeout: async (...args) => box.fetch(...args),
  })
  vm.runInContext(between('var mem = new Map();', 'var providerChecks = {}'), box)
  vm.runInContext(between('async function hostAttempt(', 'function useXlate('), box)
  const result = await box.requestTranslate('Original sample.', 'zh-CN')
  assert.equal(result.ok, false)
  assert.equal(result.text, 'Original sample.')
  assert.deepEqual(requests, [{ url: '/_xlate/translate', method: 'POST' }])
})
