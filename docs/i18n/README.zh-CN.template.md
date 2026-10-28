<p align="center">
  <img src="docs/assets/hero.zh-CN.png" width="100%" alt="dsh-think-translate：让 AI 的思考，用你的语言呈现" />
</p>

<p align="center">
  <b>为 DeepSeek Harness 提供显示层翻译。</b><br />
  读懂思考，跟上任务，也看清回答。原文完整保留，译文不进入模型上下文。
</p>

<p align="center">
  <img src="docs/assets/badge-mit.zh-CN.svg" alt="MIT License" />
  <img src="docs/assets/badge-local.zh-CN.svg" alt="支持本地 Ollama" />
  <img src="docs/assets/badge-original.zh-CN.svg" alt="保留原文与模型上下文" />
</p>

<p align="center">
  <b>中文</b> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.md">English</a> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.ja.md">日本語</a> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.ko.md">한국어</a> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.es.md">Español</a> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.fr.md">Français</a> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.de.md">Deutsch</a> · <a href="https://github.com/UncleK/dsh-think-translate/blob/main/README.ru.md">Русский</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="docs/assets/nav-quick-start.zh-CN.svg" alt="快速安装" height="24" /></a> &nbsp;·&nbsp; <a href="#demo"><img src="docs/assets/nav-demo.zh-CN.svg" alt="实际演示" height="24" /></a> &nbsp;·&nbsp; <a href="#features"><img src="docs/assets/nav-features.zh-CN.svg" alt="核心能力" height="24" /></a> &nbsp;·&nbsp; <a href="#comparison"><img src="docs/assets/nav-comparison.zh-CN.svg" alt="官方对比" height="24" /></a> &nbsp;·&nbsp; <a href="#faq"><img src="docs/assets/nav-faq.zh-CN.svg" alt="常见问题" height="24" /></a>
</p>

---

<a id="demo"></a>
## 看见思考发生

<table>
<tr>
<td width="50%" align="center" valign="bottom">
<img src="demo/demo.gif" width="100%" alt="思考链与回答翻译的实际操作演示" />
</td>
<td width="50%" align="center" valign="bottom">
<img src="demo/demo2.gif" width="100%" alt="dsh-think-translate 第二段实际操作演示" />
</td>
</tr>
<tr>
<td align="center" valign="top">
<sub>演示一 · 思考链与回答翻译</sub>
</td>
<td align="center" valign="top">
<sub>演示二 · 更多实际操作</sub>
</td>
</tr>
</table>

<a id="comparison"></a>
## 与官方翻译插件对比

<p align="center">
  <img src="docs/assets/translation-comparison.zh-CN.png" width="100%" alt="与官方翻译插件的功能和首次上线日期对比" />
</p>

本插件与官方思考翻译都接管思考界面，请二选一启用。

<a id="quick-start"></a>
## 一条命令，开始使用

```bash
dsh plugin --profile web add dsh-think-translate
```

安装后**完整重启 DSH Web**，打开 **设置 → 思考链翻译**，选择目标语言和翻译提供方即可。

<details>
<summary>从 GitHub 安装、升级与其他安装方式</summary>

从 GitHub 安装：

```bash
dsh plugin --profile web add github:UncleK/dsh-think-translate
```

升级 npm 版本：

```bash
dsh plugin --profile web add dsh-think-translate@latest
```

安装或升级后均需完整重启 DSH。手动部署可通过目录联接把包链接到 profile，并在 `cordis.patch.yml` 中插入 `dsh-think-translate` 插件行；普通使用建议选择上面的安装命令。

</details>

<a id="features"></a>
## 需要读懂的，不只是思考链

<table>
<tr>
<td width="50%" valign="top">
<h3>思考链，边想边读</h3>
<p>按段落与句子分批翻译。可选全部预翻译、懒加载历史，或仅在展开后翻译。</p>
</td>
<td width="50%" valign="top">
<h3>任务与回答，一起跟上</h3>
<p>覆盖任务卡片和输入区任务列表；回答正文提供独立翻译开关。</p>
</td>
</tr>
<tr>
<td valign="top">
<h3>审查理由，也能看清</h3>
<p>自动审查拒绝一次调用时，保留原文并追加目标语言的理由，原有操作按钮照常使用。</p>
</td>
<td valign="top">
<h3>原文与代码，完整保留</h3>
<p>代码、路径和命令在翻译前受到保护。译文只用于显示，不进入模型上下文。</p>
</td>
</tr>
<tr>
<td valign="top">
<h3>本地模型，用时再加载</h3>
<p>复用已有 Ollama 和模型，支持手动释放、禁用后释放与空闲自动释放。</p>
</td>
<td valign="top">
<h3>提供方，按你的顺序工作</h3>
<p>拖动排序并逐行启停。失败时尝试下一家，明显串语言的结果也会触发回退。</p>
</td>
</tr>
</table>

### 连接你已经在用的提供方

