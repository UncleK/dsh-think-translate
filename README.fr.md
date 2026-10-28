<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/hero.fr.png?v=1.2.16" alt="dsh-think-translate — La pensée de l’IA, dans votre langue" width="100%" />
</p>

<p align="center">
  <b>Traduction de la couche d’affichage de DeepSeek Harness.</b><br />
  Lisez le raisonnement, suivez les tâches et comprenez les réponses. Les originaux sont conservés ; les traductions restent hors du contexte du modèle.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-mit.fr.svg?v=1.2.16" alt="Licence MIT" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-local.fr.svg?v=1.2.16" alt="Ollama local" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-original.fr.svg?v=1.2.16" alt="Originaux conservés" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> · <a href="README.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <b>Français</b> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-quick-start.fr.svg?v=1.2.16" alt="Installation" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-demo.fr.svg?v=1.2.16" alt="Démonstrations" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-features.fr.svg?v=1.2.16" alt="Fonctions" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-comparison.fr.svg?v=1.2.16" alt="Comparaison" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-faq.fr.svg?v=1.2.16" alt="Questions" height="24" /></a>
</p>

---

<a id="demo"></a>
## Voir la pensée se déployer

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo.gif?v=1.2.16" alt="Démo 1 · Raisonnement et réponses" width="100%" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo2.gif?v=1.2.16" alt="Démo 2 · Autres opérations" width="100%" />
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>Démo 1 · Raisonnement et réponses</sub></td>
<td align="center" valign="top"><sub>Démo 2 · Autres opérations</sub></td>
</tr>
</table>

<a id="comparison"></a>
## Comparaison avec le plugin officiel de traduction

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/translation-comparison.fr.png?v=1.2.16" alt="Comparaison avec le plugin officiel de traduction" width="100%" />
</p>

Activez ce plugin ou le traducteur officiel du raisonnement. Tous deux prennent en charge l’affichage du raisonnement.

<a id="quick-start"></a>
## Une commande pour commencer

```bash
dsh plugin --profile web add dsh-think-translate
```

Après l’installation, redémarrez complètement DSH Web. Ouvrez **Paramètres → Traduction de la réflexion**, puis choisissez la langue et les fournisseurs.

<details>
<summary><b>Installation GitHub, mises à jour et autres méthodes</b></summary>

Installer depuis GitHub :

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

Mettre à jour depuis npm :

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

Redémarrez complètement DSH après chaque installation ou mise à jour. En manuel, liez le paquet au profil et ajoutez son entrée dans `cordis.patch.yml`. Les commandes ci-dessus conviennent à l’usage courant.

</details>

<a id="features"></a>
## Il n’y a pas que le raisonnement à comprendre

<table>
<tr>
<td width="50%" valign="top">
<h3>Lire le raisonnement en direct</h3>
<p>Tout prétraduire, charger l’historique à la demande ou traduire uniquement au dépliage</p>
</td>
<td width="50%" valign="top">
<h3>Tâches et réponses ensemble</h3>
<p>Raisonnement, cartes et liste de tâches de la zone de saisie ; réponses et motifs de refus de révision automatique en option</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Comprendre les décisions de révision</h3>
<p>Lorsqu’une révision automatique refuse un appel d’outil, le motif est traduit à côté de l’original. Les boutons de décision existants restent disponibles.</p>
</td>
<td width="50%" valign="top">
<h3>Préserver originaux et code</h3>
<p>Originaux conservés ; les traductions restent hors du contexte du modèle. Réutilise le rendu Markdown ; protège code, chemins et commandes avant traduction.</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>Modèles locaux à la demande</h3>
<p>Libération manuelle, au décochage ou après inactivité ; rechargement à la prochaine traduction</p>
</td>
<td width="50%" valign="top">
<h3>Vos fournisseurs, dans votre ordre</h3>
<p>Repli automatique selon l’ordre actif ; langue clairement incorrecte : fournisseur suivant ; nouvelle tentative après délai</p>
</td>
</tr>
</table>

### Connectez les fournisseurs que vous utilisez déjà

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

Détectez les fournisseurs configurés dans DSH sans ressaisir endpoints et clés. Testez chaque ligne séparément ; l’ordre de la liste détermine les tentatives.

