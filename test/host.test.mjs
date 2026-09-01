// Host-side unit tests for dsh-think-translate (lib/index.js).
//
// Uses Node's built-in test runner (node:test) and assert/strict — no external
// framework. The tests import the pure, side-effect-free helpers that the
// module exports at the bottom (marked "test exports"). Everything tested here
// is pure: no HTTP calls, no DSH file reads, no subprocess spawning.
//
// Run with: node --test test/host.test.mjs

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildChainFromPriority,
  migrateConfig,
  normalizeConfigPatch,
  applyFullProviders,
  extractDshProviders,
  extractCredRefs,
  runChainFor,
  translateViaChain,
  removeFromChain,
  needsTranslate,
  hasProse,
  chunkText,
  fnv,
  deepMerge,
  structuredCloneSafe,
} from '../lib/index.js'

// ---------------------------------------------------------------------------
// buildChainFromPriority — legacy `priority` field -> ordered chain
// ---------------------------------------------------------------------------

describe('buildChainFromPriority', function () {
  it('creates chain from priority with enabled providers', function () {
    const result = buildChainFromPriority({
      priority: 'bing',
      providers: { google: { enabled: true }, bing: { enabled: true }, openai: { enabled: false } },
    })
    assert.deepEqual(result, ['bing', 'google'])
  })

  it('defaults to google when priority missing', function () {
    const result = buildChainFromPriority({ providers: { google: { enabled: true } } })
    assert.deepEqual(result, ['google'])
  })

  it('handles empty providers', function () {
    assert.deepEqual(buildChainFromPriority({}), ['google'])
  })

  it('puts priority first even if disabled', function () {
    const result = buildChainFromPriority({
      priority: 'openai',
      providers: { google: { enabled: true }, bing: { enabled: true }, openai: { enabled: false } },
    })
    assert.deepEqual(result, ['openai', 'google', 'bing'])
  })

  it('keeps disabled providers out of the tail', function () {
    const result = buildChainFromPriority({
      priority: 'google',
      providers: { google: { enabled: true }, openai: { enabled: false } },
    })
    assert.deepEqual(result, ['google'])
  })
})

// ---------------------------------------------------------------------------
// migrateConfig — guarantees a usable chain + fallback after any load path
// ---------------------------------------------------------------------------

describe('migrateConfig', function () {
  it('fills missing chain from priority', function () {
    const cfg = { priority: 'bing', providers: { google: { enabled: true }, bing: { enabled: true } } }
    migrateConfig(cfg)
    assert.ok(Array.isArray(cfg.chain))
    assert.equal(cfg.chain[0], 'bing')
  })

  it('injects fallback when missing', function () {
    const cfg = { chain: ['google'] }
    migrateConfig(cfg)
    assert.ok(cfg.fallback)
    assert.equal(cfg.fallback.enabled, true)
    assert.deepEqual(cfg.fallback.chain, ['google', 'bing'])
  })

  it('does not modify valid chain + fallback', function () {
    const cfg = { chain: ['anthropic', 'google'], fallback: { enabled: false, chain: ['google'] } }
    migrateConfig(cfg)
    assert.deepEqual(cfg.chain, ['anthropic', 'google'])
    assert.equal(cfg.fallback.enabled, false)
    assert.deepEqual(cfg.fallback.chain, ['google'])
  })

  it('rebuilds an empty chain array', function () {
    const cfg = { chain: [], priority: 'bing', providers: { google: { enabled: true }, bing: { enabled: true } } }
    migrateConfig(cfg)
    assert.deepEqual(cfg.chain, ['bing', 'google'])
  })

  it('mutates the passed object in place', function () {
    const cfg = { chain: ['google'] }
    const returned = migrateConfig(cfg)
    assert.equal(returned, undefined) // no return value, cfg is mutated
    assert.ok(cfg.fallback)
  })
})

// ---------------------------------------------------------------------------
// normalizeConfigPatch — client config patch -> safe merge target
// ---------------------------------------------------------------------------

