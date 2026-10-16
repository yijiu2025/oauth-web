# oauth-web 项目文档

本目录放**本项目自己的文档**。**写文档前先读本文决定放哪；找文档也从本文进。**
通用规范（适合所有项目）的 master 在 CoreFlow 仓库
`docs/standards/`，本仓持两份常用副本（见下）—— 因为本仓是独立开源仓库，外部用户
拿不到 CoreFlow，副本必须自包含。

## 项目文档（只适用于本项目）

| 文档 | 内容 |
| --- | --- |
| [frontend-generation-guide.md](./frontend-generation-guide.md) | 前端生成手册：从零生成同技术栈前端的完整步骤（目录约定 / 验证关卡 / 已知约束） |
| [multi-theme.md](./multi-theme.md) | 多主题 / 多版式开发模式：本项目主题机制的全文与演进记录（强制规则，新增页面按第七节清单接入） |
| [theme-hot-update.md](./theme-hot-update.md) | 主题热更新部署设计：三层模型（token / 配色 / 主题包热更）、产物契约、加载器、部署拓扑与分期路线（**设计文档，尚未实现**） |
| [frontend/performance-tuning.md](./frontend/performance-tuning.md) | 性能调优方案与指标：现状实测 → 已落地优化 → 指标守门 → 部署层，数字均可复现 |
| [test-audit-2026-10-15.md](./test-audit-2026-10-15.md) | 2026-10-15 测试审计报告（历史快照，不再维护） |

## 通用规范副本（master 在 CoreFlow，改动双写）

| 文档 | master |
| --- | --- |
| [theme-replacement.md](./theme-replacement.md) | CoreFlow `docs/standards/theme-replacement.md` |
| [git-release-rules.md](./git-release-rules.md) | CoreFlow `docs/standards/git-release-rules.md` |

改规范时**两处同改**（或改完 master 后重新拷贝），否则副本静默过期。

## 共置文档（与代码同目录，刻意不集中到本目录）

这些文档被代码注释 / 脚本以「同目录」方式引用，移动会破坏工程惯例：

- `src/theme/README.md` —— 主题包 / 配色 / 版式的目录约定（被 `mobile-auth.scss` 注释引用）
- `e2e/VERIFY.md` —— 验证关卡清单（被 `verify-all.mjs` 等同目录脚本引用）
- `src/router/README.md`、`src/components/common/agreements/README.md`、
  `src/components/common/AntiCacheDebugPanel.README.md`、
  `src/composables/useAntiCache.example.md` —— 模块级说明

## 其他项目的文档在哪

CoreFlow 总文档站（含全部通用规范）：<https://github.com/yijiu2025/CoreFlow/tree/main/docs>，
入口是 `docs/README.md`（文档地图）。
