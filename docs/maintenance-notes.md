# 维护笔记 / Maintenance Notes

> 跨会话接力用:每排查一个坑,先记进来,下次从这续。

---

## 2026-09-03 — DSH 0.1.2-alpha.5 升级后「答案整条消失」

### 现象

- 升级跨度:`dsh-v0.1.1-rc.2` → 当前 master(≈ `0.1.2-alpha.5` + 后续提交)。
- 长回答(含表格、代码块、流式文本)渲染时,整条回答被一行红字替换:
  `[xlate] Cannot read properties of undefined (reading 'code')`
- 会话记录里的内容没丢,只是 UI 渲染把整条回答顶掉了。

### 根因方向(尚未最终定位)

- 插件全文**从不读 `.code` 属性**(grep 验证)→ 异常发生在插件渲染子树**内部的新版官方组件**里。
- 最可疑:官方 `MarkdownText`(`@deepseek-ai/dsh-client-ui-primitives`)在 0.1.2-alpha 系列**新增的流式代码块语法高亮路径**。
- 旧 `XBoundary`(错误边界)只显示 `err.message`、把整条回答换成错误行 = 设计缺陷放大症状。

### 修复(1.0.12,commit `ef12ab6`)

正常路径完全不变:**官方 MarkdownText 全程渲染(流式 + 落定)**,不做纯文本降级
(2026-09-03 用户明确要求:退回自渲染纯文本样式体验差)。

只加了两层「保险丝」,把故障模式从「整条消失」变成「单块降级 + 可定位」:

1. **`XBoundary`**(client.js):支持 `fallback` prop —— 出错时渲染「一行红警告 + 调用方提供的原文回退」;
   并加 `componentDidCatch` 把**完整 error.stack 打进浏览器 console**(`[xlate] render error:`)。
2. **块级保险丝 `TextBlockSafe`**:`AssistantView` 里每个 text block 单独包边界;
   官方 MarkdownText 崩了 → 只把**那一块**降级成原文(走插件自有的 `Markdownish`,纯字符串操作,不会再崩)。
3. **整条级保险丝 `AssistantViewSafe`**:块循环之上的脚手架( hooks / turn-data / 图片 loader 等)崩了
   → 回退展示所有 text/reasoning 块的原文拼接,回答永不整条消失。

### 验证

- profile 更新到 1.0.12 后,长回答正常显示 ✅
- npm `latest` = 1.0.12 ✅

### 遗留(下次出现时做)

- 若某条长回答顶部又出现「红警告 + 原文」= 兜底在工作。
  取浏览器 console 里 `[xlate] render error:` 后面的**完整 stack**,
  即可定位官方 MarkdownText 读 `.code` 的确切位置 → 针对性修(可能需要在传给 MarkdownText 前清洗文本,或绕开其流式高亮路径)。

---

## Slot / 契约兼容快照(2026-09-03 在 0.1.2-alpha.5+ 上实测 active)

| 插件注册 | Slot | 说明 |
|---|---|---|
| `assistant-step` @ priority -1 | `conversation.chat.node` | 压过官方 0 优先级;key 表含 `assistant-step` |
| `todo_write` | `tool.call.toolview` | key 域开放 |
| `todo` @ priority -1 | `conversation.input.dock` | 压过官方 `conversation-todo-dock` |
| `dsh-think-translate`(order 50) | `settings.section` | 设置页 |

### 已知低风险假设(官方改契约时先查这里)

- `XDockTodo` 用 `props.t` + `props.useProjection("todos")`;新契约 `InputZone` 只声明
  `{ session, input }`,`t` 调用已包 try/catch 降级英文默认。若官方把 dock 入口契约再改,需复查。
- `.xl-dock` 依赖主题 token `--dsw-specific-tip` 与布局变量 `--dsh-composer-card-max-width /
  --dsh-composer-side-clearance / --dsh-composer-dock-inset`(官方 `TodoPanel.module.css` 同款)。
  若 DSH 再改名 token,此处背景/尺寸会失效,查 `ui-theme` 的 design-platform.css。

