# Dynamic Provider Chain — Design

> **Date:** 2026-09-01
> **Status:** Draft → Approved
> **PR:** (to be created after implementation)

## 1. Motivation

The current plugin has a fixed 3-provider chain (`google`, `bing`, `openai`). Users want:

- **Custom models** — add arbitrary OpenAI-compatible endpoints and Anthropic (Messages API) endpoints as translation providers
- **DSH service provider integration** — auto-discover providers already configured in the DSH harness (`settings.yaml` → `llm-pi-ai.providers`) and use their models
- **Flexible ordering** — drag-and-sort all providers, set preferred order, and configure a separate fallback chain
- **Multiple custom instances** — not just one custom slot, but arbitrarily many

## 2. Configuration Model (backward-compatible)

```jsonc
{
  // Ordered chain of provider IDs to try.  Replaces the old `priority` string.
  "chain": ["google", "bing", "my-custom-1", "linuxdo"],

  // Separate fallback chain used when the main chain exhausts every provider.
  "fallback": { "enabled": true, "chain": ["google", "bing"] },

  // Provider registry — every provider used in `chain` or `fallback.chain`
  // must have an entry here.
  "providers": {
    "google":  { "type": "google",  "enabled": true },
    "bing":    { "type": "bing",   "enabled": true },
    "openai":  { "type": "openai", "enabled": true,
                 "baseURL": "http://localhost:11434/v1",
                 "model": "qwen2.5:7b-instruct",
                 "apiKey": "ollama-local" },

    // Custom OpenAI-compatible endpoint
    "my-custom-1": { "type": "openai",
                     "baseURL": "https://my-gateway.example.com/v1",
                     "apiKey": "sk-...",
                     "model": "gpt-4o-mini" },

    // DSH-auto-discovered provider (read-only in UI)
    "linuxdo":  { "type": "openai", "source": "dsh",
                  "apiKeyEnv": "LINUXDO_HUB_API_KEY",
                  "baseURL": "https://hub.oaifree.com/v1",
                  "model": "deepseek-v4-flash" },

    // Anthropic-native provider
    "claude":   { "type": "anthropic",
                  "baseURL": "https://api.anthropic.com/v1",
                  "apiKey": "sk-ant-...",
                  "model": "claude-sonnet-4-20250514" }
  }
}
```

### Migration from old format

- Old `priority: "google"` → `chain: ["google", "bing", "openai"]` (google first, rest in original order)
- Old `providers.openai` → kept as-is, referenced by `chain` entries
- `fallback` defaults to `{ enabled: true, chain: ["google", "bing"] }` when absent

## 3. Host-Side Changes (`lib/index.js`)

### 3.1 Provider Adapter Registry

The current `ADAPTERS` object is extended:

```js
const ADAPTERS = {
  google:    viaGoogle,       // unchanged
  bing:      viaBing,          // unchanged
  openai:    viaOpenAI,        // unchanged
  anthropic: viaAnthropic,     // new
}
```

Each adapter receives `(text, target, providerConfig)` where `providerConfig` is the per-provider entry from `config.providers[id]`.

### 3.2 `viaAnthropic` — New Adapter

**Request format (Anthropic Messages API):**

```
POST {baseURL}/v1/messages
Headers:
  x-api-key: {cfg.apiKey}
  anthropic-version: 2023-06-01
  Content-Type: application/json

Body:
{
  "model": {cfg.model},
  "max_tokens": 4096,
  "system": "{OPENAI_SYSTEM}",
  "messages": [
    { "role": "user", "content": "Target language: {to}\n\n{text}" }
  ]
}
```

**Response parsing:**

```json
{
  "content": [
    { "type": "text", "text": "translated text here" }
  ]
}
```

- Loopback (localhost) → Node `fetch`; remote → `curlPostJson` (same strategy as `viaOpenAI`)
- Timeout: 15 s for local, 40 s for remote (curl max-time)
- Error: non-200 → `anthropic HTTP {status}`; missing `content[0].text` → `anthropic empty output`

### 3.3 DSH Provider Discovery

```js
async function discoverDshProviders() {
  // 1. Read settings.yaml (llm-pi-ai.providers section)
  // 2. Read .credentials.yaml (refs section)
  // 3. For each provider with api: "openai-completions", create a
  //    type=openai provider entry with `source: "dsh"`, `apiKeyEnv`,
  //    `baseURL`, `models` list.
  // 4. The first model in the models list is set as the default.
  // 5. Optionally mark the provider as `enabled: false` so the user
  //    must explicitly add it to their chain.
  // 6. Expose via `/_xlate/dsh-scan` (GET → re-scan and return merged).
}
```

- Called at plugin `apply()` time, on first config load.
- Returns an array of provider entries that are **merged into** `config.providers` (existing entries with the same ID are not overwritten — user overrides take priority).
- DSH providers are tagged `source: "dsh"` so the UI can render them as read-only.

### 3.4 Chain Execution

