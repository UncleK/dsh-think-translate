# dsh-think-translate

**思考链翻译** — 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 提供显示层翻译：把界面上的**思考链（Think 行）、任务卡片、回答正文**翻译为你选择的目标语言，原文完整保留在会话记录中。

## 特性

- **8 种目标语言**：中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Русский
- **单一语言 UI**：设置面板、思考行、任务卡片全部跟随目标语言（不混中英），语言选择持久化
- **本地模型为主力**：优先使用本地 Ollama 模型（qwen 等），隐私离线免费；**首次选择本地模型时自动触发下载**，带实时进度条，完成后自动配置启用
- **Google / Bing 兜底**：本地模型不可用时自动切换（google 通过 Node CONNECT 隧道走系统代理，绕过反爬）
- **代码工件自动跳过**：文件路径、命令、URL、正则、纯代码行不翻译
- **句子分批翻译**：长思考链按句子分批串行翻译，本地小模型也能保持质量
- **流式输出**：思考过程中译文逐批出现，展开 Think 行可对照原文
- **失败韧性**：host 请求 3 次退避重试 + 浏览器直连兜底，失败结果不缓存

## 安装

```bash
# 方式一：从 GitHub 安装（推荐）
dsh plugin --profile web add https://github.com/<your-name>/dsh-think-translate
# 然后重启 web

# 方式二：手动（junction + patch）
# 1. 链接包到 profile 的 node_modules
New-Item -ItemType Junction -Path "$HOME\.dsh\profiles\node_modules\dsh-think-translate" `
  -Target "<此仓库路径>"
# 2. 在 "$HOME\.dsh\profiles\web\cordis.patch.yml" 加入：
# - insert:
#     - id: dsh-think-translate
#       name: dsh-think-translate
# 3. 重启 web
```

## 使用

1. 打开 **设置 → 思考链翻译**
2. 选择**目标语言**（比如日本語）——设置面板/思考链/任务卡片全部切换为该语言
3. 选择**首选提供方**：
   - **本地部署模型（Ollama）**：首次选择时显示下载按钮（qwen2.5:7b / 14b 或自定义），下载完成后自动启用；模型下拉旁 "+" 可随时下载更多
   - **google gtx / bing**：开箱即用（自动走系统代理/VPN）
4. 发消息让模型思考，展开 Think 行查看译文

## 工作原理

```
浏览器 → POST /_xlate/translate（同源，无 CORS）
  → host 供应商链（fail-open）：
      openai 兼容（本地 Ollama，Node fetch 直连回环）
      → google gtx（Node https + CONNECT 隧道走系统代理）
      → bing（curl form）
  → 失败回退浏览器直连
```

- **host 半边**（`lib/index.js`）：供应商适配器、API Key、缓存（LRU 600）、`/_xlate/models` 模型列表、`/_xlate/model/pull` + `pull-status` 模型下载管理（完成后自动配置启用）
- **client 半边**（`lib/client.js`）：8 语言 UI、句子分批翻译、流式 Think 行、localStorage 持久化
- 纯显示层：原文完整保留在会话日志与模型上下文中

## 开发

- 无需构建：`lib/client.js` 是浏览器 bundle（源码即产物），`lib/index.js` 是 host ESM
- 修改 client 后刷新页面即生效；修改 host 后需重启 web
- 更新 8 语言文案：编辑 `lib/client.js` 中的 `UI_TEXT` 字典

## License

MIT
