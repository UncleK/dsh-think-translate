<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/hero.de.png?v=1.2.16" alt="dsh-think-translate — KI-Gedanken in deiner Sprache" width="100%" />
</p>

<p align="center">
  <b>Übersetzung der Anzeigeebene für DeepSeek Harness.</b><br />
  Gedanken lesen, Aufgaben verfolgen und Antworten verstehen. Originale bleiben erhalten; Übersetzungen gelangen nicht in den Modellkontext.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-mit.de.svg?v=1.2.16" alt="MIT-Lizenz" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-local.de.svg?v=1.2.16" alt="Lokales Ollama" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-original.de.svg?v=1.2.16" alt="Originale erhalten" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> · <a href="README.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <b>Deutsch</b> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-quick-start.de.svg?v=1.2.16" alt="Installation" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-demo.de.svg?v=1.2.16" alt="Live-Demos" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-features.de.svg?v=1.2.16" alt="Funktionen" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-comparison.de.svg?v=1.2.16" alt="Vergleich" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-faq.de.svg?v=1.2.16" alt="Fragen" height="24" /></a>
</p>

---

<a id="demo"></a>
## Gedanken beim Entstehen erleben

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo.gif?v=1.2.16" alt="Demo 1 · Gedanken und Antworten" width="100%" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo2.gif?v=1.2.16" alt="Demo 2 · Weitere Bedienung" width="100%" />
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>Demo 1 · Gedanken und Antworten</sub></td>
<td align="center" valign="top"><sub>Demo 2 · Weitere Bedienung</sub></td>
</tr>
</table>

<a id="comparison"></a>
## Vergleich mit dem offiziellen Übersetzungsplugin

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/translation-comparison.de.png?v=1.2.16" alt="Vergleich mit dem offiziellen Übersetzungsplugin" width="100%" />
</p>

Aktiviere dieses Plugin oder den offiziellen Gedankenübersetzer. Beide übernehmen die Gedankenoberfläche.

<a id="quick-start"></a>
## Mit einem Befehl starten

```bash
dsh plugin --profile web add dsh-think-translate
```

Starte DSH Web nach der Installation vollständig neu. Wähle unter **Einstellungen → Gedankenübersetzung** die Zielsprache und Anbieter.

<details>
<summary><b>GitHub-Installation, Updates und weitere Methoden</b></summary>

Von GitHub installieren:

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

Über npm aktualisieren:

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

Starte DSH nach Installation oder Update vollständig neu. Manuell wird das Paket ins Profil verlinkt und in `cordis.patch.yml` eingetragen. Im Alltag sind die obigen Befehle empfohlen.

</details>

<a id="features"></a>
## Mehr verstehen als nur Gedanken

<table>
<tr>
<td width="50%" valign="top">
<h3>Gedanken live mitlesen</h3>
<p>Alles vorübersetzen, Verlauf bei Bedarf laden oder nur beim Aufklappen übersetzen</p>
</td>
<td width="50%" valign="top">
<h3>Aufgaben und Antworten gemeinsam</h3>
<p>Gedanken, Aufgabenkarten und Aufgabenliste im Eingabebereich; Antworten und Ablehnungsgründe der automatischen Prüfung optional</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Prüfentscheidungen verstehen</h3>
<p>Lehnt die automatische Prüfung einen Werkzeugaufruf ab, erscheint der Grund übersetzt neben dem Original. Die vorhandenen Entscheidungsschaltflächen bleiben verfügbar.</p>
</td>
<td width="50%" valign="top">
<h3>Originale und Code erhalten</h3>
<p>Originale bleiben erhalten; Übersetzungen gelangen nicht in den Modellkontext. Nutzt Markdown-Komponenten; schützt Code, Pfade und Befehle vor der Übersetzung.</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Lokale Modelle bei Bedarf laden</h3>
<p>Manuell, beim Abwählen oder nach Leerlauf freigeben; Laden bei der nächsten Übersetzung</p>
</td>
<td width="50%" valign="top">
<h3>Anbieter in deiner Reihenfolge</h3>
<p>Automatischer Wechsel in aktivierter Reihenfolge; klar falsche Sprache löst nächsten Anbieter aus; neuer Versuch nach Wartezeit</p>
</td>
</tr>
</table>

### Bereits genutzte Anbieter verbinden

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

DSH-Anbieter erkennen, ohne Endpunkte und Schlüssel erneut einzugeben. Jede Zeile lässt sich separat testen; die Listenreihenfolge bestimmt die Versuche.

```text
Erste Wahl → nächster aktiver Anbieter → … → Original, wenn alle scheitern
```

<details>
<summary><b>Eigene Endpunkte, Zugangsdaten und Wiederholung</b></summary>

