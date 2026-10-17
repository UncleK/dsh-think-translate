# 维护笔记 / Maintenance Notes

> 跨会话接力用:每排查一个坑,先记进来,下次从这续。

---

## 2026-10-17 — 1.2.11：Bing 国内重定向修复（issue #12）

保留 Bing 免费通道。会话页可能从 www.bing.com 跳转到 cn.bing.com；
新增 requestTextInfo 返回最终 URL，原 requestText 继续返回字符串。
Bing 缓存最终 origin 与页面 rich_tta 的 data-iid，翻译 POST 直接回到会话 origin，
避免提交时的 302 将 POST 改为无正文 GET。IID 属性顺序及引号变化均可识别，缺少时回退 SERP。
空响应、非 JSON 响应现在分别报告明确的 Bing 错误。

SOCKS/curl 通过 write-out 读取最终 URL 和状态；缺少元信息时明确失败，不猜测原域名。
真实 SOCKS 验证另发现默认 curl User-Agent 会收到 HTTP 401；
统一原生与 curl 的默认浏览器请求头后，www/cn 两个域名均能实际翻译，并保留显式请求头覆盖。
安装器的 curlArgs 入口保持原有行为。

回归先在旧 Bing 逻辑上复现原错误（Unexpected end of JSON input），修复后通过。
全套 296 项测试通过，较原 277 项新增 19 项，覆盖区域会话与缓存、真实本地 HTTP 302 链路、
最终 URL、SOCKS 元信息及请求头、空响应/非 JSON 错误，并保留 301/302/303 与 307/308 的标准语义。
node --check 与 git diff --check 通过。

真实 Bing 验证使用本次工作区代码与合成文本：

| 路径 | www.bing.com 会话 | cn.bing.com 会话 |
| --- | --- | --- |
| Node 原生直连 | 中、日译文成功 | 中、日译文成功 |
| Node 原生 HTTP 代理 | 中、日译文成功 | 中、日译文成功 |
| SOCKS 代理 / curl | 中、日译文成功 | 中、日译文成功 |

直接调用导出的 ADAPTERS.bing，简体、繁体、英、日、韩、俄、德、法、西九种目标均返回译文。
直接调用导出的 runChainFor，Bing 单提供方链的八段长文分块翻译成功，结果 provider=bing。
英文样例 The build failed because the proxy returned an empty translation.
实际译为“构建失败，因为代理返回了空的翻译。”及“プロキシが空の翻訳を返したため、ビルドは失敗しました。”。

验证边界：本机 VPN 环境没有自然触发 www 到 cn 的国内地域跳转；该跳转由本地 HTTP 服务复现。
表中的 cn 会话验证显式从真实 cn.bing.com 获取页面，再由未改写的适配器按最终 origin 提交，
不是关闭 VPN 后的纯大陆网络验收。代理验证以测试上下文注入实际本机代理，未改动 DSH 设置或安装包；
导出适配器和链路验证不等同于 Desktop/Web 界面验收。
package.json、锁文件、客户端版本与八份 README 已同步至 1.2.11；npm 发布包交由维护者发布。

---

## 2026-10-16 — 1.2.10：跟随当前 DSH profile 发现提供方（issue #11）

DSH 已将 settings.yaml 迁入 profile 的 cordis.patch.yml，旧正则既读错路径，也不认识 id/config 行。
新增 discovery.js，使用明确声明的 js-yaml 依赖读取 YAML；优先使用运行时 profileContext，
只读取当前 profile，应用 profile/home 补丁与启动覆盖，保留旧版 settings.yaml 路径。
可使用 configEditor 的当前行补全 bundle 继承值；编辑器服务在扫描时获取，避免插件启动顺序影响。
支持默认模型的 default-model/agent-default-model 行，以及原有 DeepSeek 官方 API 路线。
配置行的 config 按 DSH 语义整块替换，不合并已删掉的继承提供方；禁用行不导入。

