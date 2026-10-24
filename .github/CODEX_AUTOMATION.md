# GitHub 自动任务

Issue 的新建、重新打开、编辑，以及 PR 的新建、重新打开、提交更新和 ready-for-review 会触发 `.github/workflows/codex-forward.yml`。相关作者或维护者可通过 `/codex ` 评论继续任务；普通评论和处理结果不会循环触发。

任务由本机 Codex App 固定会话 `GitHub 自动任务 · dsh-think-translate` 处理，实际工作目录是 `E:\VP\DSH_plugins\dsh-think-translate`，固定模型为 `gpt-6.1-sol`，推理强度为 `xhigh`。父目录 DSH_plugins 和 Setup 不作为插件任务工作目录；Setup 只运行调度器和保存证据。每次结果评论包含对应会话和 Actions 链接。

先排查、实现和验证，再由调度器在插件目录独立执行 `npm test`。涉及翻译逻辑和客户端时，仍按 `docs/maintenance-notes.md` 检查提示词、缓存、提供方后备链，并完成实际 Web 与原生 Electron Desktop 验证。只有确有产品变更、必要验证和独立测试通过后，才进入发布阶段。

发布沿用项目现有流程：同步 package、lock、客户端版本与八份 README，生成并检查 `npm pack` 安装包及哈希，提交、tag、push，发布 GitHub Release 并附 tarball 与校验信息。npm registry 由维护者单独发布，自动流程不执行 `npm publish`。文档、分析和调度接入不升级产品版本、不制造 Release。

云端转发使用专用 GitHub App 的短期令牌，只能调度私有仓库的 Actions；转发工作流不 checkout 或执行 PR 代码。本机核验仓库 ID、源工作流、源运行和 PR 当前 head，保留既有未提交文件，包括未跟踪媒体。所有者创建、标题以 `[dispatch-check]` 开头的 Issue/PR 用于只读接入验收，不修改或发布产品代码。
