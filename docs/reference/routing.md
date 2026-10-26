# 路由与页面注册表

路由表是**宿主固定声明**：`router/routes.ts` 里的 `PAGE_DEFS` 定义「路由 → 页面」的固定映射。

## 一、分层原则

- **router 只负责**固定几个主路由入口 + 标题；
- **主题只负责**「给定页面名渲染哪套版式」（容器里 `<ThemeView page="…">`）；
- 两者只通过「页面名字面量」对齐，互不驱动。

## 二、加一个页面 = 改三处

1. `router/routes.ts` 的 `PAGE_DEFS` 加一条（`path` / `name` / `title` / `mobileTitle`）；
2. `theme/views/<page>.ts` 写契约（`defineThemePage({ page })`）；
3. `view/web/<page>/index.vue` 写分发器（窄 / 宽屏自适应）。

## 三、路由清单

| 路由 | name | 说明 |
| --- | --- | --- |
| `/login` | `login` | 安全登录（`/m/login` 共用分发器） |
| `/register` | `register` | 账户注册 |
| `/forgot-password` | `forgot-password` | 忘记密码 |
| `/reset-password` | — | 兼容重定向 → `/forgot-password`（query 透传） |
| `/mini-login` | `MiniLogin` | 紧凑版登录（iframe 嵌入入口） |
| `/authorize` | `Authorize` | 应用授权（`requiresAuth`） |
| `/consent` | `Consent` | 授权确认（`requiresAuth`） |
| `:pathMatch(.*)*` | `NotFound` | 404 兜底 |

`/m/*` 与 `/<page>` 共用同一套分发器：窄视口渲染手机端容器、宽视口渲染桌面卡片，**URL 不被视口改写**。

## 四、路由守卫

`router/guard.ts` / `auth-checker.ts` 负责：

- `requiresAuth` 页面未登录 → 送 `/login?redirect=<原目标>`；
- 登录后经 `sanitizeLocalRedirect` 白名单回跳（防开放重定向）。

## 五、404 上报

404 兜底路由的 `beforeEnter` 用 `reportError` 上报死链 / 扫描探测：

```ts
// 🔴 必须走 reportError（生产 fetch 上报），不能用 console.warn：
//    生产构建 dropConsole 会把 console 删掉，404 监控会静默失效。
void reportError(`[404] ${to.fullPath}`, `referrer=${document.referrer}`);
```
