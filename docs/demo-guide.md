# 录制 demo GIF / 截图

## 目标

一个 **10–20 秒**的动画，展示核心价值：模型用英文思考 → Think 行实时流式出现目标语言译文 → 展开可对照原文。

仓库里现在有两段：

| 文件 | 内容 | 源尺寸 | 体积 |
|---|---|---|---|
| `demo/demo.gif` | 思考链翻译 + 会话内的效果 | 824×514 | ~590 KB |
| `demo/demo2.gif` | 设置面板完整走一遍（提供方链、表单、状态块） | 824×574 | ~640 KB |

两张图在 8 个 README 里是**同一行并排**显示的（`<div align="center">` 内），不是各自的 Markdown 图片语法 —— 原因见下面「嵌入方式」。

## 工具

- Windows 推荐 **ScreenToGif**（免费，直接存 GIF）：https://www.screentogif.com
- 或 Xbox Game Bar（`Win+G`）录 MP4，再用工具转 GIF。
- **压缩用 ffmpeg**（本机已有）；不要直接把录屏原文件提交进仓库。

## 录制步骤

1. 打开 DSH Web（http://127.0.0.1:3088）。
2. **设置 → 思考链翻译**：目标语言选「日本語」（或中文）；提供方链里挑一条能用的（本地 Ollama / google / 你自己配的端点）。
3. 发一条会让模型**用英文思考**的技术问题，例如：

   > Explain step by step how a generational garbage collector works and the trade-offs involved.

4. 等模型开始思考，展开 **Think 行**，录制 10–20 秒（思考 → 译文流式逐批出现的过程）。
5. 存成任意名字的原始 GIF（例如 `raw.gif`），**先压缩再放进 `demo/`**。

## 压缩成仓库用的体积

两条命令（第一条生成调色板并同时套用，ffmpeg 一个 filter graph 就能搞定）：

```bash
# demo.gif 这一类（8.3 fps 的录屏，保持原帧率）
ffmpeg -y -i raw.gif -filter_complex \
  "[0:v]scale=824:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 demo/demo.gif

# demo2.gif 这一类（12.5 fps，压到 12 fps 再省一点）
ffmpeg -y -i raw.gif -filter_complex \
  "[0:v]fps=12,scale=824:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 demo/demo2.gif
```

参数含义：`scale=824` 是宽度（README 里只显示约 410–550px，824 留了约 2 倍余量，别再用 1600px 的原始录屏）；`max_colors=128` + `bayer` 抖动在文字界面上和原图几乎无差别；`diff_mode=rectangle` 只重画变化区域，这是体积能砍掉一半以上的主要原因。

压缩前后对比一下：

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,nb_frames -of default=nw=1 demo/demo2.gif
```

## 改完图之后必须做的三件事

1. **换文件名或加 `?v=N`**：GitHub 的 README 图片走 camo 代理，**按 URL 缓存**。同名覆盖文件后，页面仍然显示旧图（直接打开图片链接却是新的）。把 README 里的 `src="demo/demo.gif"` 改成 `src="demo/demo.gif?v=3"`（版本号加一）即可强制重新抓取。
2. **重算宽度百分比**：两张图并排且要求**等高**，高度 = `宽度% × 容器宽 × (像素高/像素宽)`。当前是 demo 46% / demo2 41%（源图 824×514 和 824×574）。换了新图就用这条公式重算第二个宽度：
   `w2% = w1% × (h1/w1) ÷ (h2/w2)`
3. **更新本文件上面的尺寸/体积表**。

## 嵌入方式（README 里为什么是 HTML 而不是 `![]()`）

```html
<img src="demo/demo.gif?v=2" width="46%" alt="dsh-think-translate demo" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="demo/demo2.gif?v=2" width="41%" alt="dsh-think-translate demo 2" style="border:1px solid #4D6BFE;border-radius:8px;margin:4px" />
```

- 用 HTML `<img>` 才能控制 `width`（Markdown 图片语法不行）。
- **`style` 属性会被 GitHub 过滤掉**，所以边框/圆角只在本地预览有效；两张图之间的间隔必须靠同一行里的 `&nbsp;`（现在 6 个，约 24px）来实现，换行或空格会被折叠。
- 这一段在 8 个 README 里逐字相同，改一处要同步其余 7 个。

## 其它要一起更新的地方

- **`screenshots.json`**（仓库根）：一个图片路径数组，目前是

  ```json
  ["demo/demo.gif", "demo/demo2.gif"]
  ```

  换图或加图后同步它即可 —— 路径相对仓库根，**不带** `?v=N` 查询串。
- **`docs/demo-guide.md`**：本文件顶部的尺寸/体积表（图变了就跟着改）。

