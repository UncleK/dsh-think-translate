# 🐋 dsh-think-translate

**Languages:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

Display-layer translation for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI. The **thinking chain (Think row), task cards and answer text** are displayed in your chosen target language — while the originals stay intact in the transcript.

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ Features

- **8 target languages** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Single-language UI** — settings panel, thinking rows and task cards all follow the target language (no mixed zh/en); your choice persists across reloads
- **Local model first** — uses your local Ollama model (qwen, etc.): private, offline, free. First local-model selection **auto-triggers the download** with a live progress bar; the model is configured and enabled automatically when done
- **Google / Bing fallback** — automatic switch when the local model is unavailable (google goes through a Node CONNECT tunnel using the system proxy, bypassing anti-bot blocks)
- **Code artifacts skipped** — file paths, commands, URLs, regexes and pure-code lines are never translated
- **Sentence-batched translation** — long thinking chains are translated in small sentence batches so local small models keep quality
- **Streaming output** — translations appear batch by batch while thinking; expand the Think row to compare with the original
- **Resilient** — host requests retry with backoff (3×), browser-direct fallback, failed results are never cached

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

## 🚀 Usage

1. Open **Settings → Think Translation**
2. Pick the **target language** (e.g. 日本語) — the settings panel, thinking rows and task cards all switch to it
3. Pick the **preferred provider**:
   - **Local model (Ollama)** — on first selection a download prompt appears (qwen2.5:7b / 14b or custom); it auto-enables when finished. The "+" button next to the model picker downloads more models anytime
   - **google gtx / bing** — works out of the box (auto system proxy / VPN)
4. Send a message and expand the Think row to see the translation

## ⚙️ How it works

```
browser → POST /_xlate/translate (same-origin, no CORS)
  → host provider chain (fail-open):
      openai-compatible (local Ollama, Node fetch to loopback)
      → google gtx (Node https + CONNECT tunnel through system proxy)
      → bing (curl form)
  → browser-direct fallback
```

- **Host half** (`lib/index.js`): provider adapters, LRU cache (600), `/_xlate/models` listing, `/_xlate/model/pull` + `pull-status` model download management (auto-configures on completion)
- **Client half** (`lib/client.js`): 8-language UI, sentence-batched translation, streaming Think rows, localStorage persistence
- Pure display layer: originals remain in the transcript and model context

## 🛠 Development

- No build step: `lib/client.js` is the browser bundle (source = artifact), `lib/index.js` is the host ESM
- Client changes apply on page refresh; host changes need a web restart
- The 8-language strings live in the `UI_TEXT` dictionary in `lib/client.js`

## 📄 License

MIT