## CSS 拼写核对(2026-09-03)

- 仓库里 `.xl-dock` 背景用的是 **`--dsw-specific-tip`**(dsw 前缀),与官方一致;
  不存在 `--dsh-specific-tip`。排查时别被旧文档带偏。

---

## 1.2.0(2026-09-11)—— 本轮全量审查后的状态

### 这一版包含

- **PR #2**(动态提供方链)+ `apiKeyEnv`(密钥只从环境变量/DSH 凭据解析,不落盘)
- **issue #3 修复**:官方 MarkdownText 的嵌套 `labels.code.copyLabel/footnotes` 契约
- **一键继承 DSH 配置的 API**:设置页「继承 DSH 已配置的 API」按钮,重新扫描
  `~/.dsh/settings.yaml` + `.credentials.yaml` 并批量入链(密钥不复制,请求时解析)
- 模型预设按各家 2026-09 文档更新,两个建议菜单末尾都标注「仅为建议」
- 8 语言文案补全(之前 6 种语言里整套提供方管理 UI 是英文)、去掉 15 个废弃键

### 审查发现并修掉的(本轮)

| 问题 | 影响 | 位置 |
|---|---|---|
| `GET /_xlate/dsh-scan` 与 `POST /_xlate/config` 把 live config 回给浏览器 | **凭据泄露**(同源/本机) | `lib/index.js` 三条 config 响应统一走 `stripResolvedKeys` |
| `config.json` 解析失败即被默认值覆盖 | 手改一个逗号就丢全部 provider/密钥 | 先备份 `config.json.corrupt-<ts>` |
| 改链/换模型后 host 缓存不失效 | 旧译文与「当前使用」一直显示旧提供方 | 保存配置即清缓存 |
| 空模型列表下下载无进度、失败无提示 | 用户看到「点了没反应」 | pull 区域两种状态都渲染 |
| `apiKeyEnv` 不可见、手打密钥被忽略 | 配了预设后自己的 key 不生效 | 表单显示 `env:NAME`,两者互斥 |
| `/_xlate/models` 用 `p.apiKey` 而非 `resolveApiKey` | 纯 env 提供方模型列表永远空 | `lib/index.js` |
| `migrateConfig` 把用户关掉的 fallback 重新打开 | 白跑一遍免费链 | 改为 `enabled:false` |
| `runProgram` 不读 stderr | `curl exit 7:` 无原因 | 顺带排空管道避免 64KB 阻塞 |
| 切目标语言重挂载面板丢表单 | 填到一半换语言全白填 | 草稿状态移到模块作用域(`useDraft`) |
| 6 种语言缺 `copy`/`copied` | 代码块复制按钮是英文 | UI_TEXT 补全,并加语言键集一致性测试 |

### 验证

- `npm test`:**123 通过**(host 单测 + 客户端契约 + 真实 bundle 挂载渲染/重挂载 + 导航图标 DOM 测试)
- 沙箱副本实跑路由:三处响应与磁盘均无密钥;配置变更后缓存确实失效;坏 config 留存备份
- 真实 bundle 探针:8 语言渲染无 `undefined`、行操作/表单/继承 DSH/下载进度与失败/404 回退全部通过
- npm 包体:2.4 MB → **1.7 MB**(两张 demo GIF 用 ffmpeg 重压,见 `docs/demo-guide.md`)

### 遗留

- 官方 `settings.section.icon` 座位尚未合入 DSH;插件已自带内联图标 + 一次性 DOM 装饰兜底,
  老版本也显示正确图标。上游补丁留在 `..\.pr-staging\dsh-settings-section-icon.patch`
  (不影响使用,也不需要等它)。
- `demo/` 里两张 GIF 的宽度百分比与源图比例绑定(46% / 41%);换图后按
  `docs/demo-guide.md` 的公式重算,并给 URL 加 `?v=N` 以击穿 GitHub 的 camo 缓存。

(本轮列出的死代码 —— `formName` 状态、两条 fallback CSS、`applyLocal` 的 fallback 分支 —— 已删除。)

