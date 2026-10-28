import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalModelLifecycle, modelKeepAlive } from '../lib/local-model.js'
import { normalizeConfigPatch, viaLocalOllama } from '../lib/index.js'

const provider = { type: 'openai', baseURL: 'http://localhost:11434/v1', model: 'chosen' }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(options = {}) {
  const loaded = new Set(['chosen:latest', 'other:latest'])
  const calls = []
  let prepareDone = Promise.resolve()
  const api = createLocalModelLifecycle({
    preparation: {
      ensure: async (provider, policy) => {
        calls.push({ prepare: provider.model, options: policy })
        if (options.loadFailure) throw new Error('load failed')
        loaded.add(provider.model + ':latest')
      },
      whenIdle: () => prepareDone,
    },
    json: async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith('/api/ps')) return { models: [...loaded].map(name => ({ name, size: 100, size_vram: 80 })) }
      const body = JSON.parse(init.body)
      assert.equal(body.keep_alive, 0)
      if (options.unloadFailure) throw new Error('unload failed')
      loaded.delete(body.model + ':latest')
      return { done: true }
    },
  })
  async function finish(job) {
    for (let n = 0; n < 30; n++) {
      if (!api.snapshot(job.id).running) return api.snapshot(job.id)
      await tick()
    }
    throw new Error('release did not finish')
  }
  return { api, loaded, calls, finish, pendingPreparation: promise => { prepareDone = promise } }
}

describe('local model memory lifecycle', () => {
  it('releases the prior selected model when its provider is disabled without loading on re-enable', async () => {
    const f = fixture()
    const released = f.api.configChanged({ ...provider, enabled: true }, { ...provider, enabled: false })
    assert.equal((await f.finish(released)).phase, 'unloaded')
    assert.equal((await f.api.status(provider)).loaded, false)
    assert.equal(f.api.configChanged({ ...provider, enabled: false }, { ...provider, enabled: true }), null)
    assert.equal(f.calls.some(call => call.prepare), false)
    assert.equal(f.api.configChanged({ ...provider, enabled: true }, { ...provider, enabled: true }), null)
    assert.equal(f.api.configChanged({ ...provider, enabled: true, model: '' }, { ...provider, enabled: false }), null)
    assert.ok(f.loaded.has('other:latest'))
  })
  it('reports an unload failure without claiming the resident model was released', async () => {
    const f = fixture({ unloadFailure: true })
    const result = await f.finish(f.api.release(provider))
    assert.equal(result.phase, 'error')
    assert.equal(result.error, 'unload failed')
    assert.equal((await f.api.status(provider)).loaded, true)
    assert.equal(f.api.isReleasing(provider), false)
  })
  it('does not leak a lease after preparation fails', async () => {
    const f = fixture({ loadFailure: true })
    await assert.rejects(f.api.acquire(provider), /load failed/)
    assert.equal((await f.api.status(provider)).active, 0)
    assert.equal((await f.finish(f.api.release(provider))).phase, 'unloaded')
  })
  it('sends the idle policy with every native translation, including when automatic release is off', async t => {
    const requests = []
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ message: { content: '译文' } }))
    })
    assert.equal(await viaLocalOllama('Original', 'zh-CN', provider, { idleMinutes: 1 }), '译文')
    await viaLocalOllama('Another', 'zh-CN', provider, { idleMinutes: 0 })
    assert.equal(requests[0].url, 'http://localhost:11434/api/chat')
    assert.equal(requests[0].body.keep_alive, 60)
    assert.equal(requests[1].body.keep_alive, -1)
    assert.equal(requests[0].body.messages[1].content.includes('Original'), true)
  })
  it('uses a five-minute idle default, supports never, and validates persisted settings', () => {
    assert.equal(modelKeepAlive(), 300)
    assert.equal(modelKeepAlive({ idleMinutes: 0 }), -1)
    assert.equal(modelKeepAlive({ idleMinutes: 30 }), 1800)
    for (const value of [-1, 1.5, '5', null, 1441]) {
      assert.throws(() => normalizeConfigPatch({ localModel: { idleMinutes: value } }, {}), /idleMinutes/)
    }
    assert.deepEqual(normalizeConfigPatch({ localModel: { idleMinutes: 0 } }, {}), { localModel: { idleMinutes: 0 } })
  })
  it('releases just the selected resident model and reads status without loading anything', async () => {
    const f = fixture()
    assert.equal((await f.api.status(provider)).loaded, true)
    assert.equal((await f.finish(f.api.release(provider))).phase, 'unloaded')
    assert.equal((await f.api.status(provider)).loaded, false)
    assert.ok(f.loaded.has('other:latest'))
    assert.equal(f.calls.some(call => call.prepare), false)
  })
  it('releases an unloaded model without loading it', async () => {
    const f = fixture()
    f.loaded.delete('chosen:latest')
    assert.equal((await f.finish(f.api.release(provider))).phase, 'unloaded')
    assert.equal(f.calls.some(call => call.prepare || call.url.endsWith('/api/generate')), false)
  })
  it('waits for every active translation and lets the next request reload with its idle policy', async () => {
    const f = fixture()
    const first = await f.api.acquire(provider, { idleMinutes: 1 })
    const second = await f.api.acquire(provider, { idleMinutes: 1 })
    const release = f.api.release(provider)
    assert.equal(f.api.release(provider).id, release.id)
    let resumed = false
    const next = f.api.acquire(provider, { idleMinutes: 10 }).then(done => { resumed = true; return done })
    await tick()
    first(); first()
    await tick()
    assert.equal(resumed, false)
    assert.equal(f.calls.some(call => call.url?.endsWith('/api/generate')), false)
    second()
    const done = await next
    assert.equal(f.api.snapshot(release.id).phase, 'unloaded')
    assert.equal(f.calls.filter(call => call.prepare).at(-1).options.keepAlive, 600)
    assert.equal((await f.api.status(provider)).active, 1)
    done()
    assert.equal((await f.api.status(provider)).active, 0)
  })
  it('waits for preparation in progress before releasing', async () => {
    const f = fixture()
    let complete
    f.pendingPreparation(new Promise(resolve => { complete = resolve }))
    const release = f.api.release(provider)
    await tick()
    assert.equal(f.calls.some(call => call.url?.endsWith('/api/generate')), false)
    complete()
    assert.equal((await f.finish(release)).phase, 'unloaded')
  })
  it('rejects memory operations for remote or arbitrary local services', () => {
    const f = fixture()
    for (const baseURL of ['https://api.example.com/v1', 'http://localhost:3000/v1']) {
      assert.throws(() => f.api.release({ ...provider, baseURL }), /local Ollama/)
    }
  })
})