Replaces the current `translateViaChain`:

```js
async function translateViaChain(text, target, cfg) {
  const ids = cfg.chain || [];
  const fallback = cfg.fallback;
  let lastErr = null;

  // Primary chain
  for (const id of ids) {
    const p = cfg.providers?.[id];
    if (!p || !p.enabled) continue;
    const adapter = ADAPTERS[p.type];
    if (!adapter) continue;
    try {
      const chunks = chunkText(text);
      const outs = await Promise.all(chunks.map(c => adapter(c, target, p)));
      // ...cache & return
      return { ok: true, text: outs.join('\n\n'), provider: id, ... };
    } catch (e) { lastErr = e; }
  }

  // Fallback chain (if enabled)
  if (fallback?.enabled && fallback.chain?.length) {
    for (const id of fallback.chain) {
      // same logic as primary chain
    }
  }

  // All failed
  return { ok: false, text, error: lastErr?.message || 'translate unavailable' };
}
```

- The `priority` + `providers[id].enabled` logic is replaced by the explicit `chain` array.
- `fallback` is independent — it can include providers already in the main chain (to retry with different timeouts) or a different set.

### 3.5 Config Routes

Extend `/_xlate/config` (POST):

- Accept full `chain` array, `fallback` object, and `providers` patch.
- Validate: `type` ∈ {google, bing, openai, anthropic}; `chain` entries must exist in `providers`.
- On save, return the merged config (same as current behavior).

New route `/_xlate/dsh-scan` (GET):

- Re-reads `settings.yaml` + `.credentials.yaml`, merges DSH providers, and returns the full config.
- Does not modify user-custom providers (only adds/updates DSH-sourced ones).

## 4. Client-Side Changes (`lib/client.js`)

### 4.1 Provider List UI

Replace the current single `<select>` for priority with a dynamic list:

```
┌────────────────────────────────────────────┐
│  Provider chain (drag to reorder)          │
│                                            │
│  [google gtx (free)]  ✓  [↑][↓] [test]    │
│  [bing (free)]        ✓  [↑][↓] [test]    │
│  [my-custom-1]        ✓  [↑][↓] [✎][✕]   │
│  [linuxdo]     [DSH]  ✓  [↑][↓] [test]    │
│                                            │
│  [+ Add custom provider]                   │
│                                            │
│  ☑ Enable fallback                         │
│  Fallback chain: [google] [bing]           │
└────────────────────────────────────────────┘
```

- Each row: [type icon] [name] [source badge] [on/off] [up/down] [test] [edit/delete]
- DSH providers: `source: "dsh"` → grey badge, no edit/delete
- Custom providers: may be edited or deleted
- Sorting: up/down buttons + HTML5 drag-and-drop (`draggable` attribute + `dragstart`/`dragover`/`drop` handlers, no external library)
- "Add custom provider" → inline form: name, type (`openai` | `anthropic`), baseURL, apiKey, model

### 4.2 Provider-Specific Settings Panel

When a provider row is expanded (or in a side panel), show:

- **google / bing**: no extra config (built-in)
- **openai**: baseURL, apiKey (password field), model (text input)
- **anthropic**: baseURL, apiKey, model (same pattern)

### 4.3 Single-Provider Test

Each row has a "test" button that POSTs `/_xlate/translate` with an optional `provider` override (new feature):

```http
POST /_xlate/translate
{ "text": "Hello world", "target": "zh-CN", "provider": "my-custom-1" }
```

The host side routes to the specified provider directly (skipping chain logic). Result shown inline.

### 4.4 Fallback UI

- A toggle switch for `fallback.enabled`
- When enabled, a mini chain editor (same drag-drop list) for `fallback.chain`
- Default: enabled, chain = `["google", "bing"]`

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| DSH settings.yaml missing | Skip discovery, no DSH providers shown |
| DSH .credentials.yaml missing | Skip DSH providers that need apiKeyEnv |
| Custom provider missing baseURL/apiKey | Mark as disabled in chain, show inline error |
| Provider test fails | Show error message under the row |
| Chain has circular reference (main + fallback same) | Allow — it just retries; no circular exec risk |
| Old config without `chain` field | Auto-migrate from `priority` at load time |

## 6. Testing Plan

- **Unit (host)**: mock `fetch` + `runProgram`, test `viaAnthropic` request/response parsing, test DSH provider discovery, test chain ordering
- **Unit (client)**: render the provider list with various config shapes, simulate drag reorder, add/delete custom provider
- **Integration**: set up a real OpenAI-compatible test endpoint, verify chain picks the right provider, verify fallback kicks in when main chain fails
- **Migration**: start with old config format (`priority: "google"`), verify auto-migration to `chain` format

## 7. Future Considerations (not in scope)

- Per-provider timeout/retry knobs
- Conditional routing (e.g., zh→ja routes to a specific provider)
- Real-time provider health check (ping every N minutes)
- DSH provider config write-back (plugin modifies settings.yaml — risky, pending DSH API)