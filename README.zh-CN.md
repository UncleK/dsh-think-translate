<div align="center">

# 🐋 dsh-think-translate

**语言：** [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/dsh-think-translate?color=4D6BFE&label=npm)](https://www.npmjs.com/package/dsh-think-translate)
[![license](https://img.shields.io/npm/l/dsh-think-translate?color=4D6BFE)](LICENSE)
[![dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

<img src="demo/demo.gif" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />
<img src="demo/demo2.gif" width="46%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />

</div>

---

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 提供**显示层翻译**：把界面上的**思考链（Think 行）、任务卡片、回答正文**翻译为你选择的目标语言，原文完整保留在会话记录中，译文**绝不进入模型上下文**。

## ✨ 特性

DeepSeek 系模型经常用中文思考——或者用它们碰巧习惯的语言。dsh-think-translate 在你观看时把 Think 行、任务卡片和回答渲染成*你的*语言，就像给模型的思考配上字幕。

- **8 种目标语言** — 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **单一语言界面** — 设置面板、思考行、任务卡片全部跟随目标语言（不混中英），选择持久化
- **本地模型为主力** — 优先使用本地 Ollama 模型（qwen 等），隐私离线免费；首次选择本地模型时**自动触发下载**（实时进度条），完成后自动配置启用
- **🧠 零上下文成本** — 纯显示层：模型看到的仍是原文，译文绝不占用上下文窗口
- **Google / Bing 兜底** — 本地模型不可用时自动切换（google 通过 Node CONNECT 隧道走系统代理，绕过反爬）
- **代码工件自动跳过** — 文件路径、命令、URL、正则、纯代码行不翻译
- **句子分批翻译** — 长思考链按句子分批串行翻译，本地小模型也能保持质量
- **🧩 段落与句子感知切分** — 长思考链按空行切分（保留段落结构）再按句分批，本地小模型也能保持质量
- **流式输出** — 思考过程中译文逐批出现，展开 Think 行可对照原文
- **失败韧性** — host 请求 3 次退避重试 + 浏览器直连兜底，失败结果不缓存
- **🎚️ 可调翻译时机** — 三档：全部预翻译 / 懒加载历史（默认）/ 仅展开时翻译

## 📦 安装

```bash
# 方式一：npm（推荐）
dsh plugin --profile web add dsh-think-translate
# 然后重启 web

# 方式二：GitHub
dsh plugin --profile web add github:UncleK/dsh-think-translate

# 方式三：手动（junction + patch）
#  1. 链接包到 profile 的 node_modules
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<仓库路径>"
#  2. 在 "$HOME\.dsh\profiles\web\cordis.patch.yml" 加入：
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
#  3. 重启 web
```

## 🧯 DSH 升级之后

第三方客户端插件走 DSH 的客户端模块图，而这张图**每个进程只在启动时组合一次**，一次失败的组合会被记在内存里直到重启。于是升级 DSH 后常撞到这三件事：

- **从源码启动失败**：`client bundles not found; run \`pnpm run build\` before launch` —— 新版客户端包需要先构建：在 harness 仓库根目录跑 `pnpm run build`，再重新启动 `dsh web`。
- **插件 UI 不见了**（Think 行没有译文、设置里没有“思考链翻译”）—— **重启一次 `dsh web`**；只刷新页面有时不够。
- **本地模型列表是空的** —— `ollama` 服务当前用的模型目录里没有模型：查 `ollama list`（或 `GET /api/tags`）以及该服务实际生效的 `OLLAMA_MODELS`；模型文件在别的盘时，可用目录联接把服务的默认目录指过去。

插件侧无需任何配置：它不依赖 DSH 内部包的加载顺序（只绑定 `slots` 服务，可选使用 `@deepseek-ai/dsh-client-ui-primitives`），因此老版本（≤ 0.1.1-rc）与当前版本线（≥ 0.1.2-alpha.1，含 0.1.5-rc.1）都能直接跑。

## 🚀 使用

1. 打开 **设置 → 思考链翻译**
2. 选择**目标语言**（比如日本語）——设置面板、思考行、任务卡片全部切换为该语言
3. 管理**供应商链**（拖动排序，勾选即启用）：
   - 内置：**google gtx / bing**（免费，开箱即用，自动走系统代理）与**本地模型（Ollama）**（首次选中提示下载 7b/14b 或自定义）
   - **DSH 供应商**：`settings.yaml` 里已配置的端点会自动出现（只读，勾选即加入链）
   - **自定义供应商**：任意 OpenAI 兼容或 Anthropic Messages 端点；密钥可直接填，也可只填**环境变量名**（不落盘），表单里带常见模型的预设
   - 取消勾选即跳过该供应商；更细的说明以 [README.md](README.md) 为准
4. 发消息让模型思考，展开 Think 行查看译文

## ⚙️ 工作原理

```
浏览器 → POST /_xlate/translate（同源，无 CORS）
  → host 供应商链（fail-open，可排序）：
      chain: [provider1, provider2, ...]   ← 设置里拖拽排序
        google / bing / openai 兼容 / anthropic 任选
      fallback 链（可选，默认关闭，配置里开启）
  → 浏览器直连兜底
```

- **host 半边**（`lib/index.js`）：供应商适配器、LRU 缓存（600）、`/_xlate/models` 模型列表、`/_xlate/model/pull` + `pull-status` 模型下载管理（完成后自动配置启用）
- **client 半边**（`lib/client.js`）：8 语言 UI、段落/句子分批翻译、流式 Think 行、设置与译文缓存持久化（localStorage）
- 纯显示层：原文完整保留在会话日志与模型上下文中

## 🛠 开发

- 无需构建：`lib/client.js` 是浏览器 bundle（源码即产物），`lib/index.js` 是 host ESM
- 修改 client 后刷新页面即生效；修改 host 后需重启 web
- 8 语言文案在 `lib/client.js` 的 `UI_TEXT` 字典中

## 📄 License

MIT
