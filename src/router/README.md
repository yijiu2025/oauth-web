# 路由系统

## 文件结构

```
src/router/
  index.ts        装配：createRouter + 路由树 + 守卫 + document.title 写入
  routes.ts       路由表：各路由组的**固定声明**（「路由 → 页面」是前端事实）
  guard.ts        认证守卫：requiresAuth 路由的登录拦截 + 开放重定向防护
  auth-checker.ts 认证状态检查（sid cookie）
```

## 路由分组

`routes.ts` 导出四组路由，`index.ts` 统一挂到 `BlankLayout` 下：

| 导出 | 语义 | 包含 |
|------|------|------|
| `authRoutes` | 认证页 | `/<page>`（login / register / forgot-password）+ `reset-password` 重定向 + `mini-login` |
| `mobileRoutes` | 移动端页 | `/m/<page>`（与桌面共用分发器，标题取移动端文案） |
| `authFlowRoutes` | OAuth 授权流 | `authorize` / `consent`（需登录） |
| `errorRoutes` | 错误页 | 404 兜底 |

## 加一个页面 = 改三处

1. `routes.ts` 的 `PAGE_DEFS` 加一条（`path` / `name` / `title` / `mobileTitle`）；
2. `theme/views/<page>.ts` 写契约（`defineThemePage({ page })`）；
3. `view/web/<page>/index.vue` 写分发器（窄/宽屏自适应）。

`/<page>` 与 `/m/<page>` 共用同一套分发器，URL 不被视口改写。

## 认证守卫

守卫只认一个字段：`meta.requiresAuth === true` 表示「未登录跳登录页」，其余路由一律放行。

```ts
// routes.ts 中标记需要登录的路由
{ path: 'authorize', component: ..., meta: { title: '应用授权', requiresAuth: true } }
```

未登录时按设备形态跳登录页（手机进 `/m/login`），并把原 `fullPath` 作为 `redirect`
透传（登录后回跳），同时透传原 query（`client_id` / `redirect_uri` 等，登录页依赖它们）。

## 安全

- **开放重定向防护**：所有回跳经 `sanitizeRedirect`（`@/utils/redirect` 的白名单）校验，只放行站内路径。
- **404 监控**：`errorRoutes` 的 `beforeEnter` 上报未匹配路径，便于发现死链 / 扫描探测。
