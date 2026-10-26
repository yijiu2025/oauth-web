# OAuth 2.1 授权

应用授权（authorize / consent）是本仓库的第二个核心：子应用跳转到这里，用户登录后确认授权，
后端签发授权码并 302 回跳。

## 一、两条路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/authorize` | 应用授权 | 授权码 + PKCE 流程入口，`requiresAuth` |
| `/consent` | 授权确认 | 独立全屏可达；authorize 流带 `session_id`，login 流带 `consent_key` |

## 二、授权流（authorize）

1. 子应用重定向到 `/authorize?client_id=…&redirect_uri=…&scope=…`（含 PKCE `code_challenge`）；
2. 前端 `authApi.checkAuthorize(params)` 调 `GET /oauth2.1/authorize`，返回当前 Cookie 登录用户信息：

   ```ts
   // 返回 { action: 'login' | 'consent', client_name, scope, sessionId, user }
   ```

3. 按 `action` 分支：
   - `login` → 未登录，先走登录（登录后经 `?redirect=/authorize` 回跳继续授权）；
   - `consent` → 已登录，展示授权确认页（`Authorize.vue` 渲染 `ConsentPanel.vue`）。

## 三、授权确认（consent）

授权确认面板展示 client 名称、请求的 scope，用户可**同意**或**拒绝**：

```ts
// 同意
await authApi.authorizeConsent({ sessionId, user_id, action: 'approve' });
// 拒绝
await authApi.authorizeConsent({ sessionId, user_id, action: 'deny' });
```

后端签发 `authorization_code` 并 **302 重定向到 redirect_uri**（浏览器直接跳走，前端不处理后续）。

## 四、登录流的 consent 分支

当用户**先登录、再授权**时，登录响应可能直接返回 `action: 'consent'`（见 [登录流程](/guide/login)
的四种分支）。此时前端弹出授权确认面板，走 `confirmConsent(consentKey)`：

```ts
await authApi.confirmConsent(consentKey);   // POST /oauth2.1/login/consent/confirm
```

同意 / 拒绝后的 token 递送与登录成功一致（`finishLogin` → `postToParent` 通知父窗口）。

## 五、iframe 场景的授权

宿主应用以 iframe 嵌入 `/mini-login` 时，登录 → 授权全流程都在 iframe 内完成，最终通过
`postMessage` 把 token 递回父窗口（见 [iframe SSO 嵌入](/guide/iframe-sso)）。拒绝授权时发
`{ type: 'SSO_DENIED', error: 'user_denied' }`。

## 相关接口（`api/auth.ts`）

| 方法 | 端点 | 用途 |
| --- | --- | --- |
| `checkAuthorize` | `GET /oauth2.1/authorize` | 查授权状态（当前 Cookie 登录用户） |
| `authorizeConsent` | `POST /oauth2.1/authorize/consent` | 提交授权确认 / 拒绝 |
| `confirmConsent` | `POST /oauth2.1/login/consent/confirm` | 快捷登录确认授权 |

## 组件

- `view/web/auth/Authorize.vue` — 授权页；
- `view/web/auth/Consent.vue` — 独立授权确认页；
- `components/auth/ConsentPanel.vue` — 授权确认面板（authorize / login 两流共用）。
