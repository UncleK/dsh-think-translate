// Owns this plugin's uses of the selected Ollama model. Ollama owns the idle
// countdown; a release waits for this plugin's active translations to finish.
import { ollamaOrigin } from './ollama.js'

export function modelKeepAlive(policy) {
  const minutes = policy?.idleMinutes === undefined ? 5 : policy.idleMinutes
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new Error('idleMinutes must be an integer from 0 to 1440')
  return minutes === 0 ? -1 : minutes * 60
}

const modelKey = name => name.includes(':') ? name : name + ':latest'

export function createLocalModelLifecycle(runtime) {
  const models = new Map()
  const jobs = new Map()
  let sequence = 0
  let latest = null
  function entry(provider) {
    const origin = ollamaOrigin('openai', provider)
    const model = provider?.model?.trim()
    if (!origin || !model) throw new Error('A local Ollama endpoint and model are required')
    const key = origin + '|' + modelKey(model)
    if (!models.has(key)) models.set(key, { origin, model, active: 0, release: null, drained: null })
    return models.get(key)
  }
  const snapshot = id => {
    const job = id ? jobs.get(id) : latest
    if (!job) return null
    const { promise, ...publicJob } = job
    return { ...publicJob }
  }
  async function status(provider) {
    const model = entry(provider)
    const result = await runtime.json(model.origin + '/api/ps', {}, 3000)
    const loaded = (result.models || []).find(item => modelKey(item.name || item.model || '') === modelKey(model.model))
    return { model: model.model, origin: model.origin, loaded: !!loaded, active: model.active,
      expiresAt: loaded?.expires_at ?? null, sizeBytes: loaded?.size ?? 0, vramBytes: loaded?.size_vram ?? 0 }
  }
  async function acquire(provider, policy) {
    const model = entry(provider)
    while (model.release) await model.release
    model.active++
    let ended = false
    const done = () => {
      if (ended) return
      ended = true
      model.active--
      if (!model.active && model.drained) { model.drained(); model.drained = null }
    }
    try { await runtime.preparation.ensure(provider, { keepAlive: modelKeepAlive(policy) }) }
    catch (error) { done(); throw error }
    return done
  }
  function release(provider) {
    const model = entry(provider)
    if (model.release) return snapshot(model.job.id)
    const job = { id: 'release-' + (++sequence), origin: model.origin, model: model.model,
      phase: model.active ? 'waiting_idle' : 'unloading_model', running: true, percent: null, error: null, updatedAt: Date.now() }
    const progress = patch => Object.assign(job, patch, { updatedAt: Date.now() })
    latest = job
    model.job = job
    jobs.set(job.id, job)
    model.release = job.promise = Promise.resolve().then(async () => {
      try {
        if (model.active) await new Promise(resolve => { model.drained = resolve })
        await runtime.preparation.whenIdle(provider)
        progress({ phase: 'unloading_model' })
        const current = await status(provider)
        if (current.loaded) {
          await runtime.json(model.origin + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model.model, prompt: '', stream: false, keep_alive: 0 }) }, 120000)
          if ((await status(provider)).loaded) throw new Error('Ollama still reports this model as loaded')
        }
        progress({ phase: 'unloaded', running: false, percent: 100 })
      } catch (error) {
        progress({ phase: 'error', running: false, error: error instanceof Error ? error.message : String(error) })
      } finally { model.release = null }
    })
    if (jobs.size > 30) for (const [id, old] of jobs) {
      if (!old.running && old !== latest) { jobs.delete(id); break }
    }
    return snapshot(job.id)
  }
  function configChanged(before, after) {
    if (before?.enabled && !after?.enabled && ollamaOrigin('openai', before) && typeof before.model === 'string' && before.model.trim()) return release(before)
    return null
  }
  return { acquire, release, status, snapshot, configChanged, isReleasing: provider => !!entry(provider).release }
}
