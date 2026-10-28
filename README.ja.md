<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/hero.ja.png?v=1.2.16" alt="dsh-think-translate — AI の思考を、あなたの言語で" width="100%" />
</p>

<p align="center">
  <b>DeepSeek Harness の表示レイヤー翻訳。</b><br />
  思考を読み、タスクを追い、回答を理解。原文は保持され、訳文はモデルのコンテキストに入りません。
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-mit.ja.svg?v=1.2.16" alt="MIT License" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-local.ja.svg?v=1.2.16" alt="ローカル Ollama" />
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/badge-original.ja.svg?v=1.2.16" alt="原文を保持" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> · <a href="README.md">English</a> · <b>日本語</b> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-quick-start.ja.svg?v=1.2.16" alt="簡単インストール" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-demo.ja.svg?v=1.2.16" alt="動作デモ" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-features.ja.svg?v=1.2.16" alt="主な機能" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-comparison.ja.svg?v=1.2.16" alt="公式との比較" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/nav-faq.ja.svg?v=1.2.16" alt="よくある質問" height="24" /></a>
</p>

---

<a id="demo"></a>
## 思考が生まれる瞬間を見る

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo.gif?v=1.2.16" alt="デモ1 · 思考と回答の翻訳" width="100%" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/demo/demo2.gif?v=1.2.16" alt="デモ2 · その他の操作" width="100%" />
</td>
</tr>
<tr>
<td align="center" valign="top"><sub>デモ1 · 思考と回答の翻訳</sub></td>
<td align="center" valign="top"><sub>デモ2 · その他の操作</sub></td>
</tr>
</table>

<a id="comparison"></a>
## 公式翻訳プラグインとの比較

<p align="center">
  <img src="https://raw.githubusercontent.com/UncleK/dsh-think-translate/main/docs/assets/translation-comparison.ja.png?v=1.2.16" alt="公式翻訳プラグインとの比較" width="100%" />
</p>

本プラグインか公式思考翻訳のどちらか一方を有効にしてください。両者とも思考表示を担当します。

<a id="quick-start"></a>
## コマンド1つで使い始める

```bash
dsh plugin --profile web add dsh-think-translate
```

インストール後、DSH Web を完全に再起動します。**設定 → 思考チェーン翻訳**で翻訳先の言語と提供元を選択してください。

<details>
<summary><b>GitHub からの導入、更新、その他の方法</b></summary>

GitHub からインストール：

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

npm 版を更新：

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

導入・更新後は DSH を完全に再起動してください。手動配置ではパッケージを profile にリンクし、`cordis.patch.yml` に登録します。通常は上記コマンドをお勧めします。

</details>

<a id="features"></a>
## 読みたいのは思考だけではない

<table>
<tr>
<td width="50%" valign="top">
<h3>思考をリアルタイムに読む</h3>
<p>すべて事前翻訳、履歴を遅延ロード、展開時のみ翻訳</p>
</td>
<td width="50%" valign="top">
<h3>タスクと回答をまとめて確認</h3>
<p>思考、タスクカード、入力欄のタスク一覧。回答本文と自動レビューの拒否理由も任意で翻訳</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>レビューの理由を理解</h3>
<p>自動レビューがツール呼び出しを拒否した際、原文とともに理由の訳を表示します。既存の操作ボタンも利用できます。</p>
</td>
<td width="50%" valign="top">
<h3>原文とコードを保持</h3>
<p>原文を保持。訳文はモデルのコンテキストに入らない. Markdown コンポーネントを再利用。翻訳前にコード、パス、コマンドを保護.</p>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<h3>ローカルモデルは必要な時に</h3>
<p>手動解放、チェック解除時の解放、アイドル時の自動解放。次の翻訳時に再ロード</p>
</td>
<td width="50%" valign="top">
<h3>好みの順に提供元を利用</h3>
<p>有効な順に自動フォールバック。明らかに異なる言語なら次の提供元へ。クールダウン後に再試行</p>
</td>
</tr>
</table>

### 使い慣れた提供元に接続

**Ollama · Google · Bing · OpenAI · Anthropic Messages API**

