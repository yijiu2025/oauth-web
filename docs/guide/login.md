# 登录流程

账号密码登录的完整链路，从表单提交到「拿回 token 给父应用」。

## 一、入口与分发

登录页路由 `/login`（移动端 `/m/login` 共用同一分发器）。分发器按宿主设备口径选容器：

- 宽屏 → `StandardLogin.vue`（桌面卡片）
- 窄屏 → app 登录页（`view/app/login/index.vue`）
- `/mini-login` → `MiniLogin.vue`（紧凑版，供 iframe 嵌入）

设备判定归宿主（`device/resolve/`），`?device=` 可锁定设备。**URL 不被视口改写**。

## 二、登录请求

表单提交后，`useLoginFlow.executeLogin()` 组装 payload 调用 `authApi.login`：

```ts
// composables/useLoginFlow.ts
const loginPayload = {
  ...values(),          // username / password / code / type
  keepLogin: keepLogin(),   // 是否「记住我」（控制 sid_r 长登录）
  captchaKey: captchaKey(),
  client_id: clientId()
};
const raw = await authStore.login(loginPayload);
```

`authApi.login` 本身不碰业务字段，只做两件事：

1. **RSA 加密**：`utils/crypto.ts` 的 `rsaEncrypt` 用后端公钥（RSA-OAEP + SHA-256）加密表单，
   连同 `nonce` + `timestamp` 一起发出；公钥有 localStorage + 内存双层缓存，`kid` 回传让后端
   选私钥解密。解密失败（服务器重启密钥轮换）自动清缓存重试一次。
2. **签名**：`utils/request.ts` 拦截器自动注入 H5 签名头（见 [请求安全](/reference/sign)）。

::: tip scope 不由前端携带
scope 是 app 属性（`oauth_clients` 表已存），后端 directLogin 从 `client.scope` 兜底 + 做边界校验。
前端写死 scope 既冗余又不安全（可篡改）。
:::

## 三、响应的四种分支

登录响应**不 `as any` 读字段**：经 `types/external.ts` 的 `parseLoginResponse` 做 zod 判别联合校验，
按 `kind` 分支消费。后端改字段 → 落到 `kind: 'unknown'` → 明确报错，而非静默传空值。

| 分支 | 含义 | 前端动作 |
| --- | --- | --- |
| `success` | 登录成功 | `finishLogin`：通知父窗口 + 全屏直连回跳 |
| `action: consent` | 需授权确认 | 弹授权确认面板（`useLoginFlow.consentState`） |
| `action: needs_email_verify` | 环境异常需二次验证 | 弹邮箱验证码输入框 + 60s 倒计时 |
| `action: max_sessions` | 设备数超限 | 通知父窗口（iframe 内） |

## 四、登录成功收尾 `finishLogin`

三条成功路径（登录成功 / 同意授权 / 邮箱二次验证通过）**共用**同一个 `finishLogin`：

1. **通知父窗口**（iframe 场景）：`postToParent({ type: 'LOGIN_SUCCESS', token, sessionToken, user, deviceId })`，
   兼容 JWT（`accessToken`）与 Session（`session_token`）两种模式；`deviceId` 是权威设备 ID
   （`stable-deviceid`），父窗口采纳后同一物理设备跨 origin 归一为同一身份。
2. **全屏直连回跳**：仅最顶层窗口生效；`?redirect=` 经 `sanitizeLocalRedirect` 白名单校验后
   `location.replace`（`replace` 而非 `assign`，登录页不留历史）。

::: tip 为什么要有统一的 finishLogin
历史上三条成功路径各自为政，没有任何一条处理 `redirect`，导致「守卫把未登录访问者送去
`/login?redirect=/authorize`，登录后再没人送回来」。统一收尾后，这条回跳链路才闭环。
:::

## 五、邮箱二次验证

登录环境异常时后端返回 `needs_email_verify`，前端弹出邮箱验证码输入框：

- `authApi.sendLoginVerifyCode(verifyToken)` 重发（凭 verifyToken，不需图形码，60s 倒计时）；
- `authApi.verifyEmailLogin(verifyToken, code)` 提交，通过后同样走 `finishLogin`。

## 六、风险人机验证

请求被后端 `__risk__` 拦截时，前端带 `verifyToken` 调 `authApi.verifyChallenge` 通过人机验证，
通过后 30 分钟免验；可叠加图形验证码更严格。

## 相关 composables

- `useLoginFlow.ts` — 上述分支处理的主逻辑；
- `useCaptcha.ts` / `useCaptchaFlow.ts` — 图形验证码；
- `usePasswordStrength.ts` — 密码强度（注册 / 重置共用）；
- `useCountdown.ts` — 验证码倒计时；
- `useButtonLock.ts` — 防重复提交锁。
