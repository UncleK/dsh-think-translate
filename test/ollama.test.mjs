import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalPreparation, ollamaOrigin, localFirst, validOllamaSignature } from '../lib/ollama.js'
import { streamModelPull } from '../lib/index.js'

const provider = { type: 'openai', enabled: true, baseURL: 'http://localhost:11434/v1', model: 'test-model' }
function fixture(options = {}) {
  let online = options.online !== false, installed = options.installed !== false, loaded = options.loaded === true
  let executable = options.executable !== false
  const calls = []
  const runtime = {
    platform: options.platform || 'win32', wait: async () => {},
    json: async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith('/api/version')) { if (!online) throw new Error('offline'); return { version: '1' } }
      if (url.endsWith('/api/tags')) return { models: installed ? [{ name: 'test-model:latest' }] : [] }
      if (url.endsWith('/api/ps')) return { models: loaded ? [{ name: 'test-model:latest' }] : [] }
      if (url.endsWith('/api/generate')) {
        if (options.loadFailure) throw new Error('not enough memory')
        loaded = true
        return { done: true }
      }
      throw new Error('unexpected endpoint')
    },
    findExecutable: async () => { calls.push({ action: 'find' }); return executable ? '/installed/ollama' : null },
    startServer: async () => { calls.push({ action: 'start' }); online = true },
    install: async progress => {
      calls.push({ action: 'install' }); progress({ phase: 'downloading_ollama', percent: 42 })
      if (options.installFailure) throw new Error('installer signature verification failed')
      executable = true
    },
    pull: async (origin, model, progress) => {
      calls.push({ action: 'pull', model }); progress({ completed: 50, total: 100, percent: 50 })
      if (options.pullFailure) throw new Error('download interrupted')
      installed = true
    },
  }
  const preparation = createLocalPreparation(runtime)
  async function finish(id) {
    for (let i = 0; i < 100; i++) {
      const status = preparation.snapshot(id)
      if (!status.running) return status
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    throw new Error('preparation did not finish')
  }
  return { preparation, calls, finish }
}

describe('local Ollama preparation', () => {
  it('requires a valid installer signature from the exact Ollama organization', () => {
    assert.equal(validOllamaSignature({ status: 'Valid', subject: 'CN=Ollama Inc., O=Ollama Inc., C=US' }), true)
    assert.equal(validOllamaSignature({ status: 'Valid', subject: 'O=Not Ollama Inc., C=US' }), false)
    assert.equal(validOllamaSignature({ status: 'NotSigned', subject: 'O=Ollama Inc.' }), false)
    assert.equal(validOllamaSignature({ status: 'Valid', subject: null }), false)
  })
  it('reports byte progress from fragmented model download events including the final unterminated event', async t => {
    const text = '{"digest":"a","total":100,"completed":50}\n{"digest":"a","total":100,"completed":100}\n{"status":"success"}'
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(text.slice(0, 24)))
      controller.enqueue(new TextEncoder().encode(text.slice(24)))
      controller.close()
    } })))
    const progress = []
    await streamModelPull('http://localhost:11434', 'test-model', p => progress.push(p))
    assert.ok(progress.some(p => p.completed === 50 && p.total === 100 && p.percent === 50))
    assert.equal(progress[progress.length - 1].percent, 100)
  })
  it('preserves the Ollama download error instead of claiming completion', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"model manifest not found"}\n'))
    await assert.rejects(streamModelPull('http://localhost:11434', 'test-model', () => {}), /model manifest not found/)
  })
  it('accepts only the built-in direct loopback Ollama endpoint', () => {
    assert.equal(ollamaOrigin('openai', provider), 'http://localhost:11434')
    for (const baseURL of ['https://localhost:11434/v1', 'http://example.com:11434/v1', 'http://localhost:8080/v1', 'http://localhost:11434/proxy/v1']) {
      assert.equal(ollamaOrigin('openai', { ...provider, baseURL }), null)
    }
    assert.equal(ollamaOrigin('custom', provider), null)
  })
  it('prepares the first enabled provider only', () => {
    assert.equal(localFirst({ chain: ['google', 'openai'], providers: { google: { enabled: false }, openai: provider } }), true)
    assert.equal(localFirst({ chain: ['google', 'openai'], providers: { google: { enabled: true }, openai: provider } }), false)
    assert.equal(localFirst({ chain: ['openai'], providers: { openai: { ...provider, enabled: false } } }), false)
    assert.equal(localFirst({ chain: ['openai'], providers: { openai: { ...provider, model: '' } } }), false)
  })
  it('reuses a running service and an already loaded model', async () => {
    const f = fixture({ loaded: true })
    await f.preparation.ensure(provider)
    assert.equal(f.calls.some(c => c.action || c.url?.endsWith('/api/generate')), false)
  })
  it('finds an existing installation, starts it once, and loads without downloading', async () => {
    const f = fixture({ online: false })
    const first = f.preparation.start(provider), second = f.preparation.start(provider)
    assert.equal(first.id, second.id)
    assert.equal((await f.finish(first.id)).phase, 'ready')
    assert.equal(f.calls.filter(c => c.action === 'start').length, 1)
    assert.equal(f.calls.some(c => c.action === 'install' || c.action === 'pull'), false)
    const request = f.calls.find(c => c.url?.endsWith('/api/generate'))
    assert.equal(JSON.parse(request.init.body).prompt, '')
  })
  it('does not install absent software without the setup action', async () => {
    const f = fixture({ online: false, executable: false })
    assert.equal((await f.finish(f.preparation.start(provider).id)).phase, 'needs_install')
    assert.equal(f.calls.some(c => c.action === 'install'), false)
  })
  it('does not download an absent model without the setup action', async () => {
    const f = fixture({ installed: false })
    assert.equal((await f.finish(f.preparation.start(provider).id)).phase, 'needs_model')
    assert.equal(f.calls.some(c => c.action === 'pull'), false)
  })
  it('installs, downloads, and loads after the explicit setup action', async () => {
    const f = fixture({ online: false, executable: false, installed: false })
    const job = f.preparation.start(provider, { allowInstall: true, allowDownload: true })
    assert.equal((await f.finish(job.id)).phase, 'ready')
    assert.deepEqual(f.calls.filter(c => c.action).map(c => c.action), ['find', 'install', 'find', 'start', 'pull'])
  })
  it('merges an explicit setup request into an automatic preparation already in progress', async () => {
    const f = fixture({ online: false, executable: false, installed: false })
    const first = f.preparation.start(provider)
    const setup = f.preparation.start(provider, { allowInstall: true, allowDownload: true })
    assert.equal(first.id, setup.id)
    assert.equal((await f.finish(setup.id)).phase, 'ready')
    assert.equal(f.calls.filter(c => c.action === 'install').length, 1)
  })
  for (const failure of ['installFailure', 'pullFailure', 'loadFailure']) {
    it('surfaces ' + failure + ' without claiming readiness', async () => {
      const f = fixture({ online: false, executable: false, installed: false, [failure]: true })
      const job = await f.finish(f.preparation.start(provider, { allowInstall: true, allowDownload: true }).id)
      assert.equal(job.phase, 'error')
      assert.ok(job.error)
    })
  }
  it('supports service/model reuse on macOS without offering Windows installation', async () => {
    const f = fixture({ online: false, executable: false, platform: 'darwin' })
    const job = await f.finish(f.preparation.start(provider, { allowInstall: true }).id)
    assert.equal(job.phase, 'needs_install')
    assert.equal(job.canInstall, false)
    assert.equal(f.calls.some(c => c.action === 'install'), false)
  })
})
