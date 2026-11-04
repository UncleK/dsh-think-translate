import { randomUUID } from 'node:crypto'

const OWN_REF = /^DSH_XLATE_[A-F0-9]{32}$/

/** Store manually entered keys with DSH; configuration contains references only. */
export async function prepareCredentials(config, credentials) {
  const next = JSON.parse(JSON.stringify(config))
  const created = []
  try {
    for (const [id, p] of Object.entries(next.providers || {})) {
      delete p.hasApiKey
      if (p.source === 'dsh' || p.apiKeyEnv) {
        delete p.apiKey
        delete p.apiKeyRef
        continue
      }
      if (typeof p.apiKey === 'string' && p.apiKey) {
        // Ollama's compatibility placeholder is not a credential.
        if (!(id === 'openai' && p.apiKey === 'ollama-local' && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(p.baseURL || ''))) {
          if (!credentials?.set) throw new Error('DSH credential storage is unavailable; use an existing credential reference instead')
          const ref = 'DSH_XLATE_' + randomUUID().replaceAll('-', '').toUpperCase()
          await credentials.set(ref, p.apiKey)
          created.push(ref)
          p.apiKeyRef = ref
        }
      }
      delete p.apiKey
    }
    return { config: next, created }
  } catch (_error) {
    await discardCredentials(created, credentials)
    // Storage/provider errors can contain secrets. Never forward their text.
    throw new Error('Unable to save API key in DSH credential storage; configuration was not changed')
  }
}

/** Remove only references created and owned by this plugin. */
export async function discardCredentials(refs, credentials) {
  if (!credentials?.unset) return
  await Promise.allSettled(refs.filter(ref => OWN_REF.test(ref)).map(ref => credentials.unset(ref)))
}

/** Apply explicit key replacement/deletion while preserving omitted, masked fields. */
export function applyCredentialEdits(next, patch) {
  const fields = patch?.providers?._full?._full === true ? patch.providers._full : patch?.providers
  for (const [id, p] of Object.entries(fields || {})) {
    if (!p || typeof p !== 'object' || !next.providers?.[id] || next.providers[id].source === 'dsh') continue
    if (Object.hasOwn(p, 'apiKey') || (typeof p.apiKeyEnv === 'string' && p.apiKeyEnv)) delete next.providers[id].apiKeyRef
  }
}

export function ownedCredentialRefs(config) {
  return Object.values(config?.providers || {}).map(p => p.apiKeyRef).filter(ref => typeof ref === 'string' && OWN_REF.test(ref))
}