- Unterstützt OpenAI-kompatibles `/v1/chat/completions` und die native Anthropic Messages API.
- Erkennt Anbieter im aktuellen DSH-Profil und in Überschreibungen. Erneut suchen und zur Übersetzungskette hinzufügen.
- `apiKeyEnv` wird bei der Anfrage aufgelöst; aufgelöste Schlüssel werden nicht in die Plugin-Konfiguration zurückgeschrieben.
- Fehler warten 30 Sekunden im Host-Speicher vor neuen Versuchen. Klar falsche Sprache löst den nächsten Anbieter aus.
- Als Zielsprache erkannter Text wird übersprungen; Anbietertests senden eine echte Anfrage.

</details>

### Lokale Übersetzungsmodelle: bei Bedarf laden und freigeben

| Deine Aktion | Plugin-Verhalten |
|---|---|
| Übersetzen oder testen | Dienst starten und gewähltes Modell bei Bedarf laden |
| Modellspeicher freigeben | Laufende Übersetzungen abwarten, dann entladen; Dateien, Schalter und Reihenfolge bleiben |
| Lokalen Anbieter abwählen | Deaktivieren und gewähltes Modell entladen |
| Erneut aktivieren oder Einstellungen öffnen | Kein Vorladen; Laden bei der nächsten tatsächlichen Übersetzung |
| Freigabe nach Leerlauf festlegen | Standard: 5 Minuten; 1 / 5 / 10 / 30 / 60 Minuten oder aus |

Die Zeit gilt ab der nächsten Nutzung. Ollama überwacht das gewählte Modell; globale Umgebungsvariablen bleiben unverändert. Fehlende Software oder Modelle werden erst nach Klick auf Vorbereiten installiert oder heruntergeladen, mit Fortschrittsanzeige.

<a id="languages"></a>
### Deine Sprache bleibt dabei

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

Neun Ziel-, Einstellungs- und Aufgabensprachen einschließlich Portugiesisch. Die Auswahl bleibt nach dem Neuladen erhalten.

<a id="faq"></a>
## Häufige Fragen

<details>
<summary><b>Nach Installation oder Update fehlt der Übersetzungseintrag</b></summary>

Starte `dsh web` vollständig neu. Der Modulgraph entsteht beim Prozessstart; Neuladen der Seite reicht eventuell nicht. Unten in den Einstellungen steht die installierte Paketversion.

</details>

<details>
<summary><b>Die Liste lokaler Modelle ist leer</b></summary>

Prüfe `ollama list` oder `/api/tags`, das aktive Modellverzeichnis und `OLLAMA_MODELS` des Dienstes. Vorhandene Dateien müssen nicht erneut geladen werden.

</details>

<details>
<summary><b>Client bundles not found nach einem DSH-Update</b></summary>

Führe `pnpm run build` im DeepSeek-Harness-Repository aus und starte DSH Web neu.

</details>

<details>
<summary><b>Beeinflusst ein Übersetzungsfehler das Gespräch?</b></summary>

Scheitern alle aktiven Anbieter, bleibt das Original. Teste einzelne Anbieter und prüfe den letzten Fehler. Nach der Wartezeit können neue Übersetzungsanfragen erneut versuchen.

</details>

<details>
<summary><b>Änderungen und Kompatibilität</b></summary>

**1.2.16** ergänzt Portugiesisch als Ziel- und Oberflächensprache, erneuert alle neun READMEs und Vergleichsbilder und erklärt drei Marktplatzbilder.

**1.2.15** ergänzt lokale Speicherverwaltung und passt Bilder, gruppiertes Einklappen und Originalauswahl an DSH `0.2.2-alpha.2` an.

**1.2.13** übersetzt Ablehnungsgründe der automatischen Prüfung. Danke an [llg1634](https://github.com/llg1634) für Bericht, ersten Patch und Tests.

Weitere Versionen: [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases).

</details>

<details>
<summary><b>Entwicklung und Funktionsweise</b></summary>

- `lib/index.js`: Host-Routen, Anbieter, Konfiguration, Cache und lokale Modelle.
- `lib/client.js`: Einstellungen, Anzeigeübersetzung, Streaming-Batches und Browser-Cache.
- `lib/config.json`: Laufzeitkonfiguration, von Git und npm ausgeschlossen.
- Kein zusätzlicher Build: Die Quellen sind das Ergebnis. Nach Host-Änderungen DSH neu starten.
- Prüfen mit `npm test`. Erkennung und Zugangsdaten: [Wartungsnotizen](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md).

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">Problem melden</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">Versionen</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">MIT-Lizenz</a>
</p>
