import { it } from 'node:test'
import assert from 'node:assert/strict'
import { prepareCredentials, applyCredentialEdits } from '../lib/credentials.js'
import { officialTranslationState, translationNamespace } from '../lib/runtime-state.js'
import { applyFullProviders, stripResolvedKeys } from '../lib/index.js'

it('moves literal keys into DSH without mutating the input or exposing resolved keys', async () => {
  const keys = new Map()
  const input = { providers: { custom: { apiKey: 'private-custom' }, inherited: { source: 'dsh', apiKey: 'private-dsh' },
    env: { apiKeyEnv: 'MY_KEY', apiKey: 'private-env' } } }
  const result = await prepareCredentials(input, { set: async (ref, value) => keys.set(ref, value) })
  assert.equal(keys.size, 1)
  assert.equal(keys.get(result.config.providers.custom.apiKeyRef), 'private-custom')
  assert.equal(JSON.stringify(result.config).includes('private-'), false)
  assert.equal(JSON.stringify(stripResolvedKeys(input)).includes('private-'), false)
  assert.equal(input.providers.custom.apiKey, 'private-custom')
})

it('rolls back newly created references on storage failure and hides provider error text', async () => {
  const keys = new Map()
  let writes = 0
  await assert.rejects(prepareCredentials({ providers: { first: { apiKey: 'first-secret' }, second: { apiKey: 'second-secret' } } }, {
    set: async (ref, value) => { if (++writes === 2) throw new Error('second-secret'); keys.set(ref, value) },
    unset: async ref => keys.delete(ref),
  }), error => !error.message.includes('secret') && /Unable to save API key/.test(error.message))
  assert.equal(keys.size, 0)
})

it('refuses plaintext persistence when DSH storage is unavailable', async () => {
  await assert.rejects(prepareCredentials({ providers: { custom: { apiKey: 'private' } } }, null), /Unable to save API key/)
  const result = await prepareCredentials({ providers: { custom: { apiKeyEnv: 'EXISTING_KEY' } } }, null)
  assert.equal(result.config.providers.custom.apiKeyEnv, 'EXISTING_KEY')
})

it('preserves masked keys across full-map edits and honors explicit deletion only', () => {
  const live = { providers: { a: { type: 'openai', apiKeyRef: 'owned-a' }, b: { type: 'openai', apiKeyRef: 'owned-b' } } }
  const next = { providers: applyFullProviders(live, { a: { type: 'openai', model: 'new' }, b: { type: 'openai' } }) }
  assert.equal(next.providers.a.apiKeyRef, 'owned-a')
  assert.equal(next.providers.b.apiKeyRef, 'owned-b')
  applyCredentialEdits(next, { providers: { a: { apiKey: null } } })
  assert.equal(next.providers.a.apiKeyRef, undefined)
  assert.equal(next.providers.b.apiKeyRef, 'owned-b')
  applyCredentialEdits(next, { providers: { b: { apiKeyRef: 'forged' } } })
  assert.equal(next.providers.b.apiKeyRef, 'owned-b')
})

it('changes cache namespaces for model, routing, key reference and recipe settings', () => {
  const cfg = { chain: ['a'], fallback: { enabled: false, chain: ['b'] }, providers: { a: { enabled: true, type: 'openai', model: 'first', apiKeyRef: 'key-a' } } }
  const initial = translationNamespace(cfg)
  for (const change of [c => c.providers.a.model = 'second', c => c.chain = [], c => c.fallback.enabled = true,
    c => c.providers.a.enabled = false, c => c.providers.a.apiKeyRef = 'key-b']) {
    const next = structuredClone(cfg)
    change(next)
    assert.notEqual(translationNamespace(next), initial)
  }
  assert.notEqual(translationNamespace(cfg, 1), initial)
  assert.equal(translationNamespace({ ...cfg, localModel: { idleMinutes: 10 } }), initial)
})

it('detects effective official enablement without confusing installation, disabled groups or failed fibers', () => {
  const name = '@deepseek-ai/dsh-experimental-client-ui-cot-translation'
  let rows = []
  const ctx = { get: key => key === 'loader' ? { entries: () => rows } : undefined }
  assert.equal(officialTranslationState(ctx).officialEnabled, false)
  for (const entry of [{ disabled: true, fiber: { state: 2 } }, { disabled: false, fiber: { state: 3 } }, { disabled: false, fiber: { state: 4 } }]) {
    rows = [{ options: { name }, ...entry }]
    assert.equal(officialTranslationState(ctx).officialEnabled, false)
  }
  rows = [{ options: { name }, disabled: false, fiber: { state: 2 } }]
  assert.equal(officialTranslationState(ctx).officialEnabled, true)
  assert.equal(officialTranslationState({ get: key => key === 'cotTranslation' ? {} : undefined }).officialEnabled, true)
  assert.equal(officialTranslationState(null).conflictDetection, 'unavailable')
})
