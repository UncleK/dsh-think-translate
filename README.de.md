<div align="center">

# 🐋 dsh-think-translate

**Sprachen:** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif?v=2" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="demo/demo2.gif?v=2" width="41%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

Übersetzung auf Anzeigeebene für die Web-Oberfläche von [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): Die **Gedankenkette (Think-Zeile), Aufgabenkarten und der Antworttext** werden in der gewählten Zielsprache angezeigt, während die Originale im Verlauf unverändert bleiben und der übersetzte Text **nie in den Modellkontext gelangt**.

## ✨ Funktionen

Modelle der DeepSeek-Familie denken oft auf Chinesisch — oder in der Sprache, in der sie gerade denken. dsh-think-translate zeigt die Think-Zeile, Aufgabenkarten und die Antwort live in *Ihrer* Sprache an, wie Untertitel für das Denken des Modells.

- **🕵️ Jede Gedankenkette lesbar** — Reasoning, Gedankenkette, Aufgabenkarten und Antworten in Echtzeit übersetzt, in Stapeln gestreamt
- **8 Zielsprachen** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Einsprachige Oberfläche** — Einstellungsbereich, Denkzeilen und Aufgabenkarten folgen der Zielsprache (kein zh/en-Gemisch); die Auswahl bleibt erhalten
- **Lokales Modell zuerst** — nutzt Ihr lokales Ollama-Modell (qwen usw.): privat, offline, kostenlos. Die erste Auswahl **startet den Download automatisch** mit Fortschrittsbalken; das Modell wird danach automatisch konfiguriert und aktiviert
- **🧠 Null Kontextkosten** — reine Anzeigeschicht: das Modell sieht weiterhin den Originaltext, und übersetzter Text verbraucht niemals das Kontextfenster
- **Google / Bing-Fallback** — automatische Umschaltung, wenn das lokale Modell nicht verfügbar ist (google nutzt einen Node-CONNECT-Tunnel über den Systemproxy)
- **Code-Artefakte übersprungen** — Pfade, Befehle, URLs, Regexes und reine Codezeilen werden nie übersetzt
- **Satzweise Batch-Übersetzung** — lange Denkketten werden in kleinen Sätzen übersetzt, damit lokale kleine Modelle Qualität behalten
- **🧩 Absatz- und satzweise Zerlegung** — lange Denkketten werden an Leerzeilen geteilt (Absatzstruktur bleibt erhalten) und zusätzlich satzweise gebündelt, damit kleine lokale Modelle Qualität behalten
- **Streaming-Ausgabe** — Übersetzungen erscheinen während des Denkens batchweise; Think-Zeile aufklappen zum Vergleich mit dem Original
- **🎚️ Einstellbarer Übersetzungszeitpunkt** — alles vorübersetzen / alte Ketten lazy laden (Standard) / nur beim Aufklappen
- **🔗 Dynamische Anbieter-Kette** — die Listenreihenfolge ist die Ausführungsreihenfolge: ziehen zum Sortieren, jede Zeile einzeln ein-/ausschalten. Integriert google gtx / bing / lokales Ollama plus beliebige eigene Endpunkte
- **🔌 Eigene Anbieter (OpenAI & Anthropic)** — im Panel jeden OpenAI-kompatiblen Endpunkt (`/v1/chat/completions`) oder die **Anthropic Messages API** (Claude) hinzufügen: Typ, Vorlage, Basis-URL, API-Schlüssel, Modell
- **🪄 DSH-konfigurierte Anbieter übernehmen** — liest schreibgeschützte DSH-Zeilen aus `settings.yaml` (`llm-pi-ai.providers`); eine Schaltfläche liest neu ein und fügt alle der Kette hinzu. Der Schlüssel wird pro Anfrage aus `.credentials.yaml` aufgelöst und nie in der Plugin-Konfiguration gespeichert. Auch die eigene Standardroute des Harness zählt: zeigt `agent-default-model` auf `deepseek-official`, erscheint die offizielle DeepSeek-API als weitere DSH-Zeile
- **⏱️ Robust** — 3 Wiederholungen mit Backoff + direkter Browser-Fallback, Test-Schaltfläche pro Zeile, Fehlschläge werden nie zwischengespeichert

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

## 🧯 Nach einem DSH-Upgrade

Client-Plugins von Drittanbietern werden über den Client-Modulgraphen von DSH geladen, und dieser Graph wird **pro Prozess nur einmal** zusammengesetzt – eine fehlgeschlagene Komposition bleibt bis zum Neustart im Speicher. Deshalb passieren direkt nach einem Upgrade meist diese drei Dinge.

- **Der Start aus einem Source-Checkout schlägt fehl** mit `client bundles not found; run \`pnpm run build\` before launch` —— die neuen Client-Pakete sind nicht gebaut: führe `pnpm run build` im Harness-Checkout aus und starte `dsh web` erneut.
- **Die Plugin-Oberfläche ist verschwunden** (keine übersetzte Think-Zeile, kein Abschnitt *Übersetzung der Gedankenkette* in den Einstellungen) —— **starte `dsh web` einmal neu**; ein bloßes Neuladen der Seite reicht manchmal nicht.
- **Die Liste der lokalen Modelle ist leer** —— der `ollama`-Dienst bedient dieses Modellverzeichnis nicht: prüfe `ollama list` (oder `GET /api/tags`) und das `OLLAMA_MODELS`, das der laufende Dienst tatsächlich verwendet. Liegen die Modelldateien auf einem anderen Laufwerk, kann ein Verzeichnis-Junction das Standardverzeichnis des Dienstes dorthin zeigen lassen.

