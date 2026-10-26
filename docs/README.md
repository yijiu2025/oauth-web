# oauth-web 文档

> **本文档站入口**：[VitePress 文档站](https://yijiu2025.github.io/oauth-web/)（本地 `npm run docs:dev`）。
> 登录 / 授权 / iframe SSO 等主线流程的权威细节在文档站，本文件是仓库内文档地图。

## 文档站（VitePress，`docs/` 目录）

- **指南**：简介、快速上手、目录结构、登录流程、注册与找回密码、OAuth 2.1 授权、扫码登录、iframe SSO 嵌入；
- **参考**：请求安全（H5 签名）、国际化、路由与页面注册表、设备版式；
- **工程**：Git 提交与发版、性能调优。

## 主题机制（属于另一个仓库）

本仓库的「多主题 / 多版式」能力由独立库 [skinsuite](https://github.com/yijiu2025/theme) 提供。
主题包目录契约、设备词汇、URL 参数键、配色 / 版式替换等**全部机制文档**在 skinsuite 文档站：

👉 **[skinsuite 文档站](https://yijiu2025.github.io/theme/)**

## 仓库内文档（不进 VitePress 站）

| 文档 | 内容 |
| --- | --- |
| [frontend-generation-guide.md](./frontend-generation-guide.md) | 前端生成手册：从零生成同技术栈前端的完整步骤 |
| [git-release-rules.md](./git-release-rules.md) | Git 提交 / 发版 / 版本号 / 分支统一规则（master 在 CoreFlow） |
| [frontend/performance-tuning.md](./frontend/performance-tuning.md) | 性能调优完整实测（文档站 `工程 · 性能调优` 是它的摘要） |
| [test-audit-2026-10-15.md](./test-audit-2026-10-15.md) | 2026-10-15 测试审计报告（历史快照，不再维护） |

## 共置文档（与代码同目录，刻意不集中到本目录）

这些文档被代码注释 / 脚本以「同目录」方式引用，移动会破坏工程惯例：

- `src/theme/README.md` —— 主题资产目录约定（主题机制见 skinsuite 文档站）
- `e2e/VERIFY.md` —— 验证关卡清单（被 `verify-all.mjs` 等同目录脚本引用）
- `src/router/README.md`、`src/components/common/agreements/README.md`、
  `src/components/common/AntiCacheDebugPanel.README.md`、
  `src/composables/useAntiCache.example.md` —— 模块级说明
