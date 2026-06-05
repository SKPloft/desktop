<p align="right">
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

# Atuin Desktop for VRCD

*注意：这是官方 [Atuin Desktop](https://github.com/atuinsh/atuin) 的一个社区分支/自定义构建版本，为特定组织引入了 **实验性** 的完全国际化 (i18n) 支持以及各种 AI 提供商的 bug 修复。由于此分支可能设置了破坏性行为，如果您发现 bug，请在提交到官方仓库之前，考虑先在当前仓库的 issue 页面报告。*

<p align="center">
 <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/atuinsh/atuin/assets/53315310/13216a1d-1ac0-4c99-b0eb-d88290fe0efd">
  <img alt="Atuin Desktop" src="https://github.com/atuinsh/atuin/assets/53315310/08bc86d4-a781-4aaa-8d7e-478ae6bcd129">
</picture>
</p>

<h1 align="center">Atuin Desktop</h1>

<p align="center">
  <em>可执行的运行手册。一个本地优先、真实的终端工作流编辑器。Atuin Desktop 看起来像文档，但运行起来像你的终端。</em>
</p>

<p align="center">
  <a href="https://github.com/atuinsh/desktop/releases">下载</a> | <a href="https://docs.atuin.sh/desktop">文档</a> | <a href="https://hub.atuin.sh/">中心</a> | <a href="https://discord.gg/Fq8bJSKPHh">Discord</a>
</p>

<p align="center">
 <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://docs.atuin.sh/desktop/images/atuin-desktop-ss-dark.png">
  <img alt="Atuin Desktop" src="https://docs.atuin.sh/desktop/images/atuin-desktop-ss-light.png">
</picture>
</p>

## 🚀 公开测试版 (Open Beta)

Atuin Desktop 目前处于 **公开测试版**。我们正在积极收集反馈，并根据实际使用情况改进体验。

阅读 [发布公告](https://blog.atuin.sh/atuin-desktop-open-source/)

## 什么是 Atuin Desktop?

大多数基础设施都由当出问题时某人记住的五个命令来维系。文档早已过时（如果存在的话），而真正的答案被埋在 Slack 的帖子中，在 Notion 中腐烂，或者被困在某人的 shell 历史记录中。

Atuin Desktop 通过创建 **可执行的运行手册 (runbooks)** 解决了这个问题，弥合了文档和自动化之间的差距：

- **消除上下文切换**：在一个地方链接 shell 命令、数据库查询和 HTTP 请求
- **不会腐烂的文档**：直接执行并保持相关性
- **可重用的自动化**：带有类似 Jinja 模板的动态运行手册
- **即时调用**：从您真实的 shell 历史记录中自动完成
- **本地优先，CRDT 驱动**：如果在您的终端中运行，它就能在运行手册中运行
- **同步和共享**：使用 Atuin Hub 使跨设备和团队的运行手册保持最新

## 反馈和支持

我们在测试阶段积极寻求反馈！请使用此仓库进行：

### 🐛 报告问题

- 发现了 bug？[提交 Issue](../../issues/new?template=bug_report.md)
- 对于本分支引入的翻译问题和 AI 修复，请在**本仓库**报告。

### 💡 提出功能请求

- 有好主意？[提交功能请求](../../issues/new?template=feature_request.md)
- 告诉我们您的工作流程以及 Atuin Desktop 如何更好地支持它。

## 许可证

Copyright 2025 Atuin, Inc

采用 Apache License, Version 2.0 授权；有关详细信息，请参阅 LICENSE 文件。