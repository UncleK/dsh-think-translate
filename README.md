<div align="center">

# 🐋 dsh-think-translate

**Languages:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />
<img src="demo/demo2.gif" width="46%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

Translate the **reasoning / thinking chain (chain-of-thought), task cards and answers** of the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI into one of **8 target languages** — in real time, on the display layer only. The originals stay untouched in the transcript, and the translated text **never enters the model context**.

## ✨ Why dsh-think-translate

DeepSeek-class models often reason in Chinese — or in whatever language they happen to think in. dsh-think-translate renders the **Think row, task cards and answer** in *your* language while you watch, like subtitles for the model's thinking.

- **🕵️ Read any thinking chain** — reasoning, chain-of-thought, task cards and answers translated in real time, streamed batch by batch
- **🌍 8 languages, one consistent UI** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский; the settings panel, thinking rows and task cards all follow your choice, and it persists across reloads
- **🔗 Dynamic provider chain** — order providers by drag-and-drop and enable/disable each one. Built-ins (google gtx, bing, local Ollama) plus any number of custom providers; the chain already ends with the free providers, so a second fallback pass is a config-file option, not a UI one
- **🔌 Custom providers (OpenAI & Anthropic)** — add arbitrary OpenAI-compatible endpoints (any `/v1/chat/completions` gateway) or native **Anthropic Messages API** endpoints (Claude) from the settings panel: name, type, base URL, API key, model
- **🪄 DSH provider discovery** — providers already configured in DSH's `settings.yaml` (`llm-pi-ai.providers`, e.g. linuxdo-hub, coding-hub) are auto-discovered and appear in the chain as read-only "DSH" entries, and **one button in settings rescans and adds them all at once**; keys are resolved from `.credentials.yaml` at runtime and never written to the plugin's config
- **🔒 Private & offline-first** — local Ollama (qwen2.5:7b / 14b or custom) is a first-class provider: free, unlimited, nothing leaves your machine. First local-model selection **auto-downloads** the model with a live progress bar and enables it when done
- **🧠 Zero context cost** — pure display layer: the model still sees the original text, and translated text never consumes the context window
- **☁️ Google / Bing fallback** — automatic switch when other providers are unavailable (google goes through a Node CONNECT tunnel using the system proxy, bypassing anti-bot blocks)
- **🛡️ Code-safe** — file paths, commands, URLs, regexes and pure-code lines are never translated
- **🧩 Paragraph & sentence-aware chunking** — long thinking chains are split on blank lines (paragraph structure preserved) and further batched by sentence, so even a small local model keeps quality
- **⏱️ Resilient** — 3× backoff retries, per-provider test buttons, failed results never cached
- **🎚️ Adjustable translation timing** — pre-translate everything, lazy-load historical chains (default), or translate only the expanded chain

## 📦 Installation

```bash
# Option 1: npm (recommended)
dsh plugin --profile web add dsh-think-translate
# then restart web

# Option 2: GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# Option 3: manual (junction + patch)
#  1. link the package into the profile's node_modules
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<repo path>"
#  2. add to "$HOME\.dsh\profiles\web\cordis.patch.yml":
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. restart web
```

## 🧯 After a DSH upgrade

Third-party client plugins load through DSH's client module graph, and that graph is composed **once per process** — a composition that failed is remembered in memory until the process restarts. So these three things commonly bite right after an upgrade:

- **Starting from a source checkout fails with** `client bundles not found; run \`pnpm run build\` before launch` — the new client packages ship unbuilt: run `pnpm run build` in the harness checkout, then start `dsh web` again.
- **The plugin's UI is gone** (no translated Think row, no *Think Translation* section in Settings) — **restart `dsh web`**; refreshing the page alone is sometimes not enough.
- **The local model list is empty** — the `ollama` service is not serving that model directory: check `ollama list` (or `GET /api/tags`) and the `OLLAMA_MODELS` the running service actually uses. When the model files live on another drive, a directory junction can point the service's default directory at them.

Nothing to configure on the plugin side: it declares no ordering dependency on DSH internals (it binds only to the `slots` service, plus an optional `@deepseek-ai/dsh-client-ui-primitives`), so it runs on both older DSH (≤ 0.1.1-rc) and the current line (≥ 0.1.2-alpha.1, 0.1.5-rc.1 included).

## 🚀 Usage

