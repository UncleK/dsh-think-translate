# Dynamic Provider Chain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor dsh-think-translate from a fixed 3-provider chain (google/bing/openai) to a dynamic, user-orderable provider registry with custom OpenAI-compatible endpoints, native Anthropic Messages API support, and auto-discovery of DSH-configured service providers.

**Architecture:** Config becomes `{ chain: [ordered ids], fallback: { enabled, chain }, providers: { id → config } }`. Host side gains a `viaAnthropic` adapter + DSH discovery; `translateViaChain` walks the ordered chain then an independent fallback chain. Client settings panel becomes a draggable provider list with add/edit/delete/test per provider.

**Tech Stack:** Plain ESM Node (host), hand-written createElement-based browser bundle (client, no build step, no deps). Tests: node:test with mocked fetch/curl.

**Design doc:** `docs/plans/2026-09-01-dynamic-provider-chain-design.md`

---

## Context Notes for the Engineer

- Repo: `dsh-think-translate`, no build step. `lib/index.js` = host ESM (Node, runs inside DSH harness with `webServer`, `subprocess`, `timer` injected). `lib/client.js` = browser bundle (source = artifact), hand-written Preact-compatible `createElement` calls, 8-language `UI_TEXT` dict, `localStorage` persistence.
- `lib/config.json` is the runtime config file (`CONFIG_PATH` in host). It is NOT committed to git (runtime-generated).
- The plugin chain currently: `google` (gtx), `bing` (ttranslatev3), `openai` (OpenAI-compatible /chat/completions). `ADAPTERS` object maps id → async fn `(text, to, cfg) → translated string`.
- DSH harness config to discover: `settings.yaml` → `llm-pi-ai.providers.{name}` with `{ apiKeyEnv?, api, baseURL, models: [{id}] }`; credentials in `.credentials.yaml` → `refs.{ENV_NAME}`. On macOS the harness dir is `~/Library/Application Support/dsh-desktop/harness/`; on Windows `%APPDATA%\dsh-desktop\harness\`; env var `DSH_HOME` may override (log shows `DSH_HOME=.../harness`).
- Old config migration: `priority: "x"` → `chain: [x, then remaining enabled providers in fixed order]`.
- **Do NOT break Windows**: `getProxy()` keeps its `reg` branch for non-darwin; the fix for macOS proxy detection lives in PR #1 (separate branch) — this feature branch is based on `upstream/main` WITHOUT that fix. Implement the DSH discovery and chain refactor without depending on the macOS proxy fix (the two PRs will merge separately).

---

### Task 1: Anthropic adapter (`viaAnthropic`)

**Files:**
- Modify: `lib/index.js` (add `viaAnthropic` near `viaOpenAI` ~line 300; add to `ADAPTERS`)

**Step 1: Add the adapter function**

```js
async function viaAnthropic(text, to, cfg) {
  if (!cfg.apiKey) throw new Error('anthropic: missing apiKey')
  let url = String(cfg.baseURL || '').replace(/\/+$/, '')
  if (!url) throw new Error('anthropic: missing baseURL')
  if (!url.endsWith('/v1/messages')) url += '/v1/messages'
  const body = JSON.stringify({
    model: cfg.model || 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: OPENAI_SYSTEM,
    messages: [{ role: 'user', content: 'Target language: ' + to + '\n\n' + text }],
  })
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)([:/]|$)/i.test(url)
  let raw
  if (isLocal) {
    const controller = new AbortController()
    const timer = setTimeout(function () { controller.abort() }, 15000)
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
    } finally { clearTimeout(timer) }
    if (!res.ok) throw new Error('anthropic HTTP ' + res.status)
    raw = await res.text()
  } else {
    raw = await curlPostJson(url, [
      'x-api-key: ' + cfg.apiKey,
      'anthropic-version: 2023-06-01',
      'Content-Type: application/json',
    ], body)
  }
  const j = JSON.parse(raw)
  const textPart = j && j.content && j.content.filter(function (c) { return c && c.type === 'text' }).map(function (c) { return c.text }).join('')
  if (typeof textPart !== 'string' || !textPart.trim()) throw new Error('anthropic empty output: ' + JSON.stringify(j).slice(0, 200))
  return textPart.trim()
}
```

**Step 2: Register in ADAPTERS**

```js
const ADAPTERS = {
  google: viaGoogle,
  bing: viaBing,
  openai: viaOpenAI,
  anthropic: viaAnthropic,   // new
}
```

**Step 3: Syntax check + commit**

Run: `node --check lib/index.js` → no output (OK)
```bash
git add lib/index.js
git commit -m "feat: add Anthropic Messages API adapter"
```

---

### Task 2: Config model — chain + fallback + migration

**Files:**
- Modify: `lib/index.js` (`DEFAULT_CONFIG`, `loadConfig`)

**Step 1: Update DEFAULT_CONFIG**

```js
const DEFAULT_CONFIG = {
  chain: ['google', 'bing', 'openai'],
  fallback: { enabled: true, chain: ['google', 'bing'] },
  providers: {
    google: { enabled: true },
    bing: { enabled: true },
    openai: { enabled: true, baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct', apiKey: 'ollama-local' },
  },
}
```

**Step 2: Add migration in `loadConfig`** (after merge, before caching)

```js
async function loadConfig() {
  if (configCache !== null) return configCache
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    configCache = deepMerge(structuredCloneSafe(DEFAULT_CONFIG), parsed)
  } catch (e) {
    configCache = structuredCloneSafe(DEFAULT_CONFIG)
    await saveConfig(configCache).catch(function () {})
  }
  migrateConfig(configCache)
  return configCache
}

