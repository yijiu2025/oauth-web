# 快速上手

从零把这个登录前端跑起来。后端服务（CoreFlow）另行启动，见 [与后端联调](#与后端联调)。

## 1. 环境要求

- Node.js 20+、npm 10+（`engines` 硬口径，见 `package.json`）。

## 2. 安装与启动

```bash
git clone https://github.com/yijiu2025/oauth-web.git
cd oauth-web
npm install
npm run dev            # http://localhost:5174
```

端口 **5174** 是 `strictPort`：被占用会直接报错，不静默换端口——这是刻意的，避免手机调试连错端口。

### 关于 `skinsuite` / `stable-deviceid` 两个依赖

本仓的主题内核（`skinsuite`）与设备 ID 工具（`stable-deviceid`）按上级目录是否存在
`packages/` 自动切换两种运行形态（`config/aliases.ts` 条件注册）：

- **单仓使用**（clone 方式，也是 CI / 开源用户的形态）：两个包走 `node_modules` 里的 npm 发布版，
  `npm install` 装完即用；
- **monorepo 协作**（CoreFlow 主仓库内）：上级有 `packages/` 时 alias 自动指向包源码（源码直供）。

## 3. 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（端口 5174，`strictPort` 被占直接报错） |
| `npm run build` | 先 `vue-tsc -b` 类型检查，再 `vite build` 产物构建 |
| `npm run preview` | 本地预览构建产物 |
| `npm test` | Vitest 跑单元测试（`__tests__/`） |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run type-check` | 仅类型检查（`vue-tsc -b`） |
| `npm run docs:dev` / `docs:build` | 本文档站（VitePress）开发 / 构建 |

## 4. 环境变量

复制 `.env.example` 为 `.env` 起步。四个 env 文件的**变量顺序完全一致**，按环境叠加取值：

| 文件 | 角色 | 入库 |
| --- | --- | --- |
| `.env` | 本地基础配置（本机默认值） | 否（`.gitignore`） |
| `.env.development` | `npm run dev` 时覆盖 `.env` | 是 |
| `.env.production` | `npm run build` 时覆盖 `.env`（只放默认值/占位符） | 是 |
| `.env.example` | 脱敏模板 | 是 |

每个文件内的注释就是完整解释（含漏配症状与安全边界）；用不到的变量留空即"不启用"，不要删行。

登录 / 授权相关的关键变量：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 后端 API 基地址；开发由 vite proxy 转发 `/api` | 代码内兜底 `http://localhost:3000` |
| `VITE_SIGN_APP_KEY` | H5 签名 appKey（前后端共享；弱防爬） | — |
| `VITE_RECAPTCHA_ENABLED` | 启用人机验证 hCaptcha | `false` |
| `VITE_TURNSTILE_ENABLED` | 启用 Cloudflare Turnstile | `false` |
| `VITE_PASSWORD_RESET_MODE` | 密码重置方式：`code` 验证码 / `link` 邮件链接 | `code` |
| `VITE_ALLOWED_PARENT_ORIGINS` | iframe 父应用 origin 白名单，逗号分隔 | 本地开发用 origin |
| `VITE_SOCIAL_ENDPOINT` / `VITE_SOCIAL_PROVIDERS` | 第三方登录端点 / 默认 provider | 空 |

主题相关变量（`VITE_THEME_DIR`、`VITE_THEME_ENDPOINT`）见 skinsuite 文档站。

## 5. 与后端联调

本仓库是纯前端，所有账号 / 授权能力来自后端 [CoreFlow](https://github.com/yijiu2025/CoreFlow)：

1. 后端跑在 `localhost:3000`（Fastify + Sequelize + Redis），先执行数据库迁移；
2. 本仓库 `npm run dev`，`/api` 与 `/oauth2.1` 由 vite proxy 转发到后端；
3. 前端 `.env` 的 `VITE_SIGN_APP_KEY` 必须与后端 `.env` 的 `SIGN_APP_KEY` 一致，否则 H5 签名校验失败；
4. `VITE_RECAPTCHA_ENABLED` 与后端 `RECAPTCHA_ENABLED`、`VITE_PASSWORD_RESET_MODE` 与后端
   `PASSWORD_RESET_MODE` 需分别对应。

::: warning 强依赖后端
没有 CoreFlow 后端时，登录 / 授权 / 扫码全部不可用（页面能打开，接口会失败）。
:::

## 6. CI 与验证

推送到 `main` 或开 PR 时，GitHub Actions 自动跑「类型检查 → ESLint → Vitest → 生产构建 → 静态关卡」
（`.github/workflows/ci.yml`）。需要 dev server 的关卡组刻意不进 CI（起服务易 flake），本地
`node e2e/verify-all.mjs` 全量跑。
