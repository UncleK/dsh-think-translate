# 🐋 dsh-think-translate

**Languages:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

Translate the **reasoning / thinking chain (chain-of-thought), task cards and answers** of the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI into one of **8 target languages** — in real time, on the display layer only. The originals stay untouched in the transcript, and the translated text **never enters the model context**.

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ Why dsh-think-translate

DeepSeek-class models often reason in Chinese — or in whatever language they happen to think in. dsh-think-translate renders the **Think row, task cards and answer** in *your* language while you watch, like subtitles for the model's thinking.

- **🕵️ Read any thinking chain** — reasoning, chain-of-thought, task cards and answers translated in real time, streamed batch by batch
- **🌍 8 languages, one consistent UI** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский; the settings panel, thinking rows and task cards all follow your choice, and it persists across reloads
- **🔒 Private & offline-first** — local Ollama (qwen2.5:7b / 14b or custom) is the default provider: free, unlimited, nothing leaves your machine. First local-model selection **auto-downloads** the model with a live progress bar and enables it when done
- **🧠 Zero context cost** — pure display layer: the model still sees the original text, and translated text never consumes the context window
- **☁️ Google / Bing fallback** — automatic switch when the local model is unavailable (google goes through a Node CONNECT tunnel using the system proxy, bypassing anti-bot blocks)
- **🛡️ Code-safe** — file paths, commands, URLs, regexes and pure-code lines are never translated
- **🧩 Paragraph & sentence-aware chunking** — long thinking chains are split on blank lines (paragraph structure preserved) and further batched by sentence, so even a small local model keeps quality
- **⏱️ Resilient** — 3× backoff retries, browser-direct fallback, failed results never cached
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

## 🚀 Usage

1. Open **Settings → Think Translation**
2. Pick the **target language** (e.g. 日本語) — the settings panel, thinking rows and task cards all switch to it
3. Pick the **preferred provider**:
   - **Local model (Ollama)** — on first selection a download prompt appears (qwen2.5:7b / 14b or custom); it auto-enables when finished. The "+" button next to the model picker downloads more models anytime
   - **google gtx / bing** — works out of the box (auto system proxy / VPN)
4. Send a message that makes the model think, then expand the **Think row** to read the translation and compare with the original

## 🎬 Demo

<!-- TODO: record an animated demo (English thinking chain → streaming 日本語/中文 translation, originals preserved) and drop it here as docs/demo.gif -->

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
- **Client half** (`lib/client.js`): 8-language UI, sentence/paragraph-batched translation, streaming Think rows, localStorage persistence (settings + translation cache)
- Pure display layer: originals remain in the transcript and model context

## 🛠 Development

- No build step: `lib/client.js` is the browser bundle (source = artifact), `lib/index.js` is the host ESM
- Client changes apply on page refresh; host changes need a web restart
- The 8-language strings live in the `UI_TEXT` dictionary in `lib/client.js`

## 📄 License

MIT
