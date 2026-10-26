# 扫码登录

PC 端展示二维码，移动端扫码确认后 PC 自动登录。后端发 token、前端轮询状态。

## 一、生成二维码

PC 端登录页 `onMounted` 里，有 app 上下文（`hasAppName`）时自动生成：

```ts
// api/auth.ts
const { qrContent } = await authApi.generateQR({ client_id });   // GET /oauth2.1/qr/generate
```

- `client_id` / `scope` 存入二维码，移动端扫描时能识别「给哪个应用登录」；
- 后端返回 `qrContent`（二维码内容，含 client_id），前端用 `qrcode` 包生成图片。

## 二、轮询状态

```ts
// api/auth.ts
const res = await authApi.checkQRStatus(qrKey);   // GET /oauth2.1/qr/status
```

- **只传 `qrKey`**：`client_id` 从存储取（防 PC 端调包）；
- 轮询周期约 2s（`useQrLogin` 内控制）；
- `confirmed` 时后端返回 token 响应（`access_token` / `session_token` 等）。

## 三、扫码后的分支

移动端扫码确认后，PC 轮询拿到 `confirmed`，处理方式与账号密码登录一致（`finishLogin`）：

- iframe 场景 → `postToParent` 递 token 给父窗口；
- 全屏直连 → `?redirect=` 回跳。

## 四、相关实现

| 文件 | 职责 |
| --- | --- |
| `composables/useQrLogin.ts` | 二维码生命周期 + 轮询状态机 |
| `api/auth.ts` 的 `generateQR` / `checkQRStatus` | 生成 / 轮询接口 |
| `view/web/login/StandardLogin.vue` / `MiniLogin.vue` | 二维码展示与入口 |

::: tip 关于首屏体积
`useQrLogin`（含 `qrcode` 约 9.1 KB gz）在首屏静态图内——分析后判定**不动**：登录页
`onMounted` 里 `hasAppName → generateQR()` 自动生成，动态 import 只会把加载推迟到挂载后几毫秒
并多一层瀑布，总流量不变，属负优化。详见 [性能调优](/engineering/performance)。
:::