**Ollama · Google · Bing · OpenAI 兼容端点 · Anthropic Messages API**

也可以发现 DSH 已配置的提供方，无需重复填写端点和密钥。每一行都能单独测试，列表顺序就是尝试顺序。

```text
你的首选提供方 → 下一家已启用提供方 → … → 全部失败时保留原文
```

<details>
<summary>自定义端点、密钥与自动恢复</summary>

- 自定义端点支持 OpenAI 兼容的 `/v1/chat/completions` 和原生 Anthropic Messages API。
- 自动发现当前 DSH profile 及覆盖配置中的提供方；可重新扫描并加入翻译链。
- 声明 `apiKeyEnv` 的提供方在请求时解析密钥，解析结果不会写回插件配置。
- 失败结果在 Host 内存冷却 30 秒，之后翻译会恢复重试。
- 已经是目标语言的正文会按语言检测规则跳过；提供方测试仍会真实发起请求。

</details>

### 本地翻译模型，按需加载与释放

| 你的操作 | 插件行为 |
|---|---|
| 实际翻译或点击测试 | 按需启动服务、加载所选模型 |
| 点击“释放模型内存” | 当前翻译结束后释放；保留模型文件、开关和排序 |
| 取消勾选本地提供方 | 停用并释放所选模型 |
| 重新勾选或打开设置 | 不预加载；下一次实际翻译时再加载 |
| 设置空闲释放 | 默认 5 分钟，可选 1 / 5 / 10 / 30 / 60 分钟或关闭 |

空闲策略从下次使用起生效，由 Ollama 对当前模型计时，不修改全局环境变量。缺少软件或模型时，只有点击准备按钮后才安装或下载，并显示进度。

<a id="languages"></a>
### 让语言设置跟着你

中文 · English · 日本語 · 한국어 · Español · Français · Deutsch · Русский · Português

9 种目标语言、设置面板和任务文案保持一致，现已包含葡萄牙语，选择会在刷新后保留。

<a id="faq"></a>
## 遇到问题，先看这里

<details>
<summary><b>安装或升级后，看不到翻译入口</b></summary>

完整重启 `dsh web`。客户端模块图在进程启动时组合，仅刷新页面有时不足以加载新插件。设置页底部会显示实际安装包的版本号。

</details>

<details>
<summary><b>本地模型列表为空</b></summary>

检查 `ollama list` 或 `/api/tags`，确认运行中的服务使用了正确的模型目录；同时检查该服务生效的 `OLLAMA_MODELS`。不需要重新下载已经存在于其他模型目录中的文件。

</details>

<details>
<summary><b>升级 DSH 后，源码启动报 client bundles not found</b></summary>

在 DeepSeek Harness 仓库根目录先运行 `pnpm run build`，完成后重新启动 DSH Web。

</details>

<details>
<summary><b>翻译失败会影响正常对话吗</b></summary>

所有已启用提供方都失败时保留原文，插件不会用失败结果覆盖会话原文。可以在设置中逐行测试提供方，并查看最近错误；冷却后翻译会自动恢复重试。

</details>

<details>
<summary><b>最近更新与兼容性</b></summary>

**1.2.16** 补齐葡萄牙语翻译目标与界面，同步 9 种语言的 README、横幅和对比图，并声明市场三张展示图。

**1.2.15** 增加本地模型内存管理，适配 DSH `0.2.2-alpha.2` 的官方图片渲染、整轮思考折叠和正文原文选择。

**1.2.14** 拒绝明显错误语言的译文并尝试下一提供方，清理旧译文缓存并保留设置。

**1.2.13** 支持自动审查拒绝理由翻译。感谢 [llg1634](https://github.com/llg1634) 提供问题报告、初始补丁和测试。

更早版本与具体变更见 [GitHub Releases](https://github.com/UncleK/dsh-think-translate/releases)。

</details>

<details>
<summary><b>开发与工作原理</b></summary>

```text
浏览器 → 同源翻译接口 → 已启用的提供方链 → 译文或原文
```

- `lib/index.js`：Host 路由、提供方适配、配置、内存缓存与本地模型管理。
- `lib/client.js`：设置、显示层翻译、流式分批和浏览器缓存。
- `lib/config.json`：运行期配置，已从 Git 和 npm 包排除。
- 无需额外构建，源码即产物；修改 Host 后重启 DSH。
- 检查命令：`npm test`。

配置发现、凭据处理和维护说明见 [维护笔记](https://github.com/UncleK/dsh-think-translate/blob/main/docs/maintenance-notes.md)。

</details>

---

<p align="center">
  <b>dsh-think-translate</b><br />
  <a href="https://github.com/UncleK/dsh-think-translate/issues">反馈问题</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/releases">版本发布</a> &nbsp;·&nbsp; <a href="https://github.com/UncleK/dsh-think-translate/blob/main/LICENSE">MIT License</a>
</p>