function migrateConfig(cfg) {
  // Old format had `priority` (string) and no `chain` — migrate once.
  if (!Array.isArray(cfg.chain) || cfg.chain.length === 0) {
    const prio = typeof cfg.priority === 'string' ? cfg.priority : 'google'
    const rest = Object.keys(cfg.providers || {}).filter(function (id) { return id !== prio && cfg.providers[id] && cfg.providers[id].enabled })
    cfg.chain = [prio].concat(rest)
  }
  if (!cfg.fallback || !Array.isArray(cfg.fallback.chain)) {
    cfg.fallback = { enabled: true, chain: ['google', 'bing'] }
  }
}
```

**Step 3: Verify migration** — run `node -e` with a temp config

Run:
```bash
node -e "
const fs = require('fs');
const os = require('os'); const path = require('path');
// simulate: create temp config with old shape, call loadConfig via dynamic import
"  # (manual smoke; full test in Task 6)
```

**Step 4: Commit**

```bash
git add lib/index.js
git commit -m "feat: chain + fallback config model with old-format migration"
```

---

### Task 3: Chain execution rewrite

**Files:**
- Modify: `lib/index.js` (`translateViaChain` ~line 490, `handleTranslate`)

**Step 1: Rewrite `translateViaChain`**

```js
async function runChainFor(ids, text, target, cfg) {
  let lastErr = null
  for (const id of ids) {
    const p = cfg.providers && cfg.providers[id]
    if (!p || !p.enabled) continue
    const adapter = ADAPTERS[p.type]
    if (!adapter) continue
    try {
      const chunks = chunkText(text)
      const outs = []
      for (const c of chunks) outs.push(await adapter(c, target, p))
      state.ok++
      state.lastProvider = id
      state.lastError = null
      return { ok: true, text: outs.join('\n\n'), provider: id, ...(p.type === 'openai' || p.type === 'anthropic' ? { model: p.model } : {}) }
    } catch (e) {
      lastErr = e
      if (id === 'bing') bingCache = null
    }
  }
  return { ok: false, error: lastErr instanceof Error ? lastErr.message : String(lastErr) }
}

