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
import vm from 'node:vm'

const src = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')

// UI_TEXT is built inside the bundle factory, so read it out of a copy: the anchor
// below is the last statement of the factory body.
function captureUIText() {
  const anchor = '\t\texports.inject = inject;'
  assert.ok(src.includes(anchor), 'the UI_TEXT capture anchor must exist')
  const patched = src.replace(anchor, '\t\tglobalThis.__UI_TEXT__ = UI_TEXT;\n' + anchor)
  const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, window: {} }
  sandbox.window.__ModuleLoader__ = { load: function (spec) { sandbox.__spec = spec } }
  vm.createContext(sandbox)
  vm.runInContext(patched, sandbox, { filename: 'lib/client.js' })
  sandbox.__spec.factory(function (name) {
    // Only the dictionary is under test; react is never rendered here.
    if (name === 'react') {
      return { default: { createElement: function () { return null }, Fragment: null, useState: function () { return [null, function () {}] }, useEffect: function () {}, useId: function () { return 'id' }, Component: class {} } }
    }
    throw new Error('unexpected require: ' + name)
  })
  return sandbox.__UI_TEXT__
}

const LANGS = ['zh-CN', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru']

describe('locale dictionary parity', function () {
  it('defines exactly the same keys in all 8 locales', function () {
    // A key added to en only used to be invisible: the panel falls back to English
    // for the whole locale, so nothing showed up as `undefined` — six locales simply
    // rendered English (the provider buttons) or lost a label (copy/copied).
    const UI = captureUIText()
    assert.deepEqual(Object.keys(UI).sort(), LANGS.slice().sort())
    const ref = Object.keys(UI.en).sort()
    assert.ok(ref.length > 60, 'the dictionary should not shrink unnoticed: ' + ref.length)
    for (const lang of LANGS) {
      assert.deepEqual(Object.keys(UI[lang]).sort(), ref, lang + ' has a different key set than en')
      assert.deepEqual(Object.keys(UI[lang].labels).sort(), Object.keys(UI.en.labels).sort(),
        lang + ' has a different provider-label set')
    }
  })

  it('defines the code-block copy labels in every locale', function () {
    // MarkdownText reads labels.code.copyLabel/copiedLabel (issue #3); a missing
    // value here is the copy button speaking English inside a translated UI.
    const UI = captureUIText()
    for (const lang of LANGS) {
      for (const key of ['copy', 'copied']) {
        assert.equal(typeof UI[lang][key], 'string', lang + ' is missing ' + key)
        assert.ok(UI[lang][key].trim().length > 0, lang + '.' + key + ' is empty')
      }
    }
  })

  it('keeps the doneFmt placeholders in every locale', function () {
    // The consumer replaces {d} and {t}; a locale missing one shows literal braces.
    const UI = captureUIText()
    for (const lang of LANGS) {
      assert.match(UI[lang].doneFmt, /\{d\}/, lang + '.doneFmt lost {d}')
      assert.match(UI[lang].doneFmt, /\{t\}/, lang + '.doneFmt lost {t}')
    }
  })

  it('has no leftover key from a removed feature', function () {
    // The fallback-chain UI, the form's 名称/env rows, the panel footnote and the old
    // "preferred provider" dropdown are gone; their strings must not come back.
    const UI = captureUIText()
    for (const dead of ['fallbackChain', 'fallbackToggle', 'modelNotInChain', 'note', 'presetLabel',
      'providerApiKeyEnv', 'providerEnvLabel', 'providerManaged', 'providerName', 'providerOf', 'testConn']) {
      assert.ok(!(dead in UI.en), 'dead key came back: ' + dead)
    }
  })
})

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

  it('offers provider presets filtered by the selected type', function () {
    assert.match(src, /var PROVIDER_PRESETS = \[/)
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
    assert.match(src, /style: \{ marginLeft: "auto", flex: "0 0 auto" \}/)
    // Clearing must also refresh the counter: `mem` is a plain Map, so without a
    // state bump the 缓存条目 number kept its old value.
    assert.match(src, /onClick: function \(\) \{ clearCache\(\); bumpTick\(function \(n\) \{ return n \+ 1; \}\); \}/)
    assert.ok(!src.includes('className: "xl-kv", style: { marginTop: "4px" }'),
      'the clear button must not have a row of its own')
  })

  it('builds the custom-provider form as labelled rows named by the model', function () {
    assert.ok(!src.includes('placeholder: t.providerName'), 'the 名称 row must be gone')
    assert.match(src, /createElement\("span", \{ className: "xl-form-label" \}, t\.providerPreset\)/)
    assert.match(src, /placeholder: t\.providerModel, value: formModel/)
    // The model name is the provider's name, with a suffix when it collides.
    assert.match(src, /var id = editingId \|\| model;/)
  })

  it('keeps the provider field typable and suggests names, not preset labels', function () {
    // Suggestions are the plugin's own boxed menus: a browser suggestion list filters
    // itself by whatever is already in the input, so after picking a provider the
    // arrow only offered that same provider again.
    assert.ok(!src.includes('createElement("datalist"'), 'no browser suggestion list may come back')
    assert.match(src, /className: "xl-menu"/)
    assert.match(src, /className: "xl-menu-item"/)
    assert.match(src, /var formProviderMenuPair = useState\(false\)/)
    assert.match(src, /var PROVIDER_PRESETS = \[/)
    // The model menu belongs to one provider: disabled until one is known, then it
    // lists only that provider's models.
    assert.match(src, /disabled: !presetByName\(formProvider\)/)
    assert.match(src, /return pp \? pp\.models : \[\];/)
    assert.match(src, /onClick: function \(\) \{ onProviderChange\(pp\.name\); setFormProviderMenu\(false\); \}/)
    // Every preset suggests at least one model, and most of them several.
    const presets = src.match(/models: \[[^\]]+\]/g) || []
    assert.equal(presets.length, 8, 'one model list per preset')
    assert.ok(presets.every(function (m) { return m !== 'models: []' }), 'no preset may suggest nothing')
    const several = presets.filter(function (m) { return (m.match(/", "/g) || []).length >= 1 })
    assert.ok(several.length >= 6, 'most presets should list several models')
    // The ids were re-checked against the vendors' docs on 2026-09-11; the retired
    // ones must not come back (Qwen retired qwen-turbo, Moonshot the whole
    // moonshot-v1 series, and the Claude 3.x ids are gone).
    for (const gone of ['"qwen-turbo"', '"moonshot-v1-8k"', '"claude-3-5-haiku-latest"',
      '"claude-3-7-sonnet-latest"', '"glm-4-flash"', '"deepseek-chat"']) {
      assert.ok(!src.includes(gone), gone + ' is retired and must not be suggested')
    }
    for (const live of ['"deepseek-flash"', '"gpt-5.6-luna"', '"qwen3.7-max"', '"glm-5.3"',
      '"kimi-k3"', '"claude-sonnet-5"', '"Pro/deepseek-ai/DeepSeek-R1"', '"openrouter/auto"']) {
      assert.ok(src.includes(live), live + ' should be suggested')
    }
    // The environment-variable row is gone from the form (the value survives an edit).
    assert.ok(!src.includes('t.providerEnvLabel)'), 'the env-var row must be gone')
  })

  it('marks both suggestion menus as suggestions only, in all 8 languages', function () {
    // The lists drift with every vendor release, so the note is what keeps the
    // free-text promise visible where the user actually picks a model.
    assert.match(src, /createElement\("div", \{ className: "xl-menu-note" \}, t\.providerHint\)/)
    assert.match(src, /createElement\("div", \{ className: "xl-menu-note" \}, t\.modelHint\)/)
    assert.match(src, /"\.xl-menu-note\{/)
    assert.equal((src.match(/^\s*providerHint: "/gm) || []).length, 8)
    assert.equal((src.match(/^\s*modelHint: "/gm) || []).length, 8)
  })

  it('names the provider and model in the connection-test message', function () {
    assert.match(src, /providerLabel\(id, \(cfgRef\.current\.providers \|\| \{\}\)\[id\] \|\| \{\}, t\)/)
  })

  it('closes the panel with the plugin name, its real version, and the star link', function () {
    assert.match(src, /fetch\("\/_xlate\/version"\)/)
    assert.match(src, /className: "xl-about"/)
    assert.match(src, /t\.starCta \+ " ★"/)
    assert.match(src, /href: \(about && about\.repo\) \|\| PLUGIN_REPO/)
    assert.ok(!src.includes('t.note)'), 'the stale footnote must be gone')
  })

  it('keeps the embedded plugin version in step with package.json', function () {
    // The panel reads the host route first; this constant is the fallback for a host
    // that predates the route, so it must never drift from the real release version.
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))
    assert.match(src, new RegExp('var PLUGIN_VERSION = "' + pkg.version.replace(/\./g, '\\.') + '";'))
    assert.match(src, new RegExp('var PLUGIN_NAME = "' + pkg.name + '";'))
  })

  it('offers a one-click way to inherit the API this DSH is already configured with', function () {
    // A fresh install knows nothing, but the harness it runs inside already does:
    // GET /_xlate/dsh-scan re-reads settings.yaml + .credentials.yaml and returns
    // those providers as read-only `source: 'dsh'` entries, so the user never
    // retypes a base URL or a key.
    assert.match(src, /fetch\("\/_xlate\/dsh-scan"\)\.then\(function \(r\) \{ return r\.json\(\); \}\)/)
    assert.match(src, /var dshAvailable = dshAll\.filter\(function \(id\) \{ return chain\.indexOf\(id\) < 0; \}\);/)
    assert.match(src, /return provs\[id\] && provs\[id\]\.source === "dsh";/)
    assert.match(src, /var dshMenuPair = useState\(false\)/)
    // The button sits next to "+ add provider" and names the count it can add.
    assert.match(src, /onClick: openDshImport/)
    assert.match(src, /t\.dshImport \+ \(dshAvailable\.length \? " · " \+ dshAvailable\.length : ""\)/)
    // One row per inherited provider, with the DSH badge and a one-click add; a
    // second button adds every remaining provider at once.
    assert.match(src, /className: "xl-dsh-menu"/)
    assert.match(src, /createElement\("span", \{ className: "xl-badge" \}, t\.providerDsh\)/)
    assert.match(src, /t\.dshImportAll/)
    assert.match(src, /onClick: function \(\) \{ actions\.addToChain\(id\); \}/)
    // Nothing to inherit must read as an explanation, never as an empty box.
    assert.match(src, /dshAvailable\.length === 0[\s\S]{0,120}t\.dshImportEmpty/)
    // Ordering: this reads provs/chain, which the same function assigns further
    // down. The render test is the real guard; this keeps the intent visible.
    assert.ok(src.indexOf('var dshAll = Object.keys(provs)') > src.indexOf('var provs = cfg.providers || {}'),
      'the inherit block must run after provs is assigned')
  })
})
