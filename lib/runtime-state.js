import { createHash } from 'node:crypto'
import { BUILTIN_GLOSSARY } from './glossary-presets.js'

const builtinRevision = createHash('sha256').update(JSON.stringify(BUILTIN_GLOSSARY)).digest('hex')

/** Revision of translation-affecting settings, without disclosing key values. */
export function translationNamespace(config, credentialRevision = 0) {
  const providers = Object.keys(config.providers || {}).sort().map(id => {
    const p = config.providers[id]
    return [id, p.type, p.enabled, p.source, p.baseURL, p.model, p.apiKeyEnv, p.apiKeyRef]
  })
  return createHash('sha256').update(JSON.stringify(['protected-v5-cjk-boundaries', config.chain, config.fallback, providers, config.glossary,
    config.glossary?.builtin === true ? builtinRevision : null, credentialRevision])).digest('hex')
}

/** Effective Loader state, not mere installation, determines mutual exclusion. */
export function officialTranslationState(ctx) {
  const loader = ctx?.get?.('loader')
  if (loader?.entries) {
    const official = new Set(['@deepseek-ai/dsh-experimental-client-ui-cot-translation'])
    for (const entry of loader.entries()) {
      if (official.has(entry.options?.name) && !entry.disabled && ![3, 4, 5].includes(entry.fiber?.state)) {
        return { officialEnabled: true, conflictDetection: 'available' }
      }
    }
    return { officialEnabled: !!ctx.get('cotTranslation'), conflictDetection: 'available' }
  }
  return { officialEnabled: !!ctx?.get?.('cotTranslation'), conflictDetection: 'unavailable' }
}