DSH 設定済みの提供元を検出し、エンドポイントやキーの再入力を省けます。各行を個別にテストでき、一覧の順番で試行します。

```text
優先する提供元 → 次の有効な提供元 → … → すべて失敗したら原文を保持
```

<details>
<summary><b>独自エンドポイント、認証情報と復旧</b></summary>

- OpenAI 互換 `/v1/chat/completions` と Anthropic Messages API に対応します。
- 現在の DSH profile と上書き設定から提供元を検出し、再スキャンして翻訳チェーンに追加できます。
- `apiKeyEnv` はリクエスト時に解決し、解決したキーはプラグイン設定へ書き戻しません。
- 失敗は Host メモリで30秒間クールダウンし、その後の翻訳で再試行します。明らかに違う言語なら次の提供元を試します。
- すでに翻訳先言語と認識できる本文はスキップします。提供元テストでは実際にリクエストします。

</details>

### ローカル翻訳モデル：必要に応じてロードと解放

| 操作 | プラグインの動作 |
|---|---|
| 翻訳またはテスト | 必要な時にサービスを起動し、選択したモデルをロード |
| モデルメモリを解放 | 進行中の翻訳を待って解放。ファイル、スイッチ、順序は保持 |
| ローカル提供元のチェックを外す | 無効にして選択モデルを解放 |
| 再有効化、または設定を開く | 事前ロードせず、次の実際の翻訳時にロード |
| アイドル時の解放を設定 | 既定は5分。1 / 5 / 10 / 30 / 60分、または無効 |

時間設定は次の使用時から適用されます。Ollama が選択モデルを計時し、グローバル環境変数は変更しません。不足するソフトやモデルは準備ボタンを押してから導入・ダウンロードし、進捗を表示します。

<a id="languages"></a>
### 言語設定をいつも一緒に

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

翻訳先、設定画面、タスク表示はポルトガル語を含む9言語に対応。選択はページ更新後も保持されます。

<a id="faq"></a>
## よくある質問

<details>
<summary><b>導入・更新後に翻訳設定が見つからない</b></summary>

`dsh web` を完全に再起動してください。クライアントのモジュール構成は起動時に作られ、ページ更新だけでは反映されない場合があります。設定画面下部にインストール版を表示します。

</details>

<details>
<summary><b>ローカルモデル一覧が空</b></summary>

`ollama list` または `/api/tags` と、サービスのモデル保存先・`OLLAMA_MODELS` を確認してください。既存ファイルの再ダウンロードは不要です。

</details>

<details>
<summary><b>DSH 更新後に client bundles not found と表示される</b></summary>

DeepSeek Harness のリポジトリで `pnpm run build` を実行し、DSH Web を再起動してください。

</details>

<details>
<summary><b>翻訳失敗は会話に影響する？</b></summary>

すべての有効な提供元が失敗しても原文を保持します。設定で各提供元をテストし、直近のエラーを確認できます。クールダウン後の翻訳で再試行します。

</details>

<details>
<summary><b>最近の更新と互換性</b></summary>

**1.2.16**：翻訳先と UI にポルトガル語を追加。9言語の README と比較画像を更新し、市場向け画像を3枚に拡充。

**1.2.15**：ローカルモデルのメモリ管理を追加。DSH `0.2.2-alpha.2` の画像表示、思考のまとめ折りたたみ、原文選択に対応。

**1.2.13**：自動レビューの拒否理由翻訳を追加。[llg1634](https://github.com/llg1634) の報告、初期パッチとテストに感謝します。

以前の変更は [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases) をご覧ください。

</details>

<details>
<summary><b>開発と仕組み</b></summary>

- `lib/index.js`：Host ルート、提供元、設定、メモリキャッシュ、ローカルモデル管理。
- `lib/client.js`：設定、表示レイヤー翻訳、ストリーミング分割、ブラウザーキャッシュ。
- `lib/config.json`：実行時設定。Git と npm には含めません。
- 追加ビルド不要。ソースが成果物です。Host の変更後は DSH を再起動します。
- 確認：`npm test`。設定検出と認証情報は[メンテナンスノート](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md)に記載。

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">問題を報告</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">リリース</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">MIT License</a>
</p>
