import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { translationLanguageError } from '../lib/index.js'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))) }
function client(storage = new Map()) {
  let context = { cacheNamespace: 'model-a', officialEnabled: false }
  let translate = async () => ({ ok: true, text: '第一段译文', cacheNamespace: context.cacheNamespace })
  let calls = 0
  const box = vm.createContext({ Map, Date, Promise, translationLanguageError, needsTranslate: () => true,
    fnv: value => value, recordCheck: () => {}, sleepMs: async () => {},
    localStorage: { get length() { return storage.size }, key: i => [...storage.keys()][i],
      getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetchWithTimeout: async (url, options) => {
      assert.ok(['/_xlate/context', '/_xlate/translate'].includes(url))
      const value = url === '/_xlate/context' ? { ...context } : (++calls, await translate(JSON.parse(options.body)))
      return { ok: true, json: async () => value }
    },
  })
  vm.runInContext(section('var mem = new Map();', 'var providerChecks = {}'), box)
  vm.runInContext(section('async function hostAttempt(', 'function useXlate('), box)
  return { box, storage, calls: () => calls, context: value => { context = value }, translate: fn => { translate = fn } }
}

it('reuses persisted translations across clients but invalidates them on a provider/model revision', async () => {
  const first = client()
  await first.box.requestTranslate('Read the build output.', 'zh-CN')
  await first.box.requestTranslate('Read the build output.', 'zh-CN')
  assert.equal(first.calls(), 1)
  const second = client(first.storage)
  await second.box.requestTranslate('Read the build output.', 'zh-CN')
  assert.equal(second.calls(), 0)
  second.context({ cacheNamespace: 'model-b', officialEnabled: false })
  second.translate(async () => ({ ok: true, text: '第二段译文', cacheNamespace: 'model-b' }))
  assert.equal((await second.box.requestTranslate('Read the build output.', 'zh-CN')).text, '第二段译文')
  assert.equal(second.calls(), 1)
})

it('ignores an old in-flight result after another window changes the model', async () => {
  const c = client()
  let release
  c.translate(() => new Promise(resolve => { release = resolve }))
  const old = c.box.requestTranslate('Read the build output.', 'zh-CN')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(c.calls(), 1)
  c.context({ cacheNamespace: 'model-b', officialEnabled: false })
  c.translate(async () => ({ ok: true, text: '第二段译文', cacheNamespace: 'model-b' }))
  assert.equal((await c.box.requestTranslate('Read the build output.', 'zh-CN')).text, '第二段译文')
  release({ ok: true, text: '过期的译文', cacheNamespace: 'model-a' })
  assert.equal((await old).stale, true)
  assert.equal([...c.storage.values()].some(value => value.includes('过期的译文')), false)
  assert.equal((await c.box.requestTranslate('Read the build output.', 'zh-CN')).text, '第二段译文')
  assert.equal(c.calls(), 2)
})

it('does not return cached translations or call a provider while official translation is enabled', async () => {
  const c = client()
  await c.box.requestTranslate('Read the build output.', 'zh-CN')
  c.context({ cacheNamespace: 'model-a', officialEnabled: true })
  assert.equal((await c.box.requestTranslate('Read the build output.', 'zh-CN')).conflict, true)
  assert.equal(c.calls(), 1)
  c.context({ cacheNamespace: 'model-a', officialEnabled: false })
  assert.equal((await c.box.requestTranslate('Read the build output.', 'zh-CN')).ok, true)
})

it('deduplicates requests and refuses results carrying a different Host namespace', async () => {
  const c = client()
  const results = await Promise.all([c.box.requestTranslate('Read the build output.', 'zh-CN'), c.box.requestTranslate('Read the build output.', 'zh-CN')])
  assert.ok(results.every(result => result.ok))
  assert.equal(c.calls(), 1)
  c.context({ cacheNamespace: 'model-b', officialEnabled: false })
  c.translate(async () => ({ ok: true, text: '过期的译文', cacheNamespace: 'model-a' }))
  assert.equal((await c.box.requestTranslate('Read the build output.', 'zh-CN')).stale, true)
  assert.equal([...c.storage.values()].some(value => value.includes('过期的译文')), false)
})

it('keeps newer configuration responses authoritative over an older context read', async () => {
  const c = client()
  let release
  c.box.fetchWithTimeout = async () => ({ ok: true, json: () => new Promise(resolve => { release = resolve }) })
  const read = c.box.refreshTranslationContext()
  await new Promise(resolve => setImmediate(resolve))
  c.box.acceptTranslationContext({ cacheNamespace: 'model-b', officialEnabled: true })
  release({ cacheNamespace: 'model-a', officialEnabled: false })
  const result = await read
  assert.equal(result.cacheNamespace, 'model-b')
  assert.equal(result.officialEnabled, true)
})

it('retains original text when configuration cannot be verified', async () => {
  const c = client()
  c.box.fetchWithTimeout = async () => { throw new Error('Host is unavailable') }
  const result = await c.box.requestTranslate('Original text.', 'zh-CN')
  assert.equal(result.ok, false)
  assert.equal(result.text, 'Original text.')
  assert.equal(c.calls(), 0)
  assert.equal(c.storage.size, 0)
})

it('reuses explicitly fixed foreign-language terms without treating them as a wrong-language cache entry', async () => {
  const c = client()
  const phrase = 'This is the exact product name with English words'
  c.translate(async () => ({ ok: true, text: phrase, glossaryTargets: [phrase], cacheNamespace: 'model-a' }))
  assert.equal((await c.box.requestTranslate('Translate the product name.', 'zh-CN')).text, phrase)
  const second = client(c.storage)
  assert.equal((await second.box.requestTranslate('Translate the product name.', 'zh-CN')).text, phrase)
  assert.equal(second.calls(), 0)
})