密钥引用仍从 DSH home 的 .credentials.yaml 读取；literal/ref 密钥只留在内存，
所有配置响应和写盘继续经过 stripResolvedKeys。!!js 保留为不执行的标记，动态端点不猜值。
YAML 错误不返回可能含密钥的源行；失败扫描不触发旧 DSH 条目清理，页面显示实际配置路径。

277 项测试通过，覆盖 Desktop/Web 隔离、现代/旧版配置、层次替换、禁用项、凭据和页面诊断。
八份 README 同步路径与结构说明。npm 1.2.9 已核实发布，SHA-1 与上一份交付包一致。

本机 DSH 源码从 5badb15009 快进到官方 dsh-v0.2.1-alpha.4（86a402200d），
pnpm install --frozen-lockfile 完成，pnpm run build 的 9 个 gate 全部通过。
在真实 Web profile 安装 1.2.10 tgz 并启动前后端：页面显示 0.2.1-alpha.4，
重新扫描读到 web/cordis.patch.yml 的两个 DSH 提供方；官方 DeepSeek 路线实测返回中文译文。
页面 Ollama/Google 测试通过；测试第二位 Google 后，当前使用仍为首位已验证的 Ollama。
扫描接口和写盘无 DSH apiKey；profile 补丁、凭据及用户的原有配置项保持不变。
随后启动官方源码的原生 Windows Desktop 开发构建（同为 0.2.1-alpha.4，Electron 44.7.0），
通过 Desktop 插件界面安装并启用同一份 1.2.10 tgz。原生界面运行于 dsh-app://app/，
重新扫描实际读取 desktop/cordis.patch.yml，发现 Desktop 独有的 desktop-deepseek 和继承的 deepseek-official。
界面重新扫描显示 2 个提供方，desktop-deepseek 的 deepseek-flash 连通测试通过。
Web 仍只导入其 openrouter-ox 和 deepseek-official；两者未串用 profile。
Desktop 配置响应及写盘均无解析出的 DSH apiKey，凭据文件校验值未变，安装文件与发布源码一致。
这是原生应用的源码开发构建验证；未另测签名安装器。详细记录保存在 releases/1.2.10/NATIVE_DESKTOP_VALIDATION.json。

首次启动时修复了源码升级后 node_modules/.pnpm/node_modules 中遗留的失效 workspace 索引，
仅删除无有效 package.json 的旧链接，并将已搬迁的 workspace 链接指向当前目录；未修改 DSH 源码。
官方 primary-runtime 准备及 Office smoke checks 均通过。

本机 OpenRouter 的 stealth/ox-alpha 实测 404，响应说明测试期结束并指向 z-ai/glm-5.3-flash；
这是已有模型配置的上游退役状态，不改动用户模型选择。当前本地安装使用 1.2.10 tgz，npm 由维护者发布。

---

## 2026-10-16 — 1.2.9：目标语言与 Bing 修复（issues #8、#9、#10）

OpenAI/Anthropic 的日语词汇提示仅用于日语目标；系统和用户提示都明确完整语言名称，
中文目标另标明简体/繁体，避免小模型误读 ja/ko 或被跨语言词汇表干扰。
Bing 同时修正 fromLang=auto-detect 和中文目标码 zh-Hans/zh-Hant，显式 Hans 优先于地区码；
HTTP 200 内的 statusCode 错误会保留为 bing API 错误。

语言检测先排除路径、代码、标识符和嵌套 JSON，再判断正文；英文引用中文不视为整段中文。
日语假名和韩文可触发翻译，常用繁简区别字触发相应方向的转换请求，已有简体正文仍跳过。
这是语言/字形启发式检测，不是完整的字形转换词典，最终译文仍由提供方生成。
主机与浏览器在读取结果缓存前执行跳过判断；浏览器清理旧译文缓存并使用 v2 命名空间，保留设置。

新增回归覆盖两个模型协议的八种目标语言、Bing 参数及错误、语言检测与旧缓存。
实际 Bing 简体、繁体、日语、韩语返回译文；本地 qwen2.5:7b-instruct 英译中/日/韩返回对应语言。
报告中的 RogerBen/HY-MT2-1.8B 不在本机已安装模型中，未下载或声称完成该模型实测。