async function translateViaChain(text, target, cfg) {
  const primary = await runChainFor(cfg.chain || [], text, target, cfg)
  if (primary.ok) return primary
  if (cfg.fallback && cfg.fallback.enabled && Array.isArray(cfg.fallback.chain)) {
    const fb = await runChainFor(cfg.fallback.chain, text, target, cfg)
    if (fb.ok) return fb
  }
  state.fail++
  state.lastError = primary.error
  return { ok: false, text: text, error: primary.error || 'translate unavailable' }
}
```

**Step 2: `handleTranslate` must honor per-provider override (for single-provider test)**

```js
async function handleTranslate(body) {
  const text = body && typeof body.text === 'string' ? body.text : ''
  const target = body && typeof body.target === 'string' && body.target ? body.target : 'zh-CN'
  const forced = body && typeof body.provider === 'string' ? body.provider : null
  if (!text.trim()) return { ok: true, text: '', skipped: true }
  const key = (forced ? 'f|' + forced : '') + target + '|' + fnv(text)
  // ... cache/inflight same as before ...
  const job = (async function () {
    if (!needsTranslate(text, target)) { /* skipped */ }
    const cfg = await loadConfig()
    if (forced) {
      const p = cfg.providers && cfg.providers[forced]
      if (!p) return { ok: false, text, error: 'unknown provider: ' + forced }
      if (!p.enabled) return { ok: false, text, error: 'provider disabled: ' + forced }
      const adapter = ADAPTERS[p.type]
      if (!adapter) return { ok: false, text, error: 'unsupported type: ' + p.type }
      try {
        const out = await adapter(text, target, p)
        return { ok: true, text: out, provider: forced, ...(p.model ? { model: p.model } : {}) }
      } catch (e) {
        return { ok: false, text, error: e instanceof Error ? e.message : String(e) }
      }
    }
    const r = await translateViaChain(text, target, cfg)
    if (r.ok) cacheSet(key, r)
    return r
  })()
  // ... same inflight handling ...
}
```

**Step 3: Syntax check + commit**

```bash
node --check lib/index.js
git add lib/index.js
git commit -m "feat: ordered chain with fallback and per-provider override"
```

---

### Task 4: DSH provider discovery

**Files:**
- Modify: `lib/index.js` (new `discoverDshProviders` + route `/_xlate/dsh-scan`)

**Step 1: Add discovery function**

```js
const DSH_HOME = process.env.DSH_HOME
  || (process.platform === 'darwin'
    ? (process.env.HOME + '/Library/Application Support/dsh-desktop/harness')
    : (process.env.APPDATA + '\\dsh-desktop\\harness'))

