# 🐋 dsh-think-translate

**Langues :** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

Traduction au niveau de l'affichage pour l'interface web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) : la **chaîne de réflexion (ligne Think), les cartes de tâches et le texte de réponse** s'affichent dans la langue cible choisie, tandis que les originaux restent intacts dans la transcription et que le texte traduit **n'entre jamais dans le contexte du modèle**.

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ Fonctionnalités

Les modèles de la famille DeepSeek raisonnent souvent en chinois — ou dans la langue qu'ils utilisent pour penser. dsh-think-translate affiche la ligne Think, les cartes de tâches et la réponse dans *votre* langue en direct, comme des sous-titres pour la réflexion du modèle.

- **8 langues cibles** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **Interface monolingue** — panneau de réglages, lignes de réflexion et cartes de tâches suivent la langue cible (pas de mélange zh/en) ; le choix persiste
- **Modèle local d'abord** — utilise votre modèle Ollama local (qwen, etc.) : privé, hors ligne, gratuit. La première sélection **déclenche le téléchargement automatique** avec barre de progression ; le modèle est configuré et activé à la fin
- **🧠 Coût de contexte nul** — couche d'affichage pure : le modèle voit toujours le texte original et le texte traduit ne consomme jamais la fenêtre de contexte
- **Repli Google / Bing** — bascule automatique si le modèle local est indisponible (google passe par un tunnel CONNECT Node avec le proxy système)
- **Artefacts de code ignorés** — chemins, commandes, URL, regex et lignes de code pur ne sont jamais traduits
- **Traduction par lots de phrases** — les chaînes longues sont traduites en petits lots pour garder la qualité sur les petits modèles locaux
- **🧩 Découpage par paragraphes et phrases** — les longues chaînes sont découpées sur les lignes vides (structure de paragraphes préservée) puis par phrases, pour garder la qualité sur un petit modèle local
- **Sortie en streaming** — les traductions apparaissent lot par lot pendant la réflexion ; dépliez la ligne Think pour comparer avec l'original
- **Résilient** — nouvelles tentatives avec backoff (3×), repli direct navigateur, échecs jamais mis en cache
- **🎚️ Moment de traduction réglable** — tout pré-traduire / chargement différé des anciennes chaînes (défaut) / uniquement à l'ouverture

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

## 🚀 Utilisation

1. Ouvrez **Réglages → Traduction de chaîne de réflexion**
2. Choisissez la **langue cible** (p. ex. Français) — le panneau, les lignes et les cartes basculent dans cette langue
3. Choisissez le **fournisseur préféré** :
   - **Modèle local (Ollama)** — au premier choix, un bouton de téléchargement apparaît (qwen2.5:7b / 14b ou personnalisé) ; il s'active automatiquement à la fin. Le bouton "+" à côté du sélecteur télécharge d'autres modèles
   - **google gtx / bing** — fonctionne directement (proxy système / VPN automatiques)
4. Envoyez un message et dépliez la ligne Think pour voir la traduction

## 🎬 Démo

![dsh-think-translate demo](demo/demo.gif)

![dsh-think-translate demo 2](demo/demo2.gif)

## ⚙️ Fonctionnement

```
navigateur → POST /_xlate/translate (même origine, sans CORS)
  → chaîne de fournisseurs host (fail-open) :
      compatible OpenAI (Ollama local, Node fetch vers loopback)
      → google gtx (Node https + tunnel CONNECT via le proxy système)
      → bing (curl form)
  → repli direct navigateur
```

- **Moitié host** (`lib/index.js`) : adaptateurs de fournisseurs, cache LRU (600), `/_xlate/models`, `/_xlate/model/pull` + `pull-status` (configuration automatique à la fin)
- **Moitié client** (`lib/client.js`) : UI en 8 langues, traduction par lots, lignes Think en streaming, persistance localStorage
- Couche d'affichage pure : les originaux restent dans la transcription et le contexte du modèle

## 🛠 Développement

- Pas d'étape de compilation : `lib/client.js` est le bundle navigateur (source = artefact) ; `lib/index.js` est l'ESM host
- Les changements client s'appliquent au rafraîchissement ; les changements host nécessitent un redémarrage de web
- Les chaînes en 8 langues vivent dans le dictionnaire `UI_TEXT` de `lib/client.js`

## 📄 Licence

MIT