---

## 2026-10-14 — 1.2.8：原生传输与失败后恢复（PR #7）

普通 HTTP/HTTPS 翻译改用 Node 原生请求，避免为每个文本块启动 curl 子进程。
HTTP 代理支持转发和 HTTPS CONNECT；TLS 请求确实使用隧道，代理失败不会隐式直连。
保留 SOCKS 代理的 curl 兼容路径，以及 Ollama 官方安装器下载所需的 curlArgs。
POST 显式发送 UTF-8 字节长度，兼容拒绝 chunked 请求的提供方；本地端点绕过代理。

主机和浏览器失败缓存保留 30 秒，并返回 retryAt；思考和回答在冷却结束后自动重试。
缓存命中不会算作新的失败而永久停止翻译，组件卸载会取消回答重试。
浏览器允许本地模型加载及提供方回退所需时间，传输截止时间覆盖连接和响应体。

194 项测试通过，包括 16 项新增安装边界、代理/TLS、超时和失败恢复测试。
Google 通过当前 HTTP 代理实际翻译成功。Bing 当前返回空结果，与原版 1.2.7 表现一致；
不将其记录为联网验证通过。首次全新 Ollama 安装仍未在干净机器上实际执行。
PR #7 已合并，版本标签和 GitHub Release 为 v1.2.8；npm 包交由维护者发布。

---

## 2026-10-09 — 1.2.7：本地 Ollama 准备和当前提供方

已启用的本地 Ollama 成为链上第一位时，以及点击其测试按钮时，会检查本地服务、
查找已有程序、启动服务并预加载所选模型。已有服务/模型复用，准备任务合并并发请求。
查找顺序为 PATH、常见目录、Windows 注册表的自定义安装目录；保留 OLLAMA_MODELS。
仅识别内置 openai 的直接 loopback:11434/v1，其他自定义或远端端点不触发本机安装。

软件或模型缺失时显示首次准备入口，用户点击后才执行安装/模型下载。
Windows 使用官方签名安装器，校验 Valid 和精确 Ollama Inc. 组织，忽略安装器子进程继承的输出管道。
macOS/Linux 可复用和启动已有程序，缺少软件时显示官方安装指南，不自动提权安装。
进度分为检查、下载软件、签名验证、安装、启动、下载模型、加载、就绪/错误；
下载显示百分比和字节数，其他阶段显示状态。8 种语言均提供对应提示。

“当前使用”按主链及启用的 fallback 顺序选择已启用且验证成功的提供方，
不按最后点击的测试按钮选择。模型/端点/凭据变更使旧验证结果失效，过时测试回复被忽略；
真实链路失败尝试也会更新验证状态，避免继续把失败的第一位显示为可用。

178 项测试通过。Windows 实机从 Ollama 未运行开始，查找到已有安装并启动，
qwen2.5:7b-instruct 预加载到显存，翻译测试返回中文。Chrome 实测第一位本地测试成功后，
第二位 Google 同样测试成功，当前提供方仍保持本地模型。
首次全新 Windows 安装未实际执行，签名校验、下载进度、缺失/失败和重试流程有离线测试。
插件启动的 serve 进程由 DSH subprocess 生命周期管理；复用的外部服务不受插件停止影响。

---

## 2026-10-09 — 1.2.6 候选版：assistant-step 分组重复（issue #6）

DSH 为同一 assistant step 分别传入 `groupPart: reasoning` 和 `response`，
插件 1.2.5 没有筛选块，导致两次都绘制完整的思考与回答。
修复遵守官方分组筛选，并保留原始块下标以维持流式尾部判断；
原文错误回退也按组筛选，中断提示遵守官方的仅思考或回答组显示规则。

