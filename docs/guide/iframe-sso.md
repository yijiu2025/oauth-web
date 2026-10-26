# iframe SSO 嵌入

宿主应用（retroweb / posecraft / firewall 同款模式）以 iframe 打开 `/mini-login`，登录成功后通过
`postMessage` 把 token 递回父窗口。这是本仓库「被嵌入」形态的完整契约。

## 一、入口

`/mini-login` 是 login 的「紧凑版」独立路由（mini 设备）。只有 login 有这条独立入口；
register / forgot-password 的 mini 形态由分发器按 `?from=mini` 判定，不单开路由。

宿主侧弹窗宽高按 iframe 内口 1:1 设置。

## 二、握手与消息协议

iframe 内 oauth-web 与父应用做 **origin + source 双校验**的 `postMessage` 握手。关键消息：

| 类型 | 方向 | 含义 |
| --- | --- | --- |
| `SSO_READY` | iframe → 父 | 握手就绪（含主题同步） |
| `LOGIN_SUCCESS` | iframe → 父 | 登录成功，带 `token` / `sessionToken` / `user` / `deviceId` |
| `MAX_SESSIONS` | iframe → 父 | 设备数超限，带 `sessions` / `maxSessions` |
| `SSO_DENIED` | iframe → 父 | 用户拒绝授权，带 `error: 'user_denied'` |

登录成功消息兼容 JWT 与 Session 两种模式：

```ts
postToParent({
  type: 'LOGIN_SUCCESS',
  token,            // accessToken（JWT 模式）
  sessionToken,     // session_token（Session 模式）
  user: { id, username, name, email, avatar },
  deviceId          // 权威设备 ID（stable-deviceid），跨 origin 归一身份
});
```

## 三、父 origin 白名单（安全边界）

`postToParent` 只向**白名单内的父 origin**发消息——防止 oauth-web iframe 被恶意页面嵌入后
`postMessage('*')` 泄露 sessionToken：

```ts
// utils/parent.ts
function postToParent(payload) {
  if (!(window.parent && window.parent !== window)) return;
  const origin = getParentOrigin();          // ancestorOrigins 不可被父页面伪造
  if (!isAllowedParentOrigin(origin)) {
    console.warn('[SSO] 拒绝 postMessage：父 origin 未授权', origin);
    return;
  }
  window.parent.postMessage(payload, origin);
}
```

白名单来自 `.env` 的 `VITE_ALLOWED_PARENT_ORIGINS`（逗号分隔）。「取父 origin」与白名单判断
收敛在 `utils/parent-origins.ts`（单一来源，与收消息侧共用）。

::: warning 漏配的症状不是报错
父 origin 没进白名单时，`postToParent` 静默拒绝发送——宿主弹窗收不到 `SSO_READY` 握手，
表现是「正在加载安全登录」**等满 3 秒兜底超时**，而不是报错。排查时先在控制台找
`[SSO] 拒绝 postMessage：父 origin 未授权 <origin>`。
:::

## 四、iframe 内不跳转

`finishLogin` 里，iframe 内**不做** `redirect` 回跳（父窗口按 `LOGIN_SUCCESS` 消息自行处理），
避免打断父应用流程。只有最顶层窗口（全屏直连）才处理 `?redirect=`。

## 相关文件

| 文件 | 职责 |
| --- | --- |
| `utils/parent.ts` | 安全 postMessage 到父窗口 |
| `utils/parent-origins.ts` | 取父 origin + 白名单判断（单一来源） |
| `composables/useLoginFlow.ts` | `notifyParentLoginSuccess` / `finishLogin` |
| `view/web/login/MiniLogin.vue` | 紧凑版登录容器 |
