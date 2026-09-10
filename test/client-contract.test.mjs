// Contract tests for the plugin's client bundle (issue #3).
//
// The bundle is a browser module graph — it cannot be imported into Node — so
// these assertions read the source text and pin the one contract that must hold
// against the official @deepseek-ai/dsh-client-ui-primitives:
//
//   * 0.1.2-alpha and later destructure a NESTED `labels` object and dereference
//     it without defaults (`context.labels.code.copyLabel`, `context.labels.footnotes`),
//     so passing only the old flat `codeLabels` prop makes every message with a
//     fenced code block (or footnotes) throw inside the official renderer.
//   * <= 0.1.1-rc renderers read the flat `codeLabels` prop instead.
//
// Both props are therefore passed. Verified against the real primitives build:
// the flat-only call reproduces `Cannot read properties of undefined (reading
// 'code')`, the nested one renders the code block with the configured copy label.
//
// Run with: node --test test/*.test.mjs
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')

describe('MarkdownText label contract (issue #3)', function () {
  it('builds the nested labels shape the 0.1.2+ renderer dereferences', function () {
    assert.match(src, /code:\s*\{\s*copyLabel:\s*tt\.copy,\s*copiedLabel:\s*tt\.copied\s*\}/)
    assert.match(src, /footnotes:\s*tt\.footnotes\s*\|\|\s*"Footnotes"/)
  })

  it('passes the nested labels to every official MarkdownText render', function () {
    const sites = src.split('labels: mdLabels, codeLabels: codeLabels').length - 1
    assert.equal(sites, 2, 'both the answer body and the collapsible original text must pass labels')
  })

  it('keeps the flat codeLabels prop for the <= 0.1.1-rc renderers', function () {
    assert.match(src, /var codeLabels = mdLabels \? mdLabels\.code : undefined;/)
  })

  it('caches the label objects, because MarkdownText is memoized on them', function () {
    assert.match(src, /mdLabelsCache\.set\(tt, labels\)/)
  })

  it('defines the footnotes label in all 8 languages', function () {
    const hits = (src.match(/^\s*footnotes: "/gm) || []).length
    assert.equal(hits, 8)
  })
})

// ---------------------------------------------------------------------------
// Settings-UI contracts (2026-09-11 rework)
// ---------------------------------------------------------------------------

describe('settings UI contracts', function () {
  it('keeps a built-in provider undeletable and offers × for custom ones', function () {
    assert.match(src, /!isBuiltin && !isDsh \? createElement\("button", \{ className: "xl-x-btn"/)
    assert.ok(!src.includes('t.providerRemoveFromChain) : null'), 'no remove-from-chain text button should remain on rows')
  })

  it('turns a DSH row checkbox into chain membership', function () {
    assert.match(src, /if \(isDsh\) \{ if \(e\.target\.checked\) actions\.addToChain\(id\); else actions\.removeFromChain\(id\); \}/)
    assert.match(src, /var isChecked = isDsh \? inChain : \(p\.enabled !== false\);/)
  })

  it('has no fallback-chain UI left', function () {
    assert.ok(!src.includes('fbEnabled') && !src.includes('fbAdd:'), 'fallback UI and actions must be gone')
  })

  it('offers model presets filtered by the selected type', function () {
    assert.match(src, /var MODEL_PRESETS = \[/)
    assert.match(src, /if \(pp\.type !== formType\) return null;/)
  })

  it('sends an explicit null for a cleared secret field', function () {
    assert.match(src, /apiKeyEnv: formApiKeyEnv\.trim\(\) === "" \? null : formApiKeyEnv\.trim\(\),/)
    assert.match(src, /apiKey: formApiKey\.trim\(\) === "" \? null : formApiKey\.trim\(\),/)
  })

  it('bounds the persisted translation cache', function () {
    assert.match(src, /var LS_CACHE_MAX = 300;/)
    assert.match(src, /function pruneCache\(\)/)
    assert.match(src, /if \(cacheWrites % 20 === 0\) pruneCache\(\);/)
  })

  it('registers its own settings nav glyph through the settings.section.icon seat', function () {
    // The seat only exists on DSH >= 0.1.5: the inject stays dormant elsewhere and
    // the shell keeps its default glyph, so this registration is safe either way.
    assert.match(src, /var IconThink = primitives && primitives\.IconThinkOutline16/)
    assert.match(src, /ctx\.slots\.inject\("settings\.section\.icon", function \(\) \{/)
    assert.match(src, /name: "settings\.section\.icon", key: "dsh-think-translate"/)
  })

  it('carries its own inline glyph for platforms without that seat', function () {
    // Every released DSH paints the settings gear for plugin sections, so users on
    // those versions must still see this plugin's own shape.
    assert.match(src, /var NAV_GLYPH_SVG = '<svg width="16" height="16"/)
    assert.match(src, /function decorateSettingsGlyph\(\)/)
    assert.match(src, /data-xl-nav-glyph/)
  })

  it('scopes that decoration to its own nav cell and disposes the observer', function () {
    assert.match(src, /if \(!label \|\| \(label\.textContent \|\| ""\)\.trim\(\) !== title\) continue;/)
    assert.match(src, /observer\.disconnect\(\)/)
  })

  it('moves the local-model picker into its own provider row', function () {
    assert.match(src, /className: "xl-chip"/)
    assert.match(src, /toggleModelMenu: function \(id\) \{/)
    assert.match(src, /className: "xl-model-panel"/)
    assert.match(src, /onClick: function \(\) \{ pickModel\(m\); \}/)
    assert.ok(!src.includes('var modelArea'), 'the separate model block must be gone')
    assert.ok(!src.includes('var testConn'), 'the standalone connection test must be gone')
  })

  it('hides the raw id on built-in rows and reports "in use" in the status block', function () {
    // The name cell stays as the flex filler so the controls line up across rows.
    assert.match(src, /createElement\("span", \{ className: "xl-provider-name" \}, isBuiltin \? "" : id\)/)
    assert.match(src, /createElement\("b", null, t\.currentInUse\)/)
    // The clear button belongs to the "当前使用" row itself (tail of that row),
    // not to a row of its own.
    assert.match(src, /style: \{ marginLeft: "auto", flex: "0 0 auto" \},\n\t*onClick: clearCache/)
  })
})
