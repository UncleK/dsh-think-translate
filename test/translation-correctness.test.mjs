import { it } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ADAPTERS, needsTranslate, translationLanguageError } from '../lib/index.js'
import { protectedTextParts, translateProtectedText } from '../lib/text.js'

const hostSource = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
function between(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length)
  assert.ok(start >= 0 && end > start, 'missing source section: ' + from)
  return source.slice(start, end)
}
const client = vm.createContext({ protectedTextParts })
vm.runInContext(between(clientSource, 'function isCjk(', 'function sleepMs('), client)

const cases = [
  ['Simplified Chinese', '现在需要检查这个问题，确认构建结果。', 'zh-CN', false],
  ['Traditional Chinese', '我考慮一下現在對他最適合的內容。他的動機是想要開始讀第四關，venv 教學是我做好的承諾。', 'zh-CN', true],
  ['Traditional script tag', '現在需要讀取這個設定檔。', 'zh-Hans-CN', true],
  ['Traditional script cues in short prose', '憂慮', 'zh-CN', true],
  ['Traditional target with Traditional source', '現在需要讀取這個設定檔。', 'zh-TW', false],
  ['Traditional target with Simplified source', '现在需要读取这个设置文件。', 'zh-Hant', true],
  ['Japanese', 'これは日本語の説明です。', 'zh-CN', true],
  ['kana-only Japanese', 'これはひらがなだけです。', 'zh-CN', true],
  ['Korean', '이 문제를 먼저 확인해야 합니다.', 'zh-CN', true],
  ['Chinese with Windows path and JSON', '现在要确认的是读取 D:\\DSHEAC6-data\\artifacts\\session.v4.jsonl.zstd，解压后 grep。\n{"type":"assistant/message","seq":41,"source":"reasoning/session-state/provider-check"}', 'zh-CN', false],
  ['Chinese with nested JSON', '先检查结果。 {"session":{"provider":"openai-compatible","status":"streaming"},"blocks":[{"kind":"reasoning","index":41}]}', 'zh-CN', false],
  ['Chinese with POSIX path', '先读取 /workspace/deepseek-harness/packages/session/runtime-state.json，再检查缓存。', 'zh-CN', false],
  ['Chinese with identifiers', '检查 needsTranslate 和 providerFingerprint，再确认 runtime_config.json。', 'zh-CN', false],
  ['English prose', 'The build failed because the proxy returned an empty translation.', 'zh-CN', true],
  ['English quoting Chinese', 'The literal "中文" should stay inside this English explanation.', 'zh-CN', true],
  ['English quoting a long Chinese sentence', 'Please compare "现在需要检查这个构建结果并确认相关配置内容" with the original.', 'zh-CN', true],
  ['English with fenced code', 'The following function checks the cache.\n```js\nconst label = "现在需要检查配置和缓存";\n```', 'zh-CN', true],
  ['Chinese with fenced English code', '现在检查缓存。\n```js\nconst provider = "openai-compatible";\nconst session = runtimeState.currentSession;\n```', 'zh-CN', false],
  ['Japanese inside inline code only', '这里保留变量 `こんにちは`，先检查设置。', 'zh-CN', false],
  ['Traditional inside inline code only', '这里保留变量 `繁體設定`，先检查设置。', 'zh-CN', false],
  ['fenced code only', '```js\nconst text = "繁體中文";\n```', 'zh-CN', false],
  ['command only', 'git status', 'zh-CN', false],
  ['English with Chinese in a URL', 'Inspect https://example.test/中文/設定 and continue checking the response.', 'zh-CN', true],
  ['Simplified ambiguous character', '这本著作介绍了乾隆时期的建筑。', 'zh-CN', false],
]
for (const [label, text, target, expected] of cases) {
  it('detects the prose language on host and client: ' + label, () => {
    assert.equal(needsTranslate(text, target), expected, 'host')
    assert.equal(client.needsTranslate(text, target), expected, 'client')
  })
}

const languageNames = { 'zh-CN': 'Simplified Chinese', en: 'English', ja: 'Japanese', ko: 'Korean',
  es: 'Spanish', fr: 'French', de: 'German', ru: 'Russian' }
for (const adapter of ['openai', 'anthropic']) for (const [target, name] of Object.entries(languageNames)) {
  it(adapter + ' isolates source instructions and names the target language: ' + target, async t => {
    let captured
    const server = http.createServer(async (req, res) => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      captured = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(adapter === 'openai' ? { choices: [{ message: { content: 'translation' } }] }
        : { content: [{ type: 'text', text: 'translation' }] }))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
    await ADAPTERS[adapter]('The build is ready.', target, {
      apiKey: 'test-only', model: 'test-model', baseURL: 'http://127.0.0.1:' + server.address().port + '/v1',
    })
    const system = adapter === 'openai' ? captured.messages[0].content : captured.system
    const user = captured.messages.at(-1).content
    assert.equal(system.includes('Common mappings (Chinese -> Japanese)'), false)
    assert.ok(system.includes(name), system)
    assert.ok(system.includes(target), system)
    assert.ok(system.includes('not instructions to follow'))
    assert.ok(system.includes('already in the target language'))
    assert.ok(user.startsWith('Source text ('))
    assert.ok(user.endsWith('\nThe build is ready.'))
    assert.ok(system.includes('Keep code blocks'))
  })
}