function parseYamlSimple(txt) {
  // Minimal YAML subset: `key: value` pairs and `    name:` nested under a
  // top-level key. Good enough for settings.yaml/.credentials.yaml sections.
  const out = {}
  let section = null
  for (const line of txt.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (m && line.startsWith('llm-pi-ai') === false) {
      // top-level
      if (!/^\s/.test(line)) { section = null }
    }
    const indented = line.match(/^(\s+)([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (indented) {
      const key = indented[2]
      const val = indented[3]
      if (key === 'providers') { section = 'providers'; continue }
      if (section === 'providers' && /^\s{4}/.test(line)) {
        // provider name line: "    linuxdo-hub:"
        if (!out.providers) out.providers = {}
        if (val === '' && /:\s*$/.test(line.trim() + ' ')) { /* handled below */ }
      }
    }
  }
  return out
}
```

**Step 2: Full implementation**

```js
async function discoverDshProviders() {
  const fs = await import('node:fs')
  const out = {}
  try {
    const settingsPath = DSH_HOME + '/settings.yaml'
    const credsPath = DSH_HOME + '/.credentials.yaml'
    const settingsTxt = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : ''
    const credsTxt = fs.existsSync(credsPath) ? fs.readFileSync(credsPath, 'utf8') : ''
    const settings = parseYamlSimple(settingsTxt)
    const creds = parseYamlSimple(credsTxt)
    const providers = settings.providers || {}
    const refs = creds.refs || {}
    for (const name of Object.keys(providers)) {
      const p = providers[name]
      if (!p || (p.api && p.api !== 'openai-completions')) continue
      const model = Array.isArray(p.models) && p.models[0] && p.models[0].id ? p.models[0].id : null
      if (!p.baseURL || !model) continue
      const apiKey = p.apiKeyEnv && refs[p.apiKeyEnv] ? refs[p.apiKeyEnv] : null
      out[name] = {
        type: 'openai',
        source: 'dsh',
        baseURL: p.baseURL,
        model,
        ...(p.apiKeyEnv ? { apiKeyEnv: p.apiKeyEnv } : {}),
        ...(apiKey ? { apiKey } : {}),
        enabled: false,  // user must add to chain explicitly
      }
    }
  } catch (e) { /* silent — discovery must never block the plugin */ }
  return out
}

async function mergeDshProviders(cfg) {
  const dsh = await discoverDshProviders()
  for (const id of Object.keys(dsh)) {
    if (!cfg.providers[id]) cfg.providers[id] = dsh[id]
    else if (cfg.providers[id].source === 'dsh') cfg.providers[id] = Object.assign({}, dsh[id], cfg.providers[id])
  }
  return cfg
}
```

**Step 3: Call in `loadConfig` and add route**

In `loadConfig`, after `migrateConfig`: `await mergeDshProviders(configCache)`

Add route in `apply()`:

```js
ctx.effect(function () {
  const dispose = webServer.register({
    kind: 'exact',
    path: '/_xlate/dsh-scan',
    handler: async function (req, res) {
      try {
        if (req.method !== 'GET') { sendJson(res, 405, { error: 'GET only' }); return }
        configCache = null
        const cfg = await loadConfig()
        await saveConfig(cfg)
        sendJson(res, 200, cfg)
      } catch (e) {
        sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) })
      }
    },
  })
  return dispose
}, 'dsh-think-translate: dsh-scan route')
```

**Step 4: Syntax check + commit**

```bash
node --check lib/index.js
git add lib/index.js
git commit -m "feat: auto-discover DSH service providers from settings.yaml + credentials"
```

---

### Task 5: Config route validation + provider CRUD

**Files:**
- Modify: `lib/index.js` (`/_xlate/config` POST handler)

**Step 1: Validate and normalize POST body**

```js
const VALID_TYPES = ['google', 'bing', 'openai', 'anthropic']

function normalizeConfigPatch(patch) {
  const out = {}
  if (Array.isArray(patch.chain)) {
    out.chain = patch.chain.filter(function (id) { return typeof id === 'string' })
  }
  if (patch.fallback && typeof patch.fallback === 'object') {
    out.fallback = {
      enabled: patch.fallback.enabled !== false,
      chain: Array.isArray(patch.fallback.chain) ? patch.fallback.chain.filter(function (id) { return typeof id === 'string' }) : ['google', 'bing'],
    }
  }
  if (patch.providers && typeof patch.providers === 'object') {
    out.providers = {}
    for (const id of Object.keys(patch.providers)) {
      const p = patch.providers[id]
      if (!p || typeof p !== 'object') continue
      if (p.source === 'dsh') continue // never allow editing DSH providers
      const t = p.type || 'openai'
      if (VALID_TYPES.indexOf(t) === -1) continue
      out.providers[id] = { type: t, enabled: p.enabled !== false }
      if (p.baseURL) out.providers[id].baseURL = String(p.baseURL)
      if (p.apiKey) out.providers[id].apiKey = String(p.apiKey)
      if (p.model) out.providers[id].model = String(p.model)
      if (p.apiKeyEnv) out.providers[id].apiKeyEnv = String(p.apiKeyEnv)
    }
  }
  return out
}
```

Wire it in the POST handler: `const merged = deepMerge(await loadConfig(), normalizeConfigPatch(patch))`.

**Step 2: Commit**

```bash
node --check lib/index.js
git add lib/index.js
git commit -m "feat: config route validation + protect DSH providers from edits"
```

---

### Task 6: Host-side tests (node:test)

**Files:**
- Create: `test/host.test.mjs`

**Step 1: Write tests**

```js
import { test } from 'node:test'
import assert from 'node:assert'

// Test migration
test('old priority config migrates to chain', () => {
  // call migrateConfig on a fixture object
})