修复前六个分组测试均复现；修复后 `npm test` 共 155 项通过。
覆盖翻译开关、完成/流式/中断状态、图片分组、代码块、旧版无分组调用和原文回退。
原始 transcript 块不变。候选包通过 DSH 0.2.1-alpha.1 的真实兼容性检查，无需豁免。
发布包交由用户发布 npm。

DSH 在 `dsh-v0.2.1-alpha.1` 完整构建通过，Web 启动在 127.0.0.1:3088。
页面、前端 JS 资源及插件版本 API 均返回 200，API 与设置页均确认插件为 1.2.6。
Chrome 历史会话实测：57 个 reasoning 入口、3 个 response 入口；
回答组无 Think 行，思考组无正文段落或图片，浏览器无渲染错误。
服务和复查标签页按用户要求保持运行，原插件运行时配置已保留。

### 复查服务的市场重启失败

市场重启把 cwd 切到 `apps/cli/src`，相对 `--patch apps/web/tests/pin-browse-picker.overlay.yml`
因此解析到不存在的文件；日志报 ENOENT，失败发生在插件加载之前。
本次复查启动器改用 overlay 的完整绝对路径，避免 cwd 变化影响重启。
随后通过市场的真实 restart API 验证：替换进程启动成功，前端返回 200，
翻译插件 1.2.6 与市场 1.66.14 同时启用，未出现该路径错误。

---

## 2026-10-01 — todo_write 注册冲突（issue #4）

官方 `todo-toolview` 在 `tool.call.toolview` 用 `todo_write`、默认 priority 0 注册；
本插件此前也用默认 0，导致同 key、同 priority 冲突，客户端插件同步失败。
翻译版注册改为 `priority: -1`，与现有 `assistant-step` 和 `todo` dock 的覆盖方式一致。

回归测试加载真实客户端 bundle，分别让官方条目先注册、后注册，验证两条目共存、
翻译版按较低 priority 被选中，并且设置页能继续注册和渲染。
`npm test`：145 项通过；`node --check lib/client.js` 和 `lib/index.js` 通过。
另用本机 DSH 的真实 `SlotCore` 核对两种注册顺序：原版均报冲突，修复版均能加载、
选中翻译版，且移除翻译版后恢复官方条目。
### 1.2.5 — DSH 0.2.0-rc.2 升级验证

`peerDependencies` 增加 `^0.2.0-rc.2`，通过该版本的真实 `evaluatePluginCompatibility`，
无需 `compatibility.json` 豁免；旧 0.1 系列范围保留。
该版本的真实 `SlotCore` 验证了 assistant、todo toolview、todo dock 三处覆盖的
两种加载顺序、优先级选择与移除后恢复官方条目。

Windows 源码版 DSH 在 `dsh-v0.2.0-rc.2` 完整构建通过。Chrome 实测设置页显示
`v1.2.5`、旧会话及代码块正常渲染、思考行生成译文且原文可展开，浏览器无渲染错误。
任务卡片 preparing/start/result 和输入框任务面板另有模拟渲染测试，未调用真实模型。
此验证覆盖 Web；未实测桌面应用或其他操作系统。

8 份 README 同步补充 0.2 升级命令。npm 包只包含两张已跟踪 demo GIF，
不打包本地演示视频或运行时配置。发布包交由用户执行 npm 发布。

市场当前条目已绑定 `npm: dsh-think-translate`，无旧 tarball；版本和仓库 README
由市场定时抓取，无需每次发版提交市场 PR。卡片简介在市场 YAML 中单独维护。

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

## 1.2.4(2026-09-11)—— 声明宿主要求 + 市场条目清理

### 1) 市场卡片上的「未声明宿主要求」

**判定逻辑**(`dsh-market/src/discovery-compatibility.ts`):它把 `engines.dsh` 和
`peerDependencies` 里满足 `/^@deepseek-ai\/dsh(?:-|$)/` **且存在于本机 hostPackages
清单**的包合并成"宿主要求";一条都取不到就返回 `basis: 'undeclared'` → 显示
「未声明宿主要求」。我们唯一的 `@deepseek-ai/dsh-*` peer 是
`dsh-client-ui-primitives`,而且是 optional、不在 host 清单里,所以被判为未声明。