Am Plugin ist nichts zu konfigurieren: Es deklariert keine Reihenfolge-Abhängigkeit zu DSH-Interna (es bindet nur den `slots`-Dienst und optional `@deepseek-ai/dsh-client-ui-primitives`) und läuft daher sowohl auf älterem DSH (≤ 0.1.1-rc) als auch auf der aktuellen Linie (≥ 0.1.2-alpha.1, inklusive 0.1.5-rc.1).

## 🚀 Verwendung

1. **Einstellungen → Übersetzung der Gedankenkette** öffnen
2. Die **Zielsprache** wählen (z. B. Deutsch) — Einstellungen, Denkzeilen und Karten wechseln in diese Sprache
3. Die **Anbieterkette** verwalten (ziehen zum Sortieren, ankreuzen zum Aktivieren):
   - Integriert: **google gtx / bing** (kostenlos, sofort nutzbar, Systemproxy) und **lokales Modell (Ollama)** (bei der ersten Auswahl werden 7b/14b oder ein eigenes Modell geladen)
   - **DSH-Anbieter**: in `settings.yaml` konfigurierte Endpunkte erscheinen automatisch (schreibgeschützt; ankreuzen fügt sie der Kette hinzu). Die Schaltfläche **Aus DSH-Konfiguration übernehmen** direkt unter der Liste liest die Konfiguration neu ein und fügt alle auf einmal hinzu – keine baseURL und kein Schlüssel zum Neutippen, denn der Schlüssel wird aus den DSH-Credentials aufgelöst
   - Der Schlüssel wird eingetippt oder kommt als **`apiKeyEnv`** aus einer Vorlage bzw. einer DSH-Zeile: diese Zeile zeigt das `env:NAME`-Abzeichen, und der Schlüssel wird pro Anfrage aufgelöst und nie in `config.json` geschrieben. Das Bearbeitungsformular hat kein Feld für die Umgebungsvariable (der Wert bleibt erhalten), aber ein geleertes Feld wird wirklich gelöscht (als explizite Löschung gesendet)
   - Abgewählte Anbieter werden übersprungen. Details stehen in [README.md](README.md)
4. Nachricht senden und die Think-Zeile aufklappen, um die Übersetzung zu sehen

## ⚙️ Funktionsweise

```
Browser → POST /_xlate/translate (gleiche Origin, kein CORS)
  → Anbieterkette im Host (fail-open, umsortierbar):
      chain: [provider1, provider2, ...]   ← Reihenfolge per Drag in den Einstellungen
        google / bing / OpenAI-kompatibel / Anthropic
      Fallback-Kette (optional, standardmäßig aus, in der Config aktivierbar)
  → direkter Browser-Fallback
```

- Die **Anbieter-Konfiguration** liegt in `config.json` (zur Laufzeit erzeugt, gitignoriert): `chain` (geordnete IDs), `fallback` (enabled + chain, nur Datei), `providers` (je Anbieter `type`/`enabled`/`baseURL`/`apiKey`/`apiKeyEnv`/`model`). Alte `priority`-Konfigurationen werden automatisch migriert; ein Anbieter mit `apiKeyEnv` löst seinen Schlüssel pro Anfrage aus dieser Umgebungsvariable auf (der literale `apiKey` bleibt als Rückfall) und kein aufgelöster Schlüssel wird je in `config.json` zurückgeschrieben; ein `null` in einem Patch löscht das Feld — so leert die Oberfläche eines
- Die **DSH-Erkennung** liest beim Laden `settings.yaml` (`llm-pi-ai.providers`) und `.credentials.yaml` (`refs`) des Harness; erkannte Anbieter tragen `source: "dsh"`, aufgelöste Schlüssel bleiben im Speicher (nie in `config.json`), und die Route `/_xlate/dsh-scan` liest sie bei Bedarf neu ein
- **Host-Hälfte** (`lib/index.js`): Anbieteradapter, LRU-Cache (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (automatische Konfiguration am Ende)
- **Client-Hälfte** (`lib/client.js`): 8-sprachige UI, satzweise Batch-Übersetzung, Streaming-Think-Zeilen, localStorage-Persistenz
- Reine Anzeigeschicht: Originale bleiben im Verlauf und im Modellkontext erhalten

## 🛠 Entwicklung

- Kein Build-Schritt: `lib/client.js` ist das Browser-Bundle (Quelle = Artefakt); `lib/index.js` ist das Host-ESM
- Client-Änderungen greifen nach dem Aktualisieren; Host-Änderungen erfordern einen Web-Neustart
- Die 8-sprachigen Texte stehen im `UI_TEXT`-Wörterbuch in `lib/client.js`

## 📄 Lizenz

MIT