// Test anthropic request/response by importing viaAnthropic with mocked fetch
test('viaAnthropic builds Messages API request', async () => {
  // global.fetch = async (url, opts) => new Response(JSON.stringify({ content: [{ type: 'text', text: 'こんにちは' }] }), { status: 200 })
  // const out = await viaAnthropic('你好', 'ja', { apiKey: 'k', baseURL: 'http://127.0.0.1:1/v1', model: 'claude' })
  // assert.equal(out, 'こんにちは')
})

// Test chain fallback
test('chain falls back when primary fails', async () => {
  // mock adapters, run runChainFor with a failing first provider
})
```

**Step 2: Run**

Run: `node --test test/` → all pass

**Step 3: Commit**

```bash
git add test/host.test.mjs
git commit -m "test: host-side unit tests for migration, anthropic, chain fallback"
```

---

### Task 7: Client — provider list UI (drag, add, edit, delete, test)

**Files:**
- Modify: `lib/client.js` (settings panel; `UI_TEXT` dict additions; `priorities` array → dynamic)

**Step 1: Add UI strings** (at least for `en` + `zh-CN`; others copy en as placeholder)

```js
// in each UI_TEXT block:
provider: "Preferred providers", providerAdd: "Add custom provider",
providerName: "Name", providerType: "Type", providerBaseURL: "Base URL",
providerApiKey: "API key", providerModel: "Model", providerTest: "test",
providerEdit: "edit", providerDelete: "delete", providerDsh: "DSH",
providerUp: "up", providerDown: "down", providerOn: "on", providerOff: "off",
providerSaved: "Saved", providerDeleted: "Deleted",
fallbackToggle: "Enable fallback chain", fallbackChain: "Fallback chain",
source: "source",
```

**Step 2: Replace the priority `<select>`** in `SettingsPanel` with a list built from `cfg.chain` + `cfg.providers`. Each row:

```js
function providerRow(id, p, idx, chain, cfg, t, actions) {
  const row = createElement("div", { className: "xl-provider-row", draggable: "true",
    "data-id": id,
    onDragStart: function (e) { e.dataTransfer.setData("text/plain", id); },
    onDragOver: function (e) { e.preventDefault(); },
    onDrop: function (e) { e.preventDefault(); var from = e.dataTransfer.getData("text/plain"); actions.reorder(from, id); } },
    createElement("span", { className: "xl-provider-name" }, (t.labels[p.type] || p.type) + " · " + id),
    p.source === "dsh" ? createElement("span", { className: "xl-badge" }, t.providerDsh) : null,
    createElement("input", { type: "checkbox", checked: p.enabled !== false, onChange: function (e) { actions.toggle(id, e.target.checked); } }),
    createElement("button", { className: "xl-btn", type: "button", onClick: function () { actions.move(id, -1); } }, "↑"),
    createElement("button", { className: "xl-btn", type: "button", onClick: function () { actions.move(id, 1); } }, "↓"),
    createElement("button", { className: "xl-btn", type: "button", onClick: function () { actions.test(id); } }, t.providerTest),
    p.source !== "dsh" ? createElement("button", { className: "xl-btn", type: "button", onClick: function () { actions.edit(id); } }, t.providerEdit) : null,
    p.source !== "dsh" ? createElement("button", { className: "xl-btn", type: "button", onClick: function () { actions.del(id); } }, t.providerDelete) : null);
  return row;
}
```

**Step 3: Wire actions** (all POST to `/_xlate/config` with normalized patch; `test` POSTs `/_xlate/translate` with `{ provider: id }`)

```js
var providerActions = {
  reorder: function (from, to) {
    var chain = cfg.chain.slice();
    var i = chain.indexOf(from), j = chain.indexOf(to);
    if (i < 0 || j < 0) return;
    chain.splice(i, 1); chain.splice(j, 0, from);
    saveCfg({ chain: chain });
  },
  move: function (id, dir) {
    var chain = cfg.chain.slice();
    var i = chain.indexOf(id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= chain.length) return;
    chain[i] = chain[j]; chain[j] = id;
    saveCfg({ chain: chain });
  },
  toggle: function (id, on) { saveCfg({ providers: { [id]: { enabled: on } } }); },
  test: function (id) {
    fetch("/_xlate/translate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello world, connection test. [" + Date.now().toString(36) + "]", target: store.lang, provider: id }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { /* show result inline */ });
  },
  del: function (id) {
    var chain = cfg.chain.filter(function (x) { return x !== id; });
    var providers = Object.assign({}, cfg.providers); delete providers[id];
    saveCfg({ chain: chain, providers: providers });
  },
};
```

Note: delete of a provider object — the current `normalizeConfigPatch` only accepts providers with `type`; deleting requires a `providers: { id: null }` convention OR the client sends the full config. **Decision: client sends the full config object for delete operations** (`POST /_xlate/config` with complete `{ chain, fallback, providers }`), and host `normalizeConfigPatch` accepts full replaces too (see Task 5 note: when patch has `providers` with entries that have `type`, merge; when patch has `_full: true`, replace entirely).

**Step 4: Add-custom form** (inline expandable form with fields: name, type select, baseURL, apiKey, model)

```js
function addProviderForm(t, saveCfg) {
  // local state via useState for each field; submit builds:
  //   providers: { name: { type, baseURL, apiKey, model } }  + chain: [...chain, name]
}
```

**Step 5: Fallback UI** (toggle + mini list reusing providerRow for fallback.chain)

**Step 6: Commit**

```bash
node --check lib/client.js
git add lib/client.js
git commit -m "feat: client provider chain UI with drag/add/edit/test/fallback"
```

---

### Task 8: Manual integration test on real DSH

**Step 1: Install the plugin into the DSH web profile**

```bash
cd ~/Library/Application\ Support/dsh-desktop/harness/profiles/web
# link this repo's lib into the profile's node_modules (or copy), restart web
```

**Step 2: Verify**

- Open Settings → Think Translation: provider list shows google/bing/openai + DSH providers (linuxdo-hub, coding-hub, opencode-go on this machine)
- Add a custom provider (type openai, any endpoint) → appears in chain, test button works
- Reorder via drag → restart web → order persists
- Main chain fails → fallback chain kicks in (error message shows fallback provider)

**Step 3: Fix issues found; commit fixes**

---

### Task 9: Update README + UI_TEXT for all 8 languages (minimal)

**Files:**
- Modify: `README.md`, `README.zh-CN.md` (brief), `lib/client.js` UI_TEXT

**Step 1: README — add "Custom providers & DSH discovery" section**

Cover: chain ordering, custom OpenAI/Anthropic providers, DSH auto-discovery, fallback chain, new settings UI.

**Step 2: UI_TEXT — fill 8 languages for new keys** (translate the new strings; if unsure, use English)

**Step 3: Commit**

```bash
git add README.md README.zh-CN.md lib/client.js
git commit -m "docs: custom providers + DSH discovery usage"
```

---

### Task 10: Final review + PR

**Step 1: Full test pass** — `node --check` both files, `node --test test/`

**Step 2: Verify no Windows regressions** — grep that `reg query` branch is untouched in `getProxy`; `viaBing` still uses `www.bing.com` base.

**Step 3: Open PR** (repo `UncleK/dsh-think-translate`, branch `feature/dynamic-provider-chain`)

```bash
gh pr create --repo UncleK/dsh-think-translate --title "feat: dynamic provider chain — custom OpenAI/Anthropic + DSH discovery" --body-file /tmp/pr-body.md
```

**Step 4: Respond to review; update commits as needed.**

---

## Notes / Risks

- **YAML parsing**: settings.yaml uses nested maps. The minimal parser in Task 4 must handle `llm-pi-ai: providers: name: baseURL/...`. Write a small fixture-based test in Task 6 for the parser.
- **Full-replace config**: client delete needs `_full` semantics — implement carefully in Task 5.
- **No build step**: client.js edits apply on page refresh; host edits need web restart.
- **Cross-platform**: DSH_HOME resolution differs macOS vs Windows; keep both branches.
- **Do not commit** `lib/config.json` or any real API keys.
