# 🐋 dsh-think-translate

**Sprachen:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

Übersetzung auf Anzeigeebene für die Web-Oberfläche von [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): Die **Gedankenkette (Think-Zeile), Aufgabenkarten und der Antworttext** werden in der gewählten Zielsprache angezeigt, während die Originale im Verlauf unverändert bleiben und der übersetzte Text **nie in den Modellkontext gelangt**.

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ Funktionen

Modelle der DeepSeek-Familie denken oft auf Chinesisch — oder in der Sprache, in der sie gerade denken. dsh-think-translate zeigt die Think-Zeile, Aufgabenkarten und die Antwort live in *Ihrer* Sprache an, wie Untertitel für das Denken des Modells.

- **8 Zielsprachen** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Einsprachige Oberfläche** — Einstellungsbereich, Denkzeilen und Aufgabenkarten folgen der Zielsprache (kein zh/en-Gemisch); die Auswahl bleibt erhalten
- **Lokales Modell zuerst** — nutzt Ihr lokales Ollama-Modell (qwen usw.): privat, offline, kostenlos. Die erste Auswahl **startet den Download automatisch** mit Fortschrittsbalken; das Modell wird danach automatisch konfiguriert und aktiviert
- **🧠 Null Kontextkosten** — reine Anzeigeschicht: das Modell sieht weiterhin den Originaltext, und übersetzter Text verbraucht niemals das Kontextfenster
- **Google / Bing-Fallback** — automatische Umschaltung, wenn das lokale Modell nicht verfügbar ist (google nutzt einen Node-CONNECT-Tunnel über den Systemproxy)
- **Code-Artefakte übersprungen** — Pfade, Befehle, URLs, Regexes und reine Codezeilen werden nie übersetzt
- **Satzweise Batch-Übersetzung** — lange Denkketten werden in kleinen Sätzen übersetzt, damit lokale kleine Modelle Qualität behalten
- **🧩 Absatz- und satzweise Zerlegung** — lange Denkketten werden an Leerzeilen geteilt (Absatzstruktur bleibt erhalten) und zusätzlich satzweise gebündelt, damit kleine lokale Modelle Qualität behalten
- **Streaming-Ausgabe** — Übersetzungen erscheinen während des Denkens batchweise; Think-Zeile aufklappen zum Vergleich mit dem Original
- **Robust** — Host-Anfragen mit Backoff (3×), Browser-Direkt-Fallback, Fehlschläge werden nie gecacht

## 📦 Installation

```bash
# Option 1: npm (empfohlen)
dsh plugin --profile web add dsh-think-translate
# dann web neu starten

# Option 2: GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# Option 3: manuell (Junction + Patch)
#  1. Paket in das node_modules des Profils verlinken
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<Repository-Pfad>"
#  2. zu "$HOME\.dsh\profiles\web\cordis.patch.yml" hinzufügen:
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. web neu starten
```

## 🚀 Verwendung

1. **Einstellungen → Übersetzung der Gedankenkette** öffnen
2. Die **Zielsprache** wählen (z. B. Deutsch) — Einstellungen, Denkzeilen und Karten wechseln in diese Sprache
3. Den **bevorzugten Anbieter** wählen:
   - **Lokales Modell (Ollama)** — bei der ersten Auswahl erscheint ein Download-Button (qwen2.5:7b / 14b oder benutzerdefiniert); es aktiviert sich automatisch am Ende. Der "+"-Button neben der Auswahl lädt weitere Modelle
   - **google gtx / bing** — funktioniert sofort (Systemproxy / VPN automatisch)
4. Nachricht senden und die Think-Zeile aufklappen, um die Übersetzung zu sehen

## 🎬 Demo

<!-- TODO: animierte Demo aufnehmen (englische Gedankenkette → Streaming-Übersetzung, Originale erhalten) und als docs/demo.gif ablegen -->

## ⚙️ Funktionsweise

```
Browser → POST /_xlate/translate (gleicher Ursprung, kein CORS)
  → Host-Anbieterkette (fail-open):
      OpenAI-kompatibel (lokales Ollama, Node fetch zum Loopback)
      → google gtx (Node https + CONNECT-Tunnel über den Systemproxy)
      → bing (curl form)
  → Browser-Direkt-Fallback
```

- **Host-Hälfte** (`lib/index.js`): Anbieteradapter, LRU-Cache (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (automatische Konfiguration am Ende)
- **Client-Hälfte** (`lib/client.js`): 8-sprachige UI, satzweise Batch-Übersetzung, Streaming-Think-Zeilen, localStorage-Persistenz
- Reine Anzeigeschicht: Originale bleiben im Verlauf und im Modellkontext erhalten

## 🛠 Entwicklung

- Kein Build-Schritt: `lib/client.js` ist das Browser-Bundle (Quelle = Artefakt); `lib/index.js` ist das Host-ESM
- Client-Änderungen greifen nach dem Aktualisieren; Host-Änderungen erfordern einen Web-Neustart
- Die 8-sprachigen Texte stehen im `UI_TEXT`-Wörterbuch in `lib/client.js`

## 📄 Lizenz

MIT
