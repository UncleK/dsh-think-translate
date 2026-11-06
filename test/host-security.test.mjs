import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readdir, copyFile, writeFile, readFile, unlink, rmdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import http from 'node:http'

const root = fileURLToPath(new URL('../', import.meta.url))
async function host(t, config, { failStorage = false, lateCredentials = false, connection, bindHost, routes = new Map() } = {}) {
  const dir = await mkdtemp(join(root, '.test-host-'))
  const lib = join(dir, 'lib')
  const profileConfigDir = join(dir, 'dsh-think-translate')
  const profileConfig = join(profileConfigDir, 'config.json')
  await mkdir(lib)
  t.after(async () => {
    // The fixture owns only regular files it created; no recursive deletion.
    for (const entry of await readdir(lib, { withFileTypes: true })) {
      assert.equal(entry.isFile(), true)
      await unlink(join(lib, entry.name))
    }
    await rmdir(lib)
    await unlink(profileConfig).catch(error => { if (error.code !== 'ENOENT') throw error })
    await rmdir(profileConfigDir).catch(error => { if (error.code !== 'ENOENT') throw error })
    await unlink(join(dir, 'package.json'))
    await rmdir(dir)
  })
  for (const entry of await readdir(join(root, 'lib'))) if (entry.endsWith('.js')) await copyFile(join(root, 'lib', entry), join(lib, entry))
  await copyFile(join(root, 'package.json'), join(dir, 'package.json'))
  const configPath = join(lib, 'config.json')
  await writeFile(configPath, JSON.stringify(config))
  const plugin = await import(pathToFileURL(join(lib, 'index.js')).href)
  const keys = new Map(), callbacks = []
  let rows = []
  const credentials = {
    set: async (ref, value) => { if (failStorage) throw new Error('storage echoed ' + value); keys.set(ref, value); callbacks.forEach(callback => callback(ref)) },
    unset: async ref => { keys.delete(ref); callbacks.forEach(callback => callback(ref)) },
    resolve: async ref => keys.has(ref) ? { value: keys.get(ref), source: 'file' } : undefined,
    describe: async ref => ({ configured: keys.has(ref), writable: true }),
  }
  const services = { credentials, connection, loader: { entries: () => rows }, profileContext: { home: dir, dir, name: 'test', patchPath: join(dir, 'cordis.patch.yml'), overlays: [] },
    webServer: { host: bindHost, register: route => { routes.set(route.path, route.handler); return () => routes.delete(route.path) } } }
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
  const disk = async () => {
    try { return JSON.parse(await readFile(profileConfig, 'utf8')) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      return JSON.parse(await readFile(configPath, 'utf8'))
    }
  }
  return { request, plugin, keys, enableCredentials: () => { credentialsReady = true }, disk, profileConfig, legacyConfig: configPath,
    official: enabled => { rows = [{ options: { name: '@deepseek-ai/dsh-experimental-client-ui-cot-translation' }, disabled: !enabled, fiber: { state: 2 } }] } }
}
function config(baseURL = 'https://fixture.invalid/v1') {
  return { chain: ['custom'], providers: { google: { enabled: false }, bing: { enabled: false }, openai: { enabled: false },
    custom: { type: 'openai', enabled: true, model: 'first', baseURL, apiKey: 'fixture-private-key' } } }
}