```text
Premier choix → fournisseur actif suivant → … → original si tous échouent
```

<details>
<summary><b>Endpoints personnalisés, identifiants et reprise</b></summary>

- Prend en charge `/v1/chat/completions` compatible OpenAI et l’API native Anthropic Messages.
- Détecte les fournisseurs du profil DSH courant et des surcharges ; relancez l’analyse et ajoutez-les à la chaîne.
- `apiKeyEnv` est résolu lors de la requête ; les identifiants résolus ne sont pas réécrits dans la configuration.
- Les échecs attendent 30 secondes en mémoire du host avant les nouvelles tentatives. Une langue clairement incorrecte déclenche le fournisseur suivant.
- Le texte reconnu dans la langue cible est ignoré ; les tests de fournisseur effectuent toujours une vraie requête.

</details>

### Modèles locaux de traduction : chargement et libération à la demande

| Votre action | Comportement |
|---|---|
| Traduire ou tester | Démarre le service et charge le modèle sélectionné à la demande |
| Libérer la mémoire du modèle | Attend les traductions en cours, puis libère ; conserve fichiers, interrupteurs et ordre |
| Décocher le fournisseur local | Le désactive et libère le modèle sélectionné |
| Le réactiver ou ouvrir les paramètres | Aucun préchargement ; chargement à la prochaine traduction réelle |
| Définir le délai d’inactivité | 5 minutes par défaut ; 1 / 5 / 10 / 30 / 60 minutes ou désactivé |

Le délai s’applique dès l’utilisation suivante. Ollama suit le modèle sélectionné sans modifier les variables globales. Les logiciels ou modèles manquants sont installés ou téléchargés uniquement après un clic sur préparer, avec suivi de progression.

<a id="languages"></a>
### Votre langue vous accompagne

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

Neuf langues cibles, de paramètres et de tâches, dont le portugais. Le choix reste enregistré après actualisation.

<a id="faq"></a>
## Réponses aux questions fréquentes

<details>
<summary><b>L’entrée de traduction n’apparaît pas après installation ou mise à jour</b></summary>

Redémarrez complètement `dsh web`. Le graphe des modules est assemblé au démarrage ; une simple actualisation peut ne pas suffire. Le pied des paramètres affiche la version installée.

</details>

<details>
<summary><b>La liste des modèles locaux est vide</b></summary>

Vérifiez `ollama list` ou `/api/tags`, le répertoire actif et `OLLAMA_MODELS` du service. Les fichiers existants n’ont pas à être téléchargés à nouveau.

</details>

<details>
<summary><b>Client bundles not found après une mise à jour DSH</b></summary>

Lancez `pnpm run build` dans le dépôt DeepSeek Harness, puis redémarrez DSH Web.

</details>

<details>
<summary><b>Un échec de traduction affecte-t-il la conversation ?</b></summary>

Si tous les fournisseurs actifs échouent, l’original reste visible. Testez chaque fournisseur et consultez la dernière erreur. Les requêtes suivantes peuvent réessayer après le délai.

</details>

<details>
<summary><b>Mises à jour et compatibilité</b></summary>

**1.2.16** ajoute le portugais comme cible et langue d’interface, renouvelle les neuf README et images localisées, et déclare trois images pour le marché.

**1.2.15** ajoute la gestion mémoire locale et adapte images, repli du raisonnement et sélection de l’original à DSH `0.2.2-alpha.2`.

**1.2.13** traduit les motifs de refus de révision automatique. Merci à [llg1634](https://github.com/llg1634) pour le signalement, le correctif initial et les tests.

Anciennes versions : [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases).

</details>

<details>
<summary><b>Développement et fonctionnement</b></summary>

- `lib/index.js` : routes du host, fournisseurs, configuration, cache et modèles locaux.
- `lib/client.js` : paramètres, traduction d’affichage, lots en streaming et cache du navigateur.
- `lib/config.json` : configuration d’exécution, exclue de Git et npm.
- Aucune compilation supplémentaire : les sources sont le livrable. Redémarrez DSH après une modification du host.
- Vérification : `npm test`. Détection et identifiants : [notes de maintenance](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md).

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">Signaler un problème</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">Versions</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">Licence MIT</a>
</p>
