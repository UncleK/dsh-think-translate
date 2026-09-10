<div align="center">

# 🐋 dsh-think-translate

**Langues :** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="demo/demo2.gif?v=2" width="41%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

Traduction au niveau de l'affichage pour l'interface web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) : la **chaîne de réflexion (ligne Think), les cartes de tâches et le texte de réponse** s'affichent dans la langue cible choisie, tandis que les originaux restent intacts dans la transcription et que le texte traduit **n'entre jamais dans le contexte du modèle**.

## ✨ Fonctionnalités

Les modèles de la famille DeepSeek raisonnent souvent en chinois — ou dans la langue qu'ils utilisent pour penser. dsh-think-translate affiche la ligne Think, les cartes de tâches et la réponse dans *votre* langue en direct, comme des sous-titres pour la réflexion du modèle.

- **🕵️ Lisez n'importe quelle chaîne de raisonnement** — raisonnement, chaîne de pensée, cartes de tâches et réponses traduits en temps réel, par lots
- **8 langues cibles** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Interface monolingue** — panneau de réglages, lignes de réflexion et cartes de tâches suivent la langue cible (pas de mélange zh/en) ; le choix persiste
- **Modèle local d'abord** — utilise votre modèle Ollama local (qwen, etc.) : privé, hors ligne, gratuit. La première sélection **déclenche le téléchargement automatique** avec barre de progression ; le modèle est configuré et activé à la fin
- **🧠 Coût de contexte nul** — couche d'affichage pure : le modèle voit toujours le texte original et le texte traduit ne consomme jamais la fenêtre de contexte
- **Repli Google / Bing** — bascule automatique si le modèle local est indisponible (google passe par un tunnel CONNECT Node avec le proxy système)
- **Artefacts de code ignorés** — chemins, commandes, URL, regex et lignes de code pur ne sont jamais traduits
- **Traduction par lots de phrases** — les chaînes longues sont traduites en petits lots pour garder la qualité sur les petits modèles locaux
- **🧩 Découpage par paragraphes et phrases** — les longues chaînes sont découpées sur les lignes vides (structure de paragraphes préservée) puis par phrases, pour garder la qualité sur un petit modèle local
- **Sortie en streaming** — les traductions apparaissent lot par lot pendant la réflexion ; dépliez la ligne Think pour comparer avec l'original
- **🎚️ Moment de traduction réglable** — tout pré-traduire / chargement différé des anciennes chaînes (défaut) / uniquement à l'ouverture
- **🔗 Chaîne de fournisseurs dynamique** — l'ordre de la liste est l'ordre d'exécution : glissez pour réordonner, activez ou désactivez chaque ligne. Intégrés google gtx / bing / Ollama local, plus tout endpoint personnalisé
- **🔌 Fournisseurs personnalisés (OpenAI et Anthropic)** — ajoutez depuis le panneau tout endpoint compatible OpenAI (`/v1/chat/completions`) ou l'**Anthropic Messages API** (Claude) : type, préréglage, URL de base, clé API et modèle
- **🪄 Hérite des fournisseurs configurés dans DSH** — détecte les lignes DSH en lecture seule depuis `settings.yaml` (`llm-pi-ai.providers`), et un bouton relance l'analyse et les ajoute toutes à la chaîne ; la clé est résolue à chaque requête depuis `.credentials.yaml` et n'est jamais écrite dans la config du plugin
- **⏱️ Résilient** — 3 tentatives avec backoff + secours direct du navigateur, bouton de test par ligne, les échecs ne sont jamais mis en cache

## 📦 Installation

```bash
# Option 1 : npm (recommandé)
dsh plugin --profile web add dsh-think-translate
# puis redémarrez web

# Option 2 : GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# Option 3 : manuel (junction + patch)
#  1. liez le paquet dans le node_modules du profil
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<chemin du dépôt>"
#  2. ajoutez à "$HOME\.dsh\profiles\web\cordis.patch.yml" :
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. redémarrez web
```

## 🧯 Après une mise à jour de DSH

Les plugins clients tiers sont chargés via le graphe de modules client de DSH, et ce graphe n'est composé **qu'une seule fois par processus** : une composition en échec reste en mémoire jusqu'au redémarrage. D'où ces trois écueils juste après une mise à jour.