it('migrates package settings once and keeps profile settings ahead of stale package files', async t => {
  const old = config('http://127.0.0.1:11434/v1')
  delete old.providers.custom.apiKey
  old.providers.custom.apiKeyRef = 'DSH_XLATE_' + 'A'.repeat(32)
  old.glossary = { enabled: true, builtin: true, entries: { 'zh-CN': [{ source: 'task card', target: '任务卡片' }] } }
  const h = await host(t, old)
  h.keys.set(old.providers.custom.apiKeyRef, 'fixture-local-key')

  const { body } = await h.request('/_xlate/config')
  const migrated = JSON.parse(await readFile(h.profileConfig, 'utf8'))
  assert.deepEqual(migrated.chain, ['custom'])
  assert.equal(migrated.providers.google.enabled, false)
  assert.equal(migrated.providers.bing.enabled, false)
  assert.deepEqual(migrated.glossary, old.glossary)
  assert.equal(migrated.providers.custom.apiKeyRef, old.providers.custom.apiKeyRef)
  assert.equal(body.providers.custom.hasApiKey, true)
  assert.deepEqual(JSON.parse(await readFile(h.legacyConfig, 'utf8')), old)

  const upgraded = await host(t, { chain: ['google'] })
  await mkdir(dirname(upgraded.profileConfig))
  await copyFile(h.profileConfig, upgraded.profileConfig)
  upgraded.keys.set(old.providers.custom.apiKeyRef, 'fixture-local-key')
  const result = (await upgraded.request('/_xlate/config')).body
  assert.deepEqual(result.chain, migrated.chain)
  assert.deepEqual(result.glossary, migrated.glossary)
  assert.equal(result.providers.custom.apiKeyRef, old.providers.custom.apiKeyRef)
  assert.equal(result.providers.custom.hasApiKey, true)
})

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
  { origin: 'ftp://127.0.0.1:3080' },
  { origin: 'custom://127.0.0.1:3080' },
  { origin: 'https://undefined', host: undefined },
  { origin: 'http://127.0.0.1:3080', host: '' },
  { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080/path' },
  { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080\\path' },
  { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080?query' },
  { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080#fragment' },
  { origin: 'http://127.0.0.1:3080', host: 'user@127.0.0.1:3080' },
  { origin: 'http://127.0.0.1:3080', host: '127.0.0.1\t:3080' },
  { origin: 'http://review.invalid', host: 'review.invalid' },
  { origin: 'http://127.0.0.1.review.invalid:3080', host: '127.0.0.1.review.invalid:3080' },
  { host: 'review.invalid' },
  { host: 'localhost.review.invalid:3080' },
  { host: 'review.invalid@127.0.0.1:3080' },
  { host: undefined },
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

it('still accepts POST requests with no Origin or a same-origin Origin on a loopback Host', async t => {
  const h = await host(t, config())
  h.plugin.ADAPTERS.openai = async () => '第一段译文'
  for (const headers of [
    {},
    { origin: 'http://[::1]:3080', host: '[::1]:3080' },
    { origin: 'http://localhost:3080', host: 'localhost:3080' },
    { origin: 'http://127.1.2.3:3080', host: '127.1.2.3:3080' },
    { origin: 'http://127.0.0.1:3080' },
    { origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' },
  ]) {
    assert.equal((await h.request('/_xlate/config', POST_BODIES['/_xlate/config'], headers)).status, 200, JSON.stringify(headers))
    assert.equal((await h.request('/_xlate/translate', POST_BODIES['/_xlate/translate'], headers)).body.ok, true, JSON.stringify(headers))
  }
  assert.equal((await h.disk()).providers.custom.model, 'second')
})

it('accepts the listener bind address as a Host, and no other non-loopback one, when the host has no connection service', async t => {
  for (const [bindHost, authority] of [['10.0.0.7', '10.0.0.7:3080'], ['fd00::7', '[fd00::7]:3080']]) {
    const h = await host(t, config(), { bindHost })
    h.plugin.ADAPTERS.openai = async () => '第一段译文'
    for (const headers of [{ host: authority }, { origin: 'http://' + authority, host: authority }]) {
      assert.equal((await h.request('/_xlate/translate', POST_BODIES['/_xlate/translate'], headers)).body.ok, true, JSON.stringify(headers))
    }
    assert.equal((await h.request('/_xlate/translate', POST_BODIES['/_xlate/translate'], { origin: 'http://10.0.0.8:3080', host: '10.0.0.8:3080' })).status, 403)
  }
})

// Answers as the service does: 403 for a Host or Origin it does not accept, then 401 unless the login cookie is the valid one.
const connectionWithLogin = { requestRejection: req => {
  const host = req.headers.host, origin = req.headers.origin
  if (!/^127\.0\.0\.1(:\d+)?$/.test(host) && host !== 'dsh.example' && host !== 'dsh.example:443') return 403
  if (origin !== undefined && new URL(origin).host !== new URL(new URL(origin).protocol + '//' + host).host) return 403
  return req.headers.cookie === 'session=fixture' || req.headers.cookie === 'host=fixture' ? undefined : 401
} }

it('takes the Host decision from the connection service, and POST routes do not ask for its login cookie', async t => {
  const h = await host(t, config(), { connection: connectionWithLogin })
  h.plugin.ADAPTERS.openai = async () => '第一段译文'
  for (const headers of [
    {},
    { host: 'dsh.example' },
    { origin: 'https://dsh.example', host: 'dsh.example' },
    { origin: 'https://dsh.example', host: 'dsh.example:443' },
    { origin: 'https://dsh.example', host: 'dsh.example', cookie: 'session=fixture' },
  ]) {
    assert.equal((await h.request('/_xlate/translate', POST_BODIES['/_xlate/translate'], headers)).body.ok, true, JSON.stringify(headers))
  }
  for (const headers of [
    { origin: 'http://review.invalid', host: 'review.invalid' },
    { host: 'review.invalid' },
    { host: '127.0.0.2:3080' },
    { origin: 'https://other.invalid', host: 'dsh.example' },
    { origin: 'https://other.invalid', host: 'dsh.example', cookie: 'session=fixture' },
    { 'sec-fetch-site': 'cross-site', host: 'dsh.example', cookie: 'session=fixture' },
  ]) {
    assert.equal((await h.request('/_xlate/translate', POST_BODIES['/_xlate/translate'], headers)).status, 403, JSON.stringify(headers))
    assert.equal((await h.request('/_xlate/dsh-scan', undefined, headers)).status, 403, JSON.stringify(headers))
  }
})

it('asks GET /_xlate/dsh-scan for the host login, and writes nothing without it', async t => {
  const h = await host(t, config(), { connection: connectionWithLogin })
  const before = await h.disk()
  for (const headers of [
    // What a cross-site <img> sends over plain http: no Origin, no Fetch Metadata and, under SameSite=Strict, no cookie.
    {},
    { host: 'dsh.example' },
    { host: 'dsh.example:443' },
    { origin: 'https://dsh.example', host: 'dsh.example' },
    { 'sec-fetch-site': 'same-origin', host: 'dsh.example' },
    // A cookie another app on this host left behind is not the login.
    { host: 'dsh.example', cookie: 'unrelated=1' },
  ]) {
    const response = await h.request('/_xlate/dsh-scan', undefined, headers)
    assert.equal(response.status, 401, JSON.stringify(headers))
    assert.equal(response.body.ok, false, JSON.stringify(headers))
    assert.deepEqual(await h.disk(), before, JSON.stringify(headers))
    assert.equal(h.keys.size, 0, JSON.stringify(headers))
  }
  // The same fixture with the login saves the config and moves its key, so the checks above can fail.
  assert.equal((await h.request('/_xlate/dsh-scan', undefined, { host: 'dsh.example', cookie: 'session=fixture' })).status, 200)
  assert.notDeepEqual(await h.disk(), before)
  assert.equal(h.keys.size, 1)
})

it('lets the panel scan through the desktop shell forwarder, which attaches the host login', async t => {
  const routes = new Map()
  const h = await host(t, config(), { routes, connection: connectionWithLogin })
  const server = http.createServer((req, res) => routes.get(req.url)(req, res))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const url = 'http://127.0.0.1:' + server.address().port + '/_xlate/dsh-scan'
  const before = await h.disk()

  assert.equal((await fetch(url)).status, 401)
  assert.deepEqual(await h.disk(), before)

  // What the forwarder does: it drops these headers, attaches the login, and fetch fills in the target's Host.
  const forwarded = new Headers({ origin: 'dsh-app://app', 'sec-fetch-site': 'same-origin' })
  for (const name of ['host', 'origin', 'cookie', 'sec-fetch-site']) forwarded.delete(name)
  forwarded.set('cookie', 'host=fixture')
  assert.equal((await fetch(url, { headers: forwarded, redirect: 'manual' })).status, 200)
  assert.notDeepEqual(await h.disk(), before)
})

it('answers 403 on GET /_xlate/dsh-scan unless the request is same-origin, and then writes nothing', async t => {
  const h = await host(t, config())
  const before = await h.disk()
  for (const headers of NOT_SAME_ORIGIN) {
    assert.equal((await h.request('/_xlate/dsh-scan', undefined, headers)).status, 403, JSON.stringify(headers))
    assert.deepEqual(await h.disk(), before, JSON.stringify(headers))
    assert.equal(h.keys.size, 0, JSON.stringify(headers))
  }
  // An accepted scan of the same fixture saves the config and moves its key, so the checks above can fail.
  assert.equal((await h.request('/_xlate/dsh-scan')).status, 200)
  assert.notDeepEqual(await h.disk(), before)
  assert.equal(h.keys.size, 1)
})

it('decides on the headers a real listener receives', async t => {
  const routes = new Map()
  const h = await host(t, config(), { routes })
  h.plugin.ADAPTERS.openai = async () => '第一段译文'
  const server = http.createServer((req, res) => routes.get(req.url)(req, res))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const port = server.address().port
  const body = JSON.stringify(POST_BODIES['/_xlate/translate'])

  // What the desktop shell's forwarder does: it drops these headers and fetch fills in the target's Host.
  const forwarded = new Headers({ origin: 'dsh-app://app', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' })
  for (const name of ['host', 'origin', 'cookie', 'sec-fetch-site']) forwarded.delete(name)
  forwarded.set('cookie', 'host=fixture')
  const response = await fetch('http://127.0.0.1:' + port + '/_xlate/translate', { method: 'POST', headers: forwarded, body, redirect: 'manual' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)

  const status = headers => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/_xlate/translate', method: 'POST', headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.on('error', reject)
    req.end(body)
  })
  assert.equal(await status({ Origin: 'http://127.0.0.1:' + port }), 200)
  assert.equal(await status({ Host: 'review.invalid', Origin: 'http://review.invalid' }), 403)
  assert.equal(await status({ Host: 'review.invalid' }), 403)
})
