# 注册与找回密码

注册、找回密码、重置密码三条链路，都依赖邮箱验证码 + RSA 加密密码。

## 一、注册

路由 `/register`。表单校验用 VeeValidate + Zod 声明式 schema（`view/web/register/` 内）。

注册请求字段对齐后端 `POST /user/v1/register`（`RegisterPayload` 契约）：

| 字段 | 说明 |
| --- | --- |
| `username` / `email` / `code` | 表单必填（邮箱验证码） |
| `password` | RSA 加密后的密文（`kid` 标明用哪把公钥） |
| `captchaKey` | 图形验证码 key（先过图形码才发邮箱码） |
| `agreementVersion` | 协议版本快照（`useAgreementVersion`） |
| `invite` / `appName` | 仅 Mini/Standard 版式透传，app 容器不传 |
| `recaptchaToken` | 仅启用 reCAPTCHA 时存在 |

流程：

1. 图形验证码（`getCaptcha` → `verifyCaptcha`，可顺带同步发送邮箱码）；
2. 发送邮箱验证码（`sendEmailCode`）；
3. 校验昵称 / 邮箱是否重复（`checkNickname` / `checkEmail`）；
4. RSA 加密密码后提交注册（`register`）。

## 二、找回密码（两种模式）

`VITE_PASSWORD_RESET_MODE` 控制模式，须与后端一致：

### `code` 模式（验证码重置）

1. 输入邮箱 + 图形验证码 → `sendResetLink` 前先 `verifyCaptcha`；
2. 输入邮箱验证码；
3. `resetPassword(email, code, encryptedPassword, captchaKey, kid)` —— 密码 RSA 加密，`captchaKey`
   在后端绑 sessionId + 指纹，防验证码被挪作他用。

### `link` 模式（邮件链接重置）

1. `sendResetLink(email, captchaKey)` 发重置链接到邮箱（需先过图形码）；
2. 邮件里的链接指向 `/reset-password?token=…`；
3. 前端路由做**兼容重定向**：`/reset-password` → `/forgot-password`，query 原样透传（token 丢了
   整条流程就废了）；
4. `resetPasswordByLink(token, encryptedPassword, kid)` 提交新密码。

::: tip 为什么保留 /reset-password 重定向
后端 `send-reset-link` 拼的链接是 `/reset-password?token=…`，而前端页面是 `/forgot-password`。
保留这条重定向是**不改后端**（在途邮件旧链接继续有效），query 原样透传。
:::

## 三、共用能力

三条链路共用：

- **RSA 加密**：`utils/crypto.ts`，公钥双层缓存（localStorage 持久 + 内存），解密失败自动清缓存重试；
- **密码强度**：`usePasswordStrength.ts`；
- **图形验证码**：`useCaptcha.ts` / `useCaptchaFlow.ts`；
- **协议勾选**：`useAgreementVersion.ts` 记录协议版本快照（服务协议 + 隐私政策版本号 + 接受时间）。

## 相关接口（`api/auth.ts`）

| 方法 | 端点 | 用途 |
| --- | --- | --- |
| `sendEmailCode` | `POST /user/v1/send-email-code` | 发送邮箱验证码 |
| `checkNickname` | `GET /user/v1/check-nickname` | 昵称查重 |
| `checkEmail` | `GET /user/v1/check-email` | 邮箱查重 |
| `register` | `POST /user/v1/register` | 注册 |
| `resetPassword` | `POST /user/v1/reset-password` | 验证码重置密码 |
| `sendResetLink` | `POST /user/v1/send-reset-link` | 发重置链接 |
| `resetPasswordByLink` | `POST /user/v1/reset-password-by-link` | 链接重置密码 |