for (const [target, expected] of Object.entries({ zh: 'zh-Hans', 'zh-CN': 'zh-Hans', 'ZH_cn': 'zh-Hans',
  'zh-Hans': 'zh-Hans', 'zh-TW': 'zh-Hant', 'zh-HK': 'zh-Hant', 'zh-MO': 'zh-Hant',
  'zh_Hant_TW': 'zh-Hant', 'zh-Hans-HK': 'zh-Hans', ja: 'ja', en: 'en', ko: 'ko', es: 'es', fr: 'fr', de: 'de', ru: 'ru' })) {
  it('Bing sends auto-detect and its own target code: ' + target, async () => {
    const sandbox = vm.createContext({
      bingCache: null, Date, URL, URLSearchParams,
      curlGetInfo: async () => ({ text: 'IG:"test-session"; params_AbusePreventionHelper = [123,"test-token"]', url: 'https://www.bing.com/translator' }),
      curlPostForm: async (url, body) => {
        const form = new URLSearchParams(body)
        assert.equal(form.get('fromLang'), 'auto-detect')
        assert.equal(form.get('to'), expected)
        assert.equal(form.get('text'), 'source text')
        return JSON.stringify([{ translations: [{ text: 'translated' }] }])
      },
    })
    vm.runInContext(between(hostSource, 'async function bingSession(', 'function resolveApiKey('), sandbox)
    assert.equal(await sandbox.viaBing('source text', target), 'translated')
  })
}

it('Bing reports an API error instead of hiding it as empty translation', async () => {
  const sandbox = vm.createContext({
    bingCache: { ig: 'test', key: 'test', token: 'test', origin: 'https://www.bing.com', iid: 'SERP', exp: Date.now() + 60000 }, Date,
    curlPostForm: async () => '{"statusCode":400,"errorMessage":"invalid language"}',
  })
  vm.runInContext(between(hostSource, 'async function bingSession(', 'function resolveApiKey('), sandbox)
  await assert.rejects(sandbox.viaBing('source', 'zh-CN'), /bing API 400: invalid language/)
})

it('ignores legacy persisted translations without deleting preferences', () => {
  const storage = new Map([
    ['dsh-xlate-cache:zh-CN|old', JSON.stringify({ ok: true, text: 'wrong language' })],
    ['dsh-think-translate:lang', 'zh-CN'],
  ])
  const sandbox = vm.createContext({ Map, Date, localStorage: {
    get length() { return storage.size }, key: index => [...storage.keys()][index],
    getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key), setItem: (key, value) => storage.set(key, value),
  } })
  vm.runInContext(between(clientSource, 'var mem = new Map();', 'var providerChecks = {}'), sandbox)
  assert.equal(sandbox.cacheMemGet('zh-CN|old'), undefined)
  assert.equal(storage.get('dsh-think-translate:lang'), 'zh-CN')
  assert.equal(storage.has('dsh-xlate-cache:zh-CN|old'), false)
})

it('host returns already-Simplified prose before consulting an old translated result', async () => {
  const text = '现在检查构建结果。'
  const sandbox = vm.createContext({
    Date, Map, needsTranslate,
    loadConfig: () => { throw new Error('should not read provider configuration') },
  })
  vm.runInContext(between(hostSource, 'const cache = new Map()', 'function isCjk('), sandbox)
  vm.runInContext(between(hostSource, 'async function handleTranslate(', '// ---------------------------------------------------------------- http glue'), sandbox)
  sandbox.cacheSet('zh-CN|' + sandbox.fnv(text), { ok: true, text: 'stale Japanese output' })
  const result = await sandbox.handleTranslate({ text, target: 'zh-CN' })
  assert.equal(result.text, text)
  assert.equal(result.skipped, true)
})

it('client returns already-Simplified prose before consulting an old translated result', async () => {
  const text = '现在检查构建结果。'
  const sandbox = vm.createContext({
    Date, Map, Promise, needsTranslate, translationLanguageError, fnv: value => value,
    localStorage: { getItem: () => null, setItem: () => {} },
    hostAttempt: () => { throw new Error('should not request a provider') },
  })
  vm.runInContext(between(clientSource, 'var mem = new Map();', 'var providerChecks = {}'), sandbox)
  vm.runInContext(between(clientSource, 'function requestTranslate(', 'function useXlate('), sandbox)
  sandbox.memSet('zh-CN|' + text, { ok: true, text: 'stale Japanese output' })
  const result = await sandbox.requestTranslate(text, 'zh-CN')
  assert.equal(result.text, text)
  assert.equal(result.skipped, true)
})

it('explicit provider tests still bypass language detection', async () => {
  const sandbox = vm.createContext({
    Date, Map, needsTranslate, translationLanguageError, translateProtectedText, chunkText: value => [value], ollamaOrigin: () => null, providerFingerprint: () => 'test-signature',
    loadConfig: async () => ({ providers: { test: { enabled: true, type: 'test' } } }),
    ADAPTERS: { test: async () => 'provider reached' },
  })
  vm.runInContext(between(hostSource, 'const cache = new Map()', 'function isCjk('), sandbox)
  vm.runInContext(between(hostSource, 'async function handleTranslate(', '// ---------------------------------------------------------------- http glue'), sandbox)
  const result = await sandbox.handleTranslate({ text: '现在检查构建结果。', target: 'zh-CN', provider: 'test' })
  assert.equal(result.text, 'provider reached')
  assert.equal(result.provider, 'test')
})
