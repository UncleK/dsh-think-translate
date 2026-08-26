# 录制 demo GIF / 截图

## 目标

一个 **10–20 秒**的动画，展示核心价值：模型用英文思考 → Think 行实时流式出现目标语言译文 → 展开可对照原文。

## 工具

- Windows 推荐 **ScreenToGif**（免费，直接存 GIF）：https://www.screentogif.com
- 或 Xbox Game Bar（`Win+G`）录 MP4，再用工具转 GIF。

## 步骤

1. 打开 DSH Web（http://127.0.0.1:3088）。
2. **设置 → 思考链翻译**：目标语言选「日本語」（或中文），首选提供方选本地 Ollama（qwen2.5:14b）或 google。
3. 发一条会让模型**用英文思考**的技术问题，例如：

   > Explain step by step how a generational garbage collector works and the trade-offs involved.

4. 等模型开始思考，展开 **Think 行**，录制 10–20 秒（思考 → 译文流式逐批出现的过程）。
5. 存为 `docs/demo.gif`。

## 静态截图（给 dsh-market 详情页，AppStore 风格）

- `docs/screenshots/settings.png`：设置面板（语言选择 + 提供方下拉）
- `docs/screenshots/thinking-translated.png`：展开的 Think 行，译文与「原文」对照

## 录好后接入

1. 把 GIF / 截图放到对应路径。
2. 把 `README.md` 的 `## 🎬 Demo` 注释替换为：

   ```markdown
   ## 🎬 Demo

   ![dsh-think-translate demo](docs/demo.gif)
   ```

   （其余 7 个语言 README 的 `## 🎬 Demo` 注释同样替换。）
3. `screenshots.json` 已经指向上面两个截图路径，截图就位后 dsh-market 详情页会自动读取。