**修复**:在 `package.json` 声明 `"engines": { "node": ">=20", "dsh": ">=0.1.0-rc.6" }`。
`engines.dsh` 无条件参与判定,且他们的比较是
`satisfiesRange(host, range, { includePrerelease: true })` —— 所以对
`0.1.5-rc.1` 这类预发布版本的 host 也能匹配,不会误判成不兼容。

**注意**:声明过高的下限会真的把老 host 标成不兼容(判定里 `false` = incompatible),
所以取 `>=0.1.0-rc.6`(本插件只依赖 slots / settings.section,老版本同样能跑)。

### 2) 目录条目里的陈旧 tarball(已提 PR)

`data/plugins/UncleK__dsh-think-translate.yml` 里有一行
`tarball: .../releases/download/v1.0.10/...tgz`,是 1.0.10 时代的预编译包。
市场安装顺序是"npm 优先 → 作者 tarball → GitHub 源码",所以这一行只在 npm 路径失败时生效,
而那正是它会装出一年前旧版本的场合。1.1.0 之后我们不再往 release 挂 .tgz,这个字段无法自更新,
因此直接删掉,让 npm 成为唯一来源 → **PR awesome-dsh-plugin#4827**。

### 3) 顺带说明:为什么我们插件卡片上有一行 `github:...#sha`

因为这台机器的 profile 是**从 GitHub 安装并锁定 commit** 的
(`~/.dsh/profiles/web/package.json`:`github:unclek/dsh-think-translate#5c01f9ee...`),
而 `dshmarket` 等是 npm 安装(`^1.45.1`)所以只显示版本号。git 安装的更新要拉整个仓库
(国内慢),想改成 npm 形式可 `dsh plugin --profile web remove` 后重装 `@1.2.4`。

---

## 1.2.3(2026-09-11)—— 一个标签的补丁版

**只改了一处**:批量入链按钮的文案去掉"链"字
(`dshImportAll`:全部加入链 → 全部加入,8 种语言同步)。

为什么单独发一版:npm 上的 **1.2.2 是从提交 `8c77ceb` 发布的**,那次发布早于这个文案改动,
而 npm 的版本号不可覆盖,所以只能以 1.2.3 交付。发布内容与 1.2.2 的差异**仅此 8 个字符串**
(`git diff 8c77ceb..1.2.3 -- lib/` 可见)。

**教训(操作层面)**:用户报文案时先问清范围再动手——我曾顺手把
`connFail`/`providerUnused`/`providerAddToChain`/`providerRemoveFromChain` 的"链"字样也改了(32 条),
用户明确只要那一处,已全部还原。发布后再改文案 = 必须再发一版,所以"发布前确认范围"比"顺手统一"重要。

---

## 1.2.2(2026-09-11)—— 继承 DSH 官方路线 + 视觉微调

### 1) 只列出 openrouter-ox,没有 DeepSeek 自己

- **原因**:「继承 DSH 已配置的 API」只读 `llm-pi-ai.providers`(手写的自定义端点)。
  而**官方 DeepSeek 路线是 harness 内置的**,不写在那里——它由
  `agent-default-model: {provider: deepseek-official, model: deepseek-flash}` 加上
  `DEEPSEEK_API_KEY` 凭据决定。
- **实现**(`extractHarnessDefaultRoute`):解析 `agent-default-model`,当 provider 属于
  插件会说的内置路线时合成一条 DSH 条目。内置路线表目前只有
  `deepseek-official` → `{type: openai, baseURL: https://api.deepseek.com, apiKeyEnv: DEEPSEEK_API_KEY}`
  (依据 `packages/llm/llm-deepseek`:同一个 `PUBLIC_BASE_URL`、同一个 `DEFAULT_API_KEY_ENV`,
  传输也是 OpenAI 兼容的 `${baseURL}/chat/completions`)。手写声明的同名 id 优先,不会被覆盖。