1. Open **Settings → Think Translation**
2. Pick the **target language** (e.g. 日本語) — the settings panel, thinking rows and task cards all switch to it
3. **Manage the provider chain** — the list below it *is* the delivery order; drag rows to reorder, and the checkbox is the on/off switch:
   - Built-ins: **google gtx / bing** (free, works out of the box via system proxy) and **local Ollama** — on first local-model selection a download prompt appears (qwen2.5:7b / 14b or custom); it auto-enables when finished. Built-ins are permanent: uncheck one to stop using it, there is nothing to delete
   - **DSH providers**: endpoints already configured in DSH (`llm-pi-ai.providers`) appear automatically as read-only entries (badge "DSH"); their checkbox adds/removes them from the chain. The **Import from DSH config** button right below the list rescans on click and adds all of them in one go — there is no base URL and no key to retype, because the key is resolved from DSH's own credentials at request time
   - **Custom providers**: "Add custom provider" registers any **OpenAI-compatible** or **Anthropic Messages** endpoint; the form offers **presets** for common low-cost models (DeepSeek, OpenAI, Qwen, GLM, Kimi, SiliconFlow, OpenRouter, Anthropic) that fill base URL + model + env name, all still editable; the model lists were checked against the vendors' documentation in September 2026 and are suggestions only — any model id can be typed in. Each row has a **test** button, an edit form and a **×** to delete it (a DSH row cannot be deleted — it is managed by the harness)
   - A provider can name an **environment variable** (`apiKeyEnv`) instead of carrying the key: presets fill that in, and a DSH row brings its own. The key is resolved per request and never written to `config.json`, and such a row shows an `env:NAME` badge. The edit form has no env field (the value survives an edit untouched), but emptying a field really removes it — the field is sent as an explicit delete
   - The former **fallback chain** option is gone: it was redundant once the chain itself ends with the free providers, and unchecking a provider is how you opt out of it. `fallback` still exists in `config.json` for anyone who wants it (off by default)
4. Send a message that makes the model think, then expand the **Think row** to read the translation and compare with the original

## ⚙️ How it works

```
browser → POST /_xlate/translate (same-origin, no CORS)
  → host provider chain (fail-open, user-ordered):
      chain: [provider1, provider2, ...]   ← drag-reordered in settings
        each provider is one of:
          google   (gtx via Node CONNECT tunnel / curl through system proxy)
          bing     (ttranslatev3 via curl)
          openai   (OpenAI-compatible /chat/completions — Ollama local or any gateway)
          anthropic(Anthropic Messages API /v1/messages)
      fallback chain (config-only, off by default) tried when the primary chain fails entirely
  → browser-direct fallback
```

- **Provider config** lives in `config.json` (runtime, gitignored): `chain` (ordered ids), `fallback` (enabled + chain, config-only), `providers` (per-provider `type`/`enabled`/`baseURL`/`apiKey`/`apiKeyEnv`/`model`). Old `priority`-based configs auto-migrate. A provider that declares `apiKeyEnv` resolves its key from that environment variable at request time (the literal `apiKey` stays as the fallback), and no env-resolved key is ever written back to `config.json`. A `null` field in a config patch deletes that field, which is how the UI clears one.
- **DSH discovery** reads the harness `settings.yaml` (`llm-pi-ai.providers`) and `.credentials.yaml` (`refs`) on load; discovered providers are marked `source: "dsh"`, resolved keys stay in memory (never written to `config.json`), and a `/_xlate/dsh-scan` route re-reads them on demand.
- **Host half** (`lib/index.js`): provider adapters, ordered chain + fallback execution, LRU cache (600), per-provider override for tests, `/_xlate/models` listing, `/_xlate/model/pull` + `pull-status` model download management (auto-configures on completion)
- **Client half** (`lib/client.js`): 8-language UI, drag-reorderable provider list, add/edit/delete custom providers, per-provider test buttons, sentence/paragraph-batched translation, streaming Think rows, localStorage persistence (settings + translation cache)
- Pure display layer: originals remain in the transcript and model context

## 🛠 Development

- No build step: `lib/client.js` is the browser bundle (source = artifact), `lib/index.js` is the host ESM
- Client changes apply on page refresh; host changes need a web restart
- The 8-language strings live in the `UI_TEXT` dictionary in `lib/client.js`

## 📄 License

MIT
