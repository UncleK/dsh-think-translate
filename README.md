<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/hero.en.png?v=1.2.16" alt="dsh-think-translate — AI thinking, in your language" width="100%" />
</p>

<p align="center">
  <b>Display-layer translation for DeepSeek Harness.</b><br />
  Read the reasoning, follow the tasks, and understand the answers. Originals are preserved; translations stay out of model context.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-mit.en.svg?v=1.2.16" alt="MIT License" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-local.en.svg?v=1.2.16" alt="Local Ollama" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-original.en.svg?v=1.2.16" alt="Originals preserved" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> · <b>English</b> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-quick-start.en.svg?v=1.2.16" alt="Quick install" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-demo.en.svg?v=1.2.16" alt="Live demos" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-features.en.svg?v=1.2.16" alt="Features" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-comparison.en.svg?v=1.2.16" alt="Official comparison" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-faq.en.svg?v=1.2.16" alt="FAQ" height="24" /></a>
</p>

---

<a id="demo"></a>
## See thinking unfold

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo.gif?v=1.2.16" alt="Demo 1 · Reasoning and answers" width="100%" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo2.gif?v=1.2.16" alt="Demo 2 · More live operations" width="100%" />
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>Demo 1 · Reasoning and answers</sub></td>
<td align="center" valign="top"><sub>Demo 2 · More live operations</sub></td>
</tr>
</table>

<a id="comparison"></a>
## Comparison with the official translation plugin

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/translation-comparison.en.png?v=1.2.16" alt="Comparison with the official translation plugin" width="100%" />
</p>

Enable either this plugin or the official reasoning translator. Both take over the reasoning interface.

<a id="quick-start"></a>
## One command to get started

```bash
dsh plugin --profile web add dsh-think-translate
```

After installation, fully restart DSH Web. Open **Settings → Think Translation**, then choose the target language and providers.

<details>
<summary><b>GitHub installation, updates and other methods</b></summary>

Install from GitHub:

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

Update from npm:

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

Fully restart DSH after installing or updating. For manual deployment, link the package into the profile and add its entry to `cordis.patch.yml`; the commands above are recommended for everyday use.

</details>

<a id="features"></a>
## More than reasoning to understand

<table>
<tr>
<td width="50%" valign="top">
<h3>Reasoning, as it happens</h3>
<p>Pre-translate all, lazy-load history, or translate only when expanded</p>
</td>
<td width="50%" valign="top">
<h3>Tasks and answers, together</h3>
<p>Reasoning, task cards and composer task lists; optional answers and auto-review denial reasons</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Understand review decisions</h3>
<p>When auto-review rejects a tool call, its reason is translated alongside the original. The existing decision buttons remain available.</p>
</td>
<td width="50%" valign="top">
<h3>Preserve originals and code</h3>
<p>Originals preserved; translations stay out of model context. Reuses Markdown rendering; protects code, paths and commands before translation.</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Local models, loaded on demand</h3>
<p>Manual release, release when unchecked, idle auto-release; reloads on the next translation</p>
</td>
<td width="50%" valign="top">
<h3>Providers in your preferred order</h3>
<p>Automatic fallback in enabled order; clearly wrong-language output tries the next provider; retry after cooldown</p>
</td>
</tr>
</table>

### Connect providers you already use

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

Discover providers already configured in DSH without entering endpoints and keys again. Test each provider separately; list order controls the order of attempts.

```text
Your first choice → next enabled provider → … → originals if all fail
```

<details>
<summary><b>Custom endpoints, credentials and recovery</b></summary>

- Custom endpoints support OpenAI-compatible `/v1/chat/completions` and the native Anthropic Messages API.
- Discovery reads the current DSH profile and overrides. Rescan and add discovered providers to the translation chain.
- An `apiKeyEnv` key is resolved at request time; resolved credentials are never written back to plugin configuration.
- Failures cool down in host memory for 30 seconds, then subsequent translation requests can retry. Clearly wrong-language results try the next provider.
- Language detection skips text already recognized as the target language; explicit provider tests still make a real request.

</details>

### Local translation models: load and release on demand

| Your action | Plugin behavior |
|---|---|
| Translate or test | Start the service and load the selected model on demand |
| Release model memory | Wait for active translations, then unload; preserve files, switches and order |
| Uncheck the local provider | Disable it and unload the selected model |
| Re-enable it or open settings | No preload; load on the next actual translation |
| Set idle release | 5 minutes by default; choose 1 / 5 / 10 / 30 / 60 minutes or off |

Idle timing applies from the next use. Ollama tracks the selected model; global environment variables are unchanged. Missing software or models are installed or downloaded only after you click the preparation button, with progress shown.

<a id="languages"></a>
### Language settings that follow you

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

Nine target languages, settings translations and task labels, including Portuguese. Your selection survives a page refresh.

<a id="faq"></a>
## Answers to common questions

<details>
<summary><b>No translation entry after installing or updating</b></summary>

Fully restart `dsh web`. The client module graph is assembled at process start; refreshing the page alone may not load a new plugin. The settings footer shows the installed package version.

</details>

<details>
<summary><b>The local model list is empty</b></summary>

Check `ollama list` or `/api/tags`, the active model directory, and the service’s `OLLAMA_MODELS`. Existing model files do not need to be downloaded again.

</details>

<details>
<summary><b>Source startup reports client bundles not found after a DSH update</b></summary>

Run `pnpm run build` in the DeepSeek Harness repository, then restart DSH Web.

</details>

<details>
<summary><b>Does a translation failure affect the conversation?</b></summary>

When all enabled providers fail, the original remains. Test individual providers and inspect the latest error in settings. Translation requests can retry after cooldown.

</details>

<details>
<summary><b>Recent changes and compatibility</b></summary>

**1.2.16** adds Portuguese throughout the translation target and UI, refreshes all nine READMEs and localized comparison images, and declares three marketplace images.

**1.2.15** adds local model memory management and adapts to DSH `0.2.2-alpha.2` image rendering, grouped reasoning collapse and original text selection.

**1.2.13** adds auto-review denial-reason translation. Thanks to [llg1634](https://github.com/llg1634) for the report, initial patch and testing.

Earlier versions and details: [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases).

</details>

<details>
<summary><b>Development and internals</b></summary>

- `lib/index.js`: host routes, providers, configuration, memory cache and local model lifecycle.
- `lib/client.js`: settings, display-layer translation, streaming batches and browser cache.
- `lib/config.json`: runtime configuration, excluded from Git and npm.
- No extra build step: source files are the deliverable. Restart DSH after changing host code.
- Run checks with `npm test`. Discovery and credential handling are documented in the [maintenance notes](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md).

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">Report an issue</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">Releases</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">MIT License</a>
</p>