- **效果**:继承菜单现在同时出现 `openrouter-ox` 与 `deepseek-official`,
  后者可直接入链,用 DeepSeek 官方 API 翻译。

### 2) 两处视觉微调(用户反馈)

- **行内徽标不再实心**:`.xl-badge` 原来是"实心品牌色 + 白字粗体",在品牌色接近黑的主题下
  每行都像两个黑块。现在改成浅描边小标签(`background:transparent` + 1px 边框 + 70% 不透明度);
  `DSH` 与 `env:NAME` 都保留——前者说明该行由 harness 管理(不能编辑/删除),
  后者说明密钥来自环境变量/DSH 凭据。
- **链标题改名**:`providerDrag` 从「拖动排序」改成「翻译优先级(拖动排序)」(8 种语言同步),
  因为列表顺序**就是**投递顺序,标题该说明含义而不只是手势。

---

## 1.2.1(2026-09-11)—— 1.2.0 发布后用户报的两个 bug

### 1) 设置左侧的书本图标消失(自己写的 bug)

- **现象**:更新到 1.2.0 后,「思考链翻译」那一行的图标整个没了(既不是书本,也不是齿轮)。
- **根因**:1.2.0 把"替换 shell 图标"改成"在 shell 图标前插入自己的图标 + 隐藏 shell 图标"。
  第二轮装饰时 `btn.querySelector("svg")` 会先命中**我们自己插入的书本 svg**(文档顺序更靠前),
  于是代码把**自己的图标**隐藏了 → 两个都不可见。
- **修复**:新增 `shellNavIcon(btn)`,只找 shell 的 svg —— 先扫直接子元素,再用
  `data-xl-nav-glyph-svg` 标记排除自己的图标(`lib/client.js`)。
- **为什么测试没挡住**:原 DOM 测试只断言了"shell 图标被隐藏 + 只有一个 holder",
  没断言"自己的 svg 仍然可见"。已补回归测试
  `keeps its OWN glyph visible on every later pass (regression: the book vanished)`,
  并给测试 DOM stub 补上 `hasAttribute` 与 innerHTML 解析。把修复去掉后该文件 4/4 全红。

### 2) 「继承 DSH 已配置的 API」说没发现 provider(用户明明有)

- **根因**:插件在猜目录。`DSH_HOME` 不存在时回退到桌面版布局
  `%APPDATA%\dsh-desktop\harness`,而这台机器的 home 是 `~/.dsh` —— 那个目录不存在,
  于是读不到 `settings.yaml`;而且 discovery **整体静默失败**,面板只会说"没有发现"。
  注意:`DSH_HOME` 在 DSH 给工具子进程注入的 shell 里有,不代表 web 进程也有。
- **修复**:目录解析对齐 DSH 自己的规则(`@deepseek-ai/dsh-home-paths`:
  `$DSH_HOME` → `~/.dsh`,空白视为未设置),桌面版路径降为兜底;并且逐个候选检查
  哪个真的存在 `settings.yaml`(`harnessHomeCandidates` / `pickHarnessHome`,已导出 + 单测)。
- **不再静默**:`discoverDshProviders` 记录诊断(候选目录、实际使用、两个文件是否找到、
  找到哪些 provider),`GET /_xlate/dsh-scan` 在响应副本里带 `dshScan`(不落盘),
  面板在"没发现"时直接显示扫描过的路径。

### 3) 表单里的 `env:NAME` 徽标去掉

按用户反馈移除:`apiKeyEnv` 是预设自带的实现细节,保存后的行上本来就有 `env:NAME` 徽标;
"输入密钥即清掉 env 名"的行为保留,所以看得见的那把密钥一定生效。

### 验证

- `npm test`:**129 通过**(新增 5 条 home 解析单测 + 1 条图标回归测试 + stub 能力补齐)
- 沙箱实跑:把 `DSH_HOME` 删掉后 `discoverDshProviders()` 仍能找出 `openrouter-ox`;
  候选顺序 `[~/.dsh, %APPDATA%\dsh-desktop\harness]`

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
