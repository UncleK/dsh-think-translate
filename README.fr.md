<div align="center">

# 🐋 dsh-think-translate

**Langues :** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif?v=2" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="demo/demo2.gif?v=2" width="41%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

Traduction au niveau de l'affichage pour l'interface web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) : la **chaîne de réflexion (ligne Think), les cartes de tâches et le texte de réponse** s'affichent dans la langue cible choisie, tandis que les originaux restent intacts dans la transcription et que le texte traduit **n'entre jamais dans le contexte du modèle**.

## ✨ Fonctionnalités

Les modèles de la famille DeepSeek raisonnent souvent en chinois — ou dans la langue qu'ils utilisent pour penser. dsh-think-translate affiche la ligne Think, les cartes de tâches et la réponse dans *votre* langue en direct, comme des sous-titres pour la réflexion du modèle.

- **Motifs de refus Auto review** — conserve le texte original et ajoute sa traduction de façon asynchrone dans la carte d’approbation, avec un réglage indépendant.
- **🕵️ Lisez n'importe quelle chaîne de raisonnement** — raisonnement, chaîne de pensée, cartes de tâches et réponses traduits en temps réel, par lots
- **8 langues cibles** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Interface monolingue** — panneau de réglages, lignes de réflexion et cartes de tâches suivent la langue cible (pas de mélange zh/en) ; le choix persiste
- **Ollama local** — réutilise les installations et modèles existants. Si Ollama est activé en première position ou si vous cliquez sur Test, le service démarre et le modèle se charge au besoin. Les logiciels ou modèles manquants nécessitent le bouton de préparation avant installation/téléchargement, avec progression en direct
- **🧠 Coût de contexte nul** — couche d'affichage pure : le modèle voit toujours le texte original et le texte traduit ne consomme jamais la fenêtre de contexte
- **Repli Google / Bing** — bascule automatique si le modèle local est indisponible (google passe par un tunnel CONNECT Node avec le proxy système)
- **Artefacts de code ignorés** — chemins, commandes, URL, regex et lignes de code pur ne sont jamais traduits
- **Traduction par lots de phrases** — les chaînes longues sont traduites en petits lots pour garder la qualité sur les petits modèles locaux
- **🧩 Découpage par paragraphes et phrases** — les longues chaînes sont découpées sur les lignes vides (structure de paragraphes préservée) puis par phrases, pour garder la qualité sur un petit modèle local
- **Sortie en streaming** — les traductions apparaissent lot par lot pendant la réflexion ; dépliez la ligne Think pour comparer avec l'original
- **🎚️ Moment de traduction réglable** — tout pré-traduire / chargement différé des anciennes chaînes (défaut) / uniquement à l'ouverture
- **🔗 Chaîne de fournisseurs dynamique** — l'ordre de la liste est l'ordre d'exécution : glissez pour réordonner, activez ou désactivez chaque ligne. Intégrés google gtx / bing / Ollama local, plus tout endpoint personnalisé
- **🔌 Fournisseurs personnalisés (OpenAI et Anthropic)** — ajoutez depuis le panneau tout endpoint compatible OpenAI (`/v1/chat/completions`) ou l'**Anthropic Messages API** (Claude) : type, préréglage, URL de base, clé API et modèle
- **🪄 Hérite des fournisseurs configurés dans DSH** — détecte les lignes DSH en lecture seule depuis `profiles/<profile>/cordis.patch.yml` / ancien `settings.yaml` (`llm-pi-ai.providers`), et un bouton relance l'analyse et les ajoute toutes à la chaîne ; la clé est résolue à chaque requête depuis `.credentials.yaml` et n'est jamais écrite dans la config du plugin. La route par défaut du harness compte aussi : si `default-model` / `agent-default-model` désigne `deepseek-official`, l'API officielle DeepSeek apparaît comme une ligne DSH de plus
- **⏱️ Résilient** — les échecs sont conservés en mémoire pendant 30 secondes pour éviter les tentatives répétées, puis réessayés automatiquement ; chaque fournisseur dispose de son bouton de test

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

Pour DSH **0.2.0-rc.2**, utilisez **dsh-think-translate 1.2.5 ou une version ultérieure**. La version 1.2.5 corrige le conflit du slot `todo_write` et déclare la plage de versions peer 0.2. Exécutez `dsh plugin --profile web add dsh-think-translate@latest`, puis redémarrez DSH ; aucune exception de version requise.

**1.2.6** corrige les pensées et réponses affichées en double dans DSH 0.2 : le rendu et le texte original de secours respectent les groupes reasoning/response.

**1.2.7 préparation locale :** Ollama activé en première position, ou son test, détecte une installation existante, démarre le service et charge le modèle. Le bouton de préparation autorise les installations et téléchargements manquants, avec progression par étapes. Installation automatique du logiciel sur Windows ; guide officiel ailleurs. Le fournisseur utilisé respecte la priorité des fournisseurs activés et vérifiés.

**1.2.8 transport et reprise :** les traductions HTTP/HTTPS ordinaires utilisent le réseau natif de Node au lieu de lancer curl pour chaque lot de texte. Les proxys SOCKS et l’installateur Ollama conservent curl. Les échecs restent en mémoire pendant 30 secondes, puis les traductions du raisonnement et des réponses sont réessayées automatiquement. Les délais tiennent compte du chargement des modèles locaux et du recours à d’autres fournisseurs.