describe('normalizeConfigPatch', function () {
  const live = {
    chain: ['google', 'bing'],
    fallback: { enabled: true, chain: ['google', 'bing'] },
    providers: {
      google: { type: 'google', enabled: true },
      bing: { type: 'bing', enabled: true },
      openai: { type: 'openai', enabled: true, baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct', apiKey: 'ollama-local' },
    },
  }

  it('type-filters chain entries (existence check happens later in the POST handler)', function () {
    const result = normalizeConfigPatch({ chain: ['google', 'unknown', 'bing', '', 42] }, live)
    // Non-string / empty ids are dropped here; unknown-but-string ids survive
    // because a provider created in the same POST must be able to keep its
    // chain reference. Existence is re-checked against merged.providers after
    // deepMerge in the POST handler.
    assert.deepEqual(result.chain, ['google', 'unknown', 'bing'])
  })

  it('type-filters fallback chain', function () {
    const result = normalizeConfigPatch({ fallback: { enabled: false, chain: ['google', '', 'bing'] } }, live)
    assert.deepEqual(result.fallback.chain, ['google', 'bing'])
    assert.equal(result.fallback.enabled, false)
  })

  it('keeps live fallback enabled when patch omits it', function () {
    const result = normalizeConfigPatch({ fallback: { chain: ['google'] } }, live)
    assert.equal(result.fallback.enabled, true)
  })

  it('rejects DSH provider edits', function () {
    const liveWithDsh = {
      providers: {
        google: { type: 'google', enabled: true },
        linuxdo: { type: 'openai', source: 'dsh', baseURL: 'https://x/v1', model: 'm', apiKeyEnv: 'K', enabled: false },
      },
    }
    const result = normalizeConfigPatch({ providers: { linuxdo: { enabled: true } } }, liveWithDsh)
    // DSH entries are skipped entirely; the providers map comes out empty
    assert.deepEqual(result.providers, {})
  })

  it('allows toggling google enabled', function () {
    const result = normalizeConfigPatch({ providers: { google: { enabled: false } } }, live)
    assert.equal(result.providers.google.enabled, false)
  })

  it('rejects google type change (built-in type is fixed)', function () {
    const result = normalizeConfigPatch({ providers: { google: { type: 'anthropic' } } }, live)
    // google entry should only carry enabled — type is dropped
    assert.equal(result.providers.google.enabled, true)
    assert.equal(result.providers.google.type, undefined)
  })

  it('handles bing like google', function () {
    const result = normalizeConfigPatch({ providers: { bing: { enabled: false, type: 'anthropic' } } }, live)
    assert.equal(result.providers.bing.enabled, false)
    assert.equal(result.providers.bing.type, undefined)
  })

  it('accepts valid custom provider', function () {
    const result = normalizeConfigPatch({ providers: { 'my-custom': { type: 'openai', baseURL: 'https://x/v1', apiKey: 'k', model: 'm' } } }, live)
    assert.ok(result.providers['my-custom'])
    assert.equal(result.providers['my-custom'].type, 'openai')
    assert.equal(result.providers['my-custom'].baseURL, 'https://x/v1')
    assert.equal(result.providers['my-custom'].apiKey, 'k')
    assert.equal(result.providers['my-custom'].model, 'm')
    // Brand-new providers default to disabled
    assert.equal(result.providers['my-custom'].enabled, false)
  })

  it('rejects invalid type', function () {
    const result = normalizeConfigPatch({ providers: { bad: { type: 'invalid-type' } } }, live)
    assert.deepEqual(result.providers, {})
  })

  it('defaults custom provider type to openai', function () {
    const result = normalizeConfigPatch({ providers: { 'no-type': { baseURL: 'https://x/v1' } } }, live)
    assert.equal(result.providers['no-type'].type, 'openai')
  })

  it('detects _full marker', function () {
    const result = normalizeConfigPatch({ providers: { _full: { _full: true, google: { enabled: true } } } }, live)
    assert.ok(result._fullProviders)
    assert.equal(result._fullProviders._full, true)
    assert.equal(result._fullProviders.google.enabled, true)
  })

  it('enabled inheritance: partial patch without enabled keeps live state', function () {
    const liveWithDisabled = {
      ...live,
      providers: { ...live.providers, openai: { ...live.providers.openai, enabled: false } },
    }
    const result = normalizeConfigPatch({ providers: { openai: { model: 'gpt-4' } } }, liveWithDisabled)
    assert.equal(result.providers.openai.enabled, false) // inherited from live
  })

  it('enabled inheritance: explicit enabled overrides', function () {
    const liveWithDisabled = {
      ...live,
      providers: { ...live.providers, openai: { ...live.providers.openai, enabled: false } },
    }
    const result = normalizeConfigPatch({ providers: { openai: { enabled: true } } }, liveWithDisabled)
    assert.equal(result.providers.openai.enabled, true)
  })
})

// ---------------------------------------------------------------------------
// applyFullProviders — full providers-map replace (used for CRUD deletions)
// ---------------------------------------------------------------------------

describe('applyFullProviders', function () {
  const live = {
    chain: ['google', 'bing', 'openai', 'linuxdo'],
    providers: {
      google: { type: 'google', enabled: true },
      bing: { type: 'bing', enabled: true },
      openai: { type: 'openai', enabled: true, baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct', apiKey: 'ollama-local' },
      linuxdo: { type: 'openai', source: 'dsh', baseURL: 'https://x/v1', model: 'm', apiKeyEnv: 'K', enabled: false, apiKey: 'secret' },
      custom: { type: 'anthropic', enabled: true, baseURL: 'https://y/v1', apiKey: 'k', model: 'claude' },
    },
  }

  it('preserves DSH providers even when omitted from the full map', function () {
    const result = applyFullProviders(live, { google: { enabled: true }, bing: { enabled: true } })
    assert.ok(result.linuxdo)
    assert.equal(result.linuxdo.source, 'dsh')
    assert.equal(result.linuxdo.baseURL, 'https://x/v1')
  })

  it('preserves built-ins google/bing even when omitted', function () {
    const result = applyFullProviders(live, {})
    assert.ok(result.google)
    assert.equal(result.google.type, 'google')
    assert.equal(result.google.enabled, true)
    assert.ok(result.bing)
  })

  it('honors enabled toggle from full map for built-ins', function () {
    const result = applyFullProviders(live, { google: { enabled: false }, bing: { enabled: true } })
    assert.equal(result.google.enabled, false)
    assert.equal(result.bing.enabled, true)
  })

  it('deletes non-builtin, non-DSH providers omitted from the full map', function () {
    const result = applyFullProviders(live, { google: { enabled: true }, bing: { enabled: true } })
    assert.equal(result.openai, undefined) // omitted -> deleted
    assert.equal(result.custom, undefined) // omitted -> deleted
  })

  it('keeps custom providers present in the full map', function () {
    const fullMap = {
      google: { enabled: true },
      bing: { enabled: true },
      'my-custom': { type: 'openai', baseURL: 'https://z/v1', apiKey: 'kk', model: 'mm' },
    }
    const result = applyFullProviders(live, fullMap)
    assert.ok(result['my-custom'])
    assert.equal(result['my-custom'].type, 'openai')
    assert.equal(result['my-custom'].baseURL, 'https://z/v1')
    assert.equal(result['my-custom'].apiKey, 'kk')
    assert.equal(result['my-custom'].model, 'mm')
  })

  it('skips invalid custom types in the full map', function () {
    const fullMap = { google: { enabled: true }, bing: { enabled: true }, bad: { type: 'nope' } }
    const result = applyFullProviders(live, fullMap)
    assert.equal(result.bad, undefined)
  })

  it('inherits enabled state for an existing custom provider when the full map omits it', function () {
    const fullMap = { google: { enabled: true }, bing: { enabled: true }, custom: { type: 'anthropic', baseURL: 'https://y/v1' } }
    const result = applyFullProviders(live, fullMap)
    assert.equal(result.custom.enabled, true) // inherited from live
  })
})

// ---------------------------------------------------------------------------
// extractDshProviders — regex parser for settings.yaml llm-pi-ai section
// ---------------------------------------------------------------------------

describe('extractDshProviders', function () {
  const sample = [
    'top: value',
    'llm-pi-ai:',
    '  providers:',
    '    linuxdo-hub:',
    '      apiKeyEnv: LINUXDO_API_KEY',
    '      api: openai-completions',
    '      baseURL: https://api.linux.do/v1',
    '      models:',
    '        - id: gpt-4o',
    '    another:',
    '      apiKeyEnv: K2',
    '      baseURL: https://x/v1',
    '      models:',
    '        - id: m',
    '    not-compatible:',
    '      api: anthropic-messages',
    '      baseURL: https://y/v1',
    '      models:',
    '        - id: m2',
    'other: value',
  ].join('\n')

  it('extracts openai-compatible providers with their fields', function () {
    const providers = extractDshProviders(sample)
    assert.ok(providers['linuxdo-hub'])
    assert.equal(providers['linuxdo-hub'].apiKeyEnv, 'LINUXDO_API_KEY')
    assert.equal(providers['linuxdo-hub'].baseURL, 'https://api.linux.do/v1')
    assert.equal(providers['linuxdo-hub'].model, 'gpt-4o')
    assert.ok(providers.another)
    assert.equal(providers.another.apiKeyEnv, 'K2')
    assert.equal(providers.another.model, 'm')
  })

  it('skips non-openai-compatible providers', function () {
    const providers = extractDshProviders(sample)
    assert.equal(providers['not-compatible'], undefined)
  })

  it('returns empty object when the llm-pi-ai section is absent', function () {
    assert.deepEqual(extractDshProviders('llm-pi-ai-misspelled:\n  providers:\n    x: 1'), {})
  })

  it('tolerates sibling keys between llm-pi-ai and providers', function () {
    const txt = [
      'llm-pi-ai:',
      '  enabled: true',
      '  providers:',
      '    p1:',
      '      baseURL: https://x/v1',
      '      models:',
      '        - id: m',
    ].join('\n')
    const providers = extractDshProviders(txt)
    assert.ok(providers.p1)
  })

  it('returns empty object on empty input', function () {
    assert.deepEqual(extractDshProviders(''), {})
  })
})

// ---------------------------------------------------------------------------
// extractCredRefs — regex parser for .credentials.yaml refs block
// ---------------------------------------------------------------------------

describe('extractCredRefs', function () {
  it('extracts env name -> value pairs from the refs block', function () {
    const txt = [
      'somekey: value',
      'refs:',
      '  LINUXDO_API_KEY: sk-linuxdo-abc123',
      '  OTHER_KEY: some-value',
      'nextkey: value',
    ].join('\n')
    const refs = extractCredRefs(txt)
    assert.equal(refs.LINUXDO_API_KEY, 'sk-linuxdo-abc123')
    assert.equal(refs.OTHER_KEY, 'some-value')
  })

  it('returns empty object when the refs block is absent', function () {
    assert.deepEqual(extractCredRefs('foo: bar\nbaz: qux'), {})
  })

  it('returns empty object on empty input', function () {
    assert.deepEqual(extractCredRefs(''), {})
  })
})

// ---------------------------------------------------------------------------
// needsTranslate / hasProse — should we even send this to a provider?
// ---------------------------------------------------------------------------

describe('needsTranslate', function () {
  it('returns false for empty / whitespace text', function () {
    assert.equal(needsTranslate('', 'zh-CN'), false)
    assert.equal(needsTranslate('   ', 'zh-CN'), false)
    assert.equal(needsTranslate(null, 'zh-CN'), false)
  })

  it('returns false for code-only text', function () {
    assert.equal(needsTranslate('npm install foo', 'zh-CN'), false)
    assert.equal(needsTranslate('const x = 1', 'zh-CN'), false)
  })

  it('returns false for fenced code blocks', function () {
    assert.equal(needsTranslate('```\nconsole.log(1)\n```', 'zh-CN'), false)
  })

  it('returns false for already-Chinese text targeting zh', function () {
    assert.equal(needsTranslate('你好，世界', 'zh-CN'), false)
  })

  it('returns true for English text targeting zh', function () {
    assert.equal(needsTranslate('hello world', 'zh-CN'), true)
  })

  it('returns true for Chinese text targeting a non-zh language', function () {
    assert.equal(needsTranslate('你好，世界', 'ja'), true)
  })

  it('returns true for mixed prose that is mostly source-language', function () {
    // ~17% CJK stays under the zh skip threshold (cjkRatio >= 0.3)
    assert.equal(needsTranslate('hello world 中文', 'zh-CN'), true)
  })
})

describe('hasProse', function () {
  it('is false for pure code lines', function () {
    assert.equal(hasProse('git status'), false)
  })

  it('is true for a natural-language sentence', function () {
    assert.equal(hasProse('this is a normal sentence'), true)
  })

  it('is false for punctuation-only text', function () {
    assert.equal(hasProse('!!!'), false)
  })
})

// ---------------------------------------------------------------------------
// chunkText — split long input for per-chunk translation
// ---------------------------------------------------------------------------

describe('chunkText', function () {
  it('returns the whole text for short input', function () {
    const text = 'short text'
    assert.deepEqual(chunkText(text), [text])
  })

  it('splits long text on paragraph breaks', function () {
    const para = 'x'.repeat(2000)
    const text = para + '\n\n' + para
    const chunks = chunkText(text)
    assert.ok(chunks.length >= 2)
    for (const c of chunks) assert.ok(c.length <= 1200)
    // All source characters are preserved across chunks (the paragraph
    // separator itself is the split point and is not part of any chunk).
    const total = chunks.reduce(function (n, c) { return n + c.length }, 0)
    assert.equal(total, 4000)
  })

  it('returns the whole text for empty input', function () {
    assert.deepEqual(chunkText(''), [''])
  })
})

// ---------------------------------------------------------------------------
// fnv — cache key hash
// ---------------------------------------------------------------------------

describe('fnv', function () {
  it('is deterministic', function () {
    assert.equal(fnv('hello world'), fnv('hello world'))
  })

  it('embeds the input length in the output', function () {
    const h = fnv('abc')
    assert.ok(h.endsWith('.3'))
  })

  it('produces distinct hashes for distinct inputs', function () {
    assert.notEqual(fnv('one'), fnv('two'))
  })
})

// ---------------------------------------------------------------------------
// deepMerge — recursive object merge used for config patching
// ---------------------------------------------------------------------------

describe('deepMerge', function () {
  it('merges nested objects', function () {
    const base = { a: 1, nested: { x: 1, y: 2 } }
    deepMerge(base, { b: 2, nested: { y: 3 } })
    assert.deepEqual(base, { a: 1, b: 2, nested: { x: 1, y: 3 } })
  })

  it('replaces arrays rather than merging them', function () {
    const base = { list: ['a', 'b'] }
    deepMerge(base, { list: ['c'] })
    assert.deepEqual(base.list, ['c'])
  })

  it('mutates and returns base', function () {
    const base = { a: 1 }
    const result = deepMerge(base, { b: 2 })
    assert.equal(result, base)
    assert.deepEqual(base, { a: 1, b: 2 })
  })
})

// ---------------------------------------------------------------------------
// structuredCloneSafe — JSON round-trip clone
// ---------------------------------------------------------------------------

describe('structuredCloneSafe', function () {
  it('deep-clones and detaches references', function () {
    const src = { a: 1, nested: { b: [1, 2, 3] } }
    const copy = structuredCloneSafe(src)
    assert.deepEqual(copy, src)
    assert.notEqual(copy, src)
    assert.notEqual(copy.nested, src.nested)
    assert.notEqual(copy.nested.b, src.nested.b)
  })
})

// ---------------------------------------------------------------------------
// removeFromChain — drop a provider id from chain + fallback
// ---------------------------------------------------------------------------

describe('removeFromChain', function () {
  it('removes the id from chain and fallback chain', function () {
    const cfg = { chain: ['google', 'openai', 'bing'], fallback: { enabled: true, chain: ['openai', 'google'] } }
    removeFromChain(cfg, 'openai')
    assert.deepEqual(cfg.chain, ['google', 'bing'])
    assert.deepEqual(cfg.fallback.chain, ['google'])
  })

  it('is a no-op when the id is absent', function () {
    const cfg = { chain: ['google'], fallback: { enabled: true, chain: ['google'] } }
    removeFromChain(cfg, 'openai')
    assert.deepEqual(cfg.chain, ['google'])
    assert.deepEqual(cfg.fallback.chain, ['google'])
  })
})

// ---------------------------------------------------------------------------
// runChainFor / translateViaChain — error paths only (no live adapters, so no
// HTTP / subprocess is ever reached). Successful adapter runs belong to the
// integration tests in Task 8.
// ---------------------------------------------------------------------------

describe('runChainFor', function () {
  it('returns error for an empty chain', async function () {
    const result = await runChainFor([], 'hello', 'zh-CN', { providers: {} })
    assert.equal(result.ok, false)
    assert.match(result.error, /no enabled provider in chain/)
  })

  it('skips disabled providers', async function () {
    const result = await runChainFor(['google'], 'hello', 'zh-CN', { providers: { google: { enabled: false } } })
    assert.equal(result.ok, false)
    assert.match(result.error, /no enabled provider in chain/)
  })

  it('skips providers with no adapter for their type', async function () {
    const result = await runChainFor(['ghost'], 'hello', 'zh-CN', { providers: { ghost: { type: 'ghost', enabled: true } } })
    assert.equal(result.ok, false)
    assert.match(result.error, /no enabled provider in chain/)
  })
})

describe('translateViaChain', function () {
  it('fails when primary and fallback chains have no usable provider', async function () {
    const cfg = {
      chain: ['ghost'],
      fallback: { enabled: true, chain: ['ghost'] },
      providers: { ghost: { type: 'ghost', enabled: true } },
    }
    const result = await translateViaChain('hello', 'zh-CN', cfg)
    assert.equal(result.ok, false)
    assert.equal(result.text, 'hello')
    assert.match(result.error, /no enabled provider in chain/)
  })

  it('does not try the fallback when it is disabled', async function () {
    const cfg = {
      chain: ['ghost'],
      fallback: { enabled: false, chain: ['ghost'] },
      providers: { ghost: { type: 'ghost', enabled: true } },
    }
    const result = await translateViaChain('hello', 'zh-CN', cfg)
    assert.equal(result.ok, false)
  })

  it('fails when the chain is missing entirely', async function () {
    const result = await translateViaChain('hello', 'zh-CN', { providers: {} })
    assert.equal(result.ok, false)
  })
})
