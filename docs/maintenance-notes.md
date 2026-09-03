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