**1.2.14 :** les consignes précisent la langue cible et les limites du texte source. Une traduction manifestement dans une autre langue est rejetée au profit du fournisseur activé suivant. Elle ne reste pas dans le cache des réussites ; les anciens caches sont supprimés, les préférences, le code, les termes cités et les courts textes ambigus sont conservés. Redémarrez entièrement DSH Web ou Desktop après la mise à jour. [#14](https://github.com/UncleK/dsh-think-translate/issues/14).

**1.2.13 :** les cartes de refus Auto review conservent l’original et ajoutent une traduction asynchrone, avec un réglage indépendant activé par défaut. Les anciens résultats sont ignorés après désactivation, changement de langue ou retrait de la carte. Les motifs non anglais sont également traduits en anglais. Merci à [llg1634](https://github.com/llg1634) pour le signalement, le correctif initial et les tests dans [#13](https://github.com/UncleK/dsh-think-translate/issues/13). Redémarrez complètement DSH Web ou Desktop après la mise à jour.

**1.2.12 :** les choix de fournisseurs sont respectés ; le navigateur ne contacte plus Google directement après un échec du Host. Le code délimité, indenté ou en ligne est exclu des requêtes et conservé exactement, y compris pendant un flux incomplet. Les anciennes traductions en cache sont supprimées, les préférences conservées. Après la mise à jour, redémarrez entièrement DSH Web ou Desktop ; une simple actualisation peut encore référencer les anciennes ressources du client.

**1.2.11 corrections de Bing :** le fournisseur gratuit est conservé. Les requêtes de traduction utilisent l’origine finale de la page de session pour éviter que la redirection `www.bing.com` → `cn.bing.com` en Chine continentale supprime le corps POST. SOCKS/curl utilise les mêmes en-têtes de navigateur que le transport natif pour corriger HTTP 401 ; les réponses vides ou non JSON signalent des erreurs explicites.

**1.2.10 compatibilité des profils DSH :** la détection suit le profil Desktop/Web actif et lit `profiles/<profile>/cordis.patch.yml` (`id` + `config`), puis applique les correctifs du répertoire DSH et les surcharges de lancement. L’ancien `settings.yaml` reste pris en charge. Le modèle par défaut utilise `default-model` ; les identifiants restent dans `.credentials.yaml` du répertoire DSH et en mémoire uniquement. Le diagnostic indique le fichier lu.

**1.2.9 corrections linguistiques :** les indications de vocabulaire japonais ne concernent que le japonais ; OpenAI/Anthropic reçoivent le nom complet de la langue. Bing utilise `auto-detect` et `zh-Hans`/`zh-Hant`. La détection du chinois écarte chemins, code et JSON : elle ignore la prose déjà simplifiée, demande une conversion en présence de caractères traditionnels courants et traduit la prose japonaise/coréenne. Les anciennes traductions en cache sont supprimées une fois, sans toucher aux réglages.

## 🚀 Utilisation

1. Ouvrez **Réglages → Traduction de chaîne de réflexion**
2. Choisissez la **langue cible** (p. ex. Français) — le panneau, les lignes et les cartes basculent dans cette langue
3. Gérez la **chaîne de fournisseurs** (glisser pour ordonner, cocher pour activer) :
   - Intégrés : **google gtx / bing** (gratuits, via le proxy système) et **Ollama local** ; les logiciels et modèles existants sont réutilisés. Les composants manquants nécessitent le bouton de préparation, avec progression (7b/14b ou modèle personnalisé)
   - **Fournisseurs DSH** : les endpoints déjà configurés dans `profiles/<profile>/cordis.patch.yml` / ancien `settings.yaml` apparaissent seuls (lecture seule ; cochez pour les ajouter à la chaîne). Le bouton **Importer depuis la config DSH**, juste sous la liste, relance l'analyse et les ajoute tous d'un coup : ni baseURL ni clé à ressaisir, la clé étant résolue depuis les identifiants de DSH
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
  → texte original si tous les fournisseurs activés échouent
```

- La **configuration des fournisseurs** vit dans `config.json` (généré à l'exécution, ignoré par git) : `chain` (ids ordonnés), `fallback` (enabled + chain, fichier uniquement), `providers` (par fournisseur `type`/`enabled`/`baseURL`/`apiKey`/`apiKeyEnv`/`model`). Les anciennes configurations `priority` sont migrées automatiquement ; un fournisseur qui déclare `apiKeyEnv` résout sa clé depuis cette variable à chaque requête (le `apiKey` littéral reste en secours) et aucune clé résolue n'est réécrite dans `config.json` ; un `null` dans un patch supprime ce champ, c'est ainsi que l'interface en vide un
- La **découverte DSH** lit `profiles/<profile>/cordis.patch.yml` / ancien `settings.yaml` (`llm-pi-ai.providers`) et `.credentials.yaml` (`refs`) du harness au chargement ; les fournisseurs détectés portent `source: "dsh"`, les clés résolues restent en mémoire (jamais dans `config.json`), et la route `/_xlate/dsh-scan` les relit à la demande
- **Moitié host** (`lib/index.js`) : adaptateurs de fournisseurs, cache LRU (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (configuration automatique à la fin)
- **Moitié client** (`lib/client.js`) : UI en 8 langues, traduction par lots, lignes Think en streaming, persistance localStorage
- Couche d'affichage pure : les originaux restent dans la transcription et le contexte du modèle

## 🛠 Développement

- Pas d'étape de compilation : `lib/client.js` est le bundle navigateur (source = artefact) ; `lib/index.js` est l'ESM host
- Les changements client s'appliquent au rafraîchissement ; les changements host nécessitent un redémarrage de web
- Les chaînes en 8 langues vivent dans le dictionnaire `UI_TEXT` de `lib/client.js`

## 📄 Licence

MIT
