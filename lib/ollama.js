// Local Ollama preparation: asynchronous, observable, and reusable by config
// changes and explicit provider tests. Dependencies are injected for offline tests.
export function ollamaOrigin(id, provider) {
  if (id !== 'openai' || !provider || provider.type !== 'openai') return null
  try {
    const url = new URL(provider.baseURL)
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.port !== '11434' || !/^\/v1\/?$/.test(url.pathname) || url.username || url.password || url.search || url.hash) return null
    return url.origin
  } catch { return null }
}

export function localFirst(cfg) {
  const id = (cfg.chain || []).find(id => {
    const p = cfg.providers && cfg.providers[id]
    return p && (p.enabled || p.source === 'dsh')
  })
  const provider = cfg.providers && cfg.providers[id]
  return ollamaOrigin(id, provider) !== null && typeof provider.model === 'string' && !!provider.model.trim()
}

export function validOllamaSignature(report) {
  return report && report.status === 'Valid' && typeof report.subject === 'string' &&
    /(^|, )O=Ollama Inc\.(,|$)/.test(report.subject)
}

function modelKey(model) { return model.includes(':') ? model : model + ':latest' }

export function createLocalPreparation(runtime) {
  const jobs = new Map()
  const servers = new Map()
  let sequence = 0
  let latest = null
  const snapshot = id => {
    const job = id ? jobs.get(id) : latest
    if (!job) return null
    const { promise, options, ...out } = job
    return { ...out, platform: runtime.platform, canInstall: runtime.platform === 'win32' }
  }
  async function online(origin) {
    try { const version = await runtime.json(origin + '/api/version', {}, 2000); return typeof version.version === 'string' }
    catch { return false }
  }
  async function server(job, options, progress) {
    if (await online(job.origin)) return
    if (servers.has(job.origin)) return servers.get(job.origin)
    const pending = (async () => {
      let executable = await runtime.findExecutable()
      if (!executable) {
        if (!options.allowInstall || runtime.platform !== 'win32') {
          progress({ phase: 'needs_install', running: false })
          return false
        }
        await runtime.install(progress)
        executable = await runtime.findExecutable()
        if (!executable) throw new Error('Ollama installation finished but the executable was not found')
      }
      progress({ phase: 'starting', percent: null })
      await runtime.startServer(executable, job.origin)
      for (let n = 0; n < 30; n++) {
        if (await online(job.origin)) return true
        await runtime.wait(500)
      }
      throw new Error('Ollama did not become reachable after startup')
    })()
    servers.set(job.origin, pending)
    try { return await pending } finally { servers.delete(job.origin) }
  }
  async function run(job, options) {
    const progress = patch => Object.assign(job, patch, { updatedAt: Date.now() })
    try {
      if (await server(job, options, progress) === false) {
        progress({ phase: 'needs_install', running: false })
        return
      }
      const tags = await runtime.json(job.origin + '/api/tags', {}, 10000)
      const installed = (tags.models || []).some(m => typeof m.name === 'string' && modelKey(m.name) === modelKey(job.model))
      if (!installed) {
        if (!options.allowDownload) { progress({ phase: 'needs_model', running: false }); return }
        progress({ phase: 'downloading_model', completed: 0, total: 0, percent: null })
        await runtime.pull(job.origin, job.model, progress)
      }
      const loaded = await runtime.json(job.origin + '/api/ps', {}, 10000)
      if (!(loaded.models || []).some(m => modelKey(m.name || m.model || '') === modelKey(job.model))) {
        progress({ phase: 'loading_model', percent: null, completed: 0, total: 0 })
        await runtime.json(job.origin + '/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: job.model, prompt: '', stream: false, keep_alive: '10m' }),
        }, 120000)
        const verify = await runtime.json(job.origin + '/api/ps', {}, 10000)
        if (!(verify.models || []).some(m => modelKey(m.name || m.model || '') === modelKey(job.model))) {
          throw new Error('Ollama did not report the selected model as loaded')
        }
      }
      progress({ phase: 'ready', running: false, percent: 100, error: null })
    } catch (error) {
      progress({ phase: 'error', running: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
  function start(provider, options = {}) {
    const origin = ollamaOrigin('openai', provider)
    const model = typeof provider?.model === 'string' ? provider.model.trim() : ''
    if (!origin || !model) throw new Error('A local Ollama endpoint and model are required')
    // No automatic installation or model download: the setup button grants both.
    const allowed = { allowInstall: options.allowInstall === true, allowDownload: options.allowDownload === true }
    const busy = [...jobs.values()].find(j => j.running && j.origin === origin && j.model === model)
    if (busy) {
      busy.options.allowInstall ||= allowed.allowInstall
      busy.options.allowDownload ||= allowed.allowDownload
      return snapshot(busy.id)
    }
    const job = { id: String(++sequence), origin, model, phase: 'checking', running: true,
      percent: null, completed: 0, total: 0, error: null, updatedAt: Date.now() }
    job.options = allowed
    latest = job
    jobs.set(job.id, job)
    job.promise = Promise.resolve().then(() => run(job, allowed))
    if (jobs.size > 30) for (const [id, old] of jobs) {
      if (!old.running && old !== latest) { jobs.delete(id); break }
    }
    return snapshot(job.id)
  }
  async function ensure(provider) {
    const result = start(provider)
    const job = jobs.get(result.id)
    await job.promise
    if (job.phase !== 'ready') throw new Error(job.error || (job.phase === 'needs_install'
      ? 'Ollama is not installed; use the local setup button' : 'Selected model is not downloaded; use the local setup button'))
    return snapshot(job.id)
  }
  return { start, snapshot, ensure }
}
