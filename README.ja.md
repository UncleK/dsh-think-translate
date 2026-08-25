# 🐋 dsh-think-translate

**言語：** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

---

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI の**表示層翻訳**プラグイン：**思考チェーン（Think 行）、タスクカード、回答本文**を選択した対象言語で表示します。原文は会話履歴に完全に残ります。

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

## ✨ 特徴

- **8 つの対象言語** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **単一言語 UI** — 設定パネル・思考行・タスクカードがすべて対象言語に追従（中英混在なし）、選択は永続化
- **ローカルモデル優先** — ローカル Ollama モデル（qwen など）を優先：プライベート・オフライン・無料。初回選択時に**自動ダウンロード**（リアルタイム進捗バー）、完了後自動で設定・有効化
- **Google / Bing フォールバック** — ローカルモデルが使えないとき自動切替（google は Node CONNECT トンネルでシステムプロキシ経由、アンチボット回避）
- **コード類は自動スキップ** — ファイルパス・コマンド・URL・正規表現・純コード行は翻訳しない
- **文単位バッチ翻訳** — 長い思考チェーンを短文バッチで逐次翻訳し、ローカル小モデルでも品質を維持
- **ストリーミング出力** — 思考中に訳文がバッチ単位で表示され、Think 行を開いて原文と比較可能
- **耐障害性** — host リクエストはバックオフ付き 3 回リトライ、ブラウザ直接フォールバック、失敗結果はキャッシュしない

## 📦 インストール

```bash
# 方法1：npm（推奨）
dsh plugin --profile web add dsh-think-translate
# その後 web を再起動

# 方法2：GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# 方法3：手動（junction + patch）
#  1. パッケージを profile の node_modules にリンク
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<リポジトリパス>"
#  2. "$HOME\.dsh\profiles\web\cordis.patch.yml" に追加：
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. web を再起動
```

## 🚀 使い方

1. **設定 → 思考チェーン翻訳** を開く
2. **対象言語**を選択（例：日本語）— 設定パネル・思考行・タスクカードがすべてその言語に切替
3. **優先プロバイダー**を選択：
   - **ローカルモデル（Ollama）**：初回選択時にダウンロードボタンが表示（qwen2.5:7b / 14b またはカスタム）、完了後自動有効化。モデル選択の横の「＋」でいつでも追加ダウンロード
   - **google gtx / bing**：そのまま使える（システムプロキシ / VPN を自動利用）
4. メッセージを送信し、Think 行を展開して訳文を確認

## ⚙️ 仕組み

```
ブラウザ → POST /_xlate/translate（同一オリジン、CORS なし）
  → host プロバイダーチェーン（fail-open）：
      openai 互換（ローカル Ollama、Node fetch でループバック直結）
      → google gtx（Node https + CONNECT トンネルでシステムプロキシ経由）
      → bing（curl form）
  → 失敗時はブラウザ直接へフォールバック
```

- **host 側**（`lib/index.js`）：プロバイダーアダプタ、LRU キャッシュ（600）、`/_xlate/models` モデル一覧、`/_xlate/model/pull` + `pull-status` モデルダウンロード管理（完了時自動設定）
- **client 側**（`lib/client.js`）：8 言語 UI、文単位バッチ翻訳、ストリーミング Think 行、localStorage 永続化
- 純表示層：原文は会話履歴とモデルコンテキストに完全保持

## 🛠 開発

- ビルド不要：`lib/client.js` はブラウザバンドル（ソース＝成果物）、`lib/index.js` は host ESM
- client 変更はページ更新で反映、host 変更は web 再起動が必要
- 8 言語の文言は `lib/client.js` の `UI_TEXT` ディクショナリにあり

## 📄 License

MIT