- **Le démarrage depuis un checkout source échoue** avec `client bundles not found; run \`pnpm run build\` before launch` —— les nouveaux paquets clients ne sont pas compilés : lancez `pnpm run build` dans le checkout du harness, puis redémarrez `dsh web`.
- **L'interface du plugin a disparu** (pas de ligne Think traduite, pas de section *Traduction de chaîne de réflexion* dans les Réglages) —— **redémarrez `dsh web`** ; un simple rafraîchissement de la page ne suffit pas toujours.
- **La liste des modèles locaux est vide** —— le service `ollama` ne sert pas ce répertoire de modèles : vérifiez `ollama list` (ou `GET /api/tags`) et l'`OLLAMA_MODELS` réellement utilisé par le service en cours. Si les modèles sont sur un autre disque, une jonction de répertoire peut pointer le répertoire par défaut du service vers eux.

Rien à configurer côté plugin : il ne déclare aucune dépendance d'ordre vis-à-vis des paquets internes de DSH (il ne se lie qu'au service `slots`, et éventuellement à `@deepseek-ai/dsh-client-ui-primitives`), et fonctionne donc aussi bien sur un DSH ancien (≤ 0.1.1-rc) que sur la ligne actuelle (≥ 0.1.2-alpha.1, 0.1.5-rc.1 incluse).

## 🚀 Utilisation

1. Ouvrez **Réglages → Traduction de chaîne de réflexion**
2. Choisissez la **langue cible** (p. ex. Français) — le panneau, les lignes et les cartes basculent dans cette langue
3. Gérez la **chaîne de fournisseurs** (glisser pour ordonner, cocher pour activer) :
   - Intégrés : **google gtx / bing** (gratuits, prêts à l'emploi, proxy système) et **modèle local (Ollama)** (au premier choix, téléchargement de 7b/14b ou d'un modèle personnalisé)
   - **Fournisseurs DSH** : les endpoints déjà configurés dans `settings.yaml` apparaissent seuls (lecture seule ; cochez pour les ajouter à la chaîne). Le bouton **Importer depuis la config DSH**, juste sous la liste, relance l'analyse et les ajoute tous d'un coup : ni baseURL ni clé à ressaisir, la clé étant résolue depuis les identifiants de DSH
   - La clé se saisit à la main ou arrive via **`apiKeyEnv`** depuis un préréglage ou une ligne DSH : cette ligne affiche le badge `env:NAME`, et la clé est résolue à chaque requête sans jamais être écrite dans `config.json`. Le formulaire d'édition n'a pas de champ de variable d'environnement (la valeur est conservée telle quelle), mais vider un champ le supprime réellement (envoyé comme suppression explicite)
   - Décocher un fournisseur l'ignore. Détails dans [README.md](README.md)
4. Envoyez un message et dépliez la ligne Think pour voir la traduction

## ⚙️ Fonctionnement

```
navigateur → POST /_xlate/translate (même origine, sans CORS)
  → chaîne de fournisseurs côté host (fail-open, réordonnable) :
      chain: [provider1, provider2, ...]   ← ordre par glisser dans les Réglages
        google / bing / compatible OpenAI / Anthropic
      chaîne fallback (facultative, désactivée par défaut, activable dans la config)
  → repli direct depuis le navigateur
```

- La **configuration des fournisseurs** vit dans `config.json` (généré à l'exécution, ignoré par git) : `chain` (ids ordonnés), `fallback` (enabled + chain, fichier uniquement), `providers` (par fournisseur `type`/`enabled`/`baseURL`/`apiKey`/`apiKeyEnv`/`model`). Les anciennes configurations `priority` sont migrées automatiquement ; un fournisseur qui déclare `apiKeyEnv` résout sa clé depuis cette variable à chaque requête (le `apiKey` littéral reste en secours) et aucune clé résolue n'est réécrite dans `config.json` ; un `null` dans un patch supprime ce champ, c'est ainsi que l'interface en vide un
- La **découverte DSH** lit `settings.yaml` (`llm-pi-ai.providers`) et `.credentials.yaml` (`refs`) du harness au chargement ; les fournisseurs détectés portent `source: "dsh"`, les clés résolues restent en mémoire (jamais dans `config.json`), et la route `/_xlate/dsh-scan` les relit à la demande
- **Moitié host** (`lib/index.js`) : adaptateurs de fournisseurs, cache LRU (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (configuration automatique à la fin)
- **Moitié client** (`lib/client.js`) : UI en 8 langues, traduction par lots, lignes Think en streaming, persistance localStorage
- Couche d'affichage pure : les originaux restent dans la transcription et le contexte du modèle

## 🛠 Développement

- Pas d'étape de compilation : `lib/client.js` est le bundle navigateur (source = artefact) ; `lib/index.js` est l'ESM host
- Les changements client s'appliquent au rafraîchissement ; les changements host nécessitent un redémarrage de web
- Les chaînes en 8 langues vivent dans le dictionnaire `UI_TEXT` de `lib/client.js`

## 📄 Licence

MIT
