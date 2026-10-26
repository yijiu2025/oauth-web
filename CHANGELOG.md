# Changelog

本仓库遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：major（破坏性变更）/ minor（新增功能，向后兼容）/ patch（修复）。

## 未发布（Unreleased）

### 新增

- **设备判定三态**：`standard` / `tablet` / `mobile` 三态 + 屏幕方向；设备清单注入化——词汇与布线收在宿主一份清单，主题库零设备状态（`src/device/` 机制层）
- **VitePress 文档站**：`https://yijiu2025.github.io/oauth-web/`，以登录 / OAuth 2.1 授权为主线的 14 篇文档，`docs-pages.yml` 推 main 自动部署 GitHub Pages
- **README 英文为主**：`README.en.md` → `README.md`，中文版 → `README.zh-CN.md`

### 修复

- **审查问题全量修复**（安全 / 健壮 / 结构 / 一致性 / a11y）：
  - 安全：MiniLogin 补协议勾选校验；重置 token 用 `history.replaceState` 抹 URL；错误上报剥敏感 query；协议占位符 / 个人邮箱加 CI 阻断脚本
  - 健壮：404 安全解码（畸形 URL 不崩）；SliderCaptcha 键盘可操作；checkEmail 竞态；rsaEncrypt 超时
  - 结构：`stores/auth` 删死代码；跨设备契约组装样板收口 `contract-utils.ts`（消除 Standard/Mini/app 三端复制漂移）
- **Sass `@import` deprecation 静默**：`silenceDeprecations: ['import']`（`@import 'tailwindcss'` 是 Tailwind v4 官方引入方式，改 `@use` 会破坏引入）

### 依赖

- `skinsuite` 0.6.0 → 0.11.3（连续升级：vue 绑定层重构、`./vue/panel` 子路径修复、设备侧与主题侧分离口径定稿）

### 文档与社区设施

- 补齐 `SUPPORT.md` / `CHANGELOG.md` / `.github/FUNDING.yml`

## 1.1.0 — 2026-10-17

### 变更

- **Tailwind CSS v4 迁移**：移除 `tailwind.config.js`，语义色板 / 圆角 / 字体栈全部进 `main.scss` 的 `@theme`；`@source` 扫描、`@custom-variant dark` 显式化
- **依赖安全升级**：`postcss-selector-parser`、`tailwindcss`、`source-map-js`
- **CodeQL 代码扫描**：统一走 Default setup，删除自定义 workflow
- **GitHub 社区标准文件**：补齐 CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / ACCESSIBILITY / issue 模板

## 1.0.1 — 2026-10-15

### 修复

- 修 4 个关卡期望值漂移与 console-strip 残留目录污染
- 别名双形态回落（源码直供 / npm 回落），修 CI 单仓 checkout 解析失败
- `index.html` 补全网站元信息并加暗色预置脚本

### 文档

- 建 `docs/` 目录收纳项目文档，前端生成手册移入并规范命名
- 统一环境变量文件（四文件同序同注释）+ 主题替换规范
- multi-theme 实例文档移入本仓

### 其它

- 接入 GitHub Actions 门禁并修复 `scripts/` 的 lint 全局缺失
- 包体积预算守门关卡与性能调优定稿
- 引入统一发版规则与通用发布脚本

## 1.0.0 — 2026-10-14

- OAuth 2.1 登录授权前端首个正式版本：登录 / 注册 / 找回密码 / 扫码登录 / OAuth 2.1 授权页（`authorize` / `consent`）+ 多主题多设备版式 + 中英文国际化
