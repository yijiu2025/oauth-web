# 请求安全（H5 签名）

前端所有认证接口都带 H5 签名头，弱防爬（防接口被简单灌水 / 篡改 query）。

## 一、签名算法

```
sign = sha256(`${appKey}&${timestamp}&${nonce}&${urlPath}&${paramsStr}&${bodyStr}`)
```

- `appKey`：前后端共享的密钥，前端 `.env` 的 `VITE_SIGN_APP_KEY` = 后端 `.env` 的 `SIGN_APP_KEY`；
- `timestamp`：时间戳；
- `nonce`：随机串（防重放）；
- `urlPath`：请求路径（不含 query）；
- `paramsStr`：params 序列化串（按 key 字典序排序，见 `serializeParamsForSign`）；
- `bodyStr`：body JSON 串。

前端计算 sign 注入 `X-Sign` / `X-Timestamp` / `X-Nonce` 头 + query，后端用同一 appKey 重算验签。

还有双因子变体（`generateSignWithKey`）：额外拼上 `sessionKey`（h5TokenMd5，后端下发 cookie），
用于有会话密钥的场景。

## 二、实现位置

| 文件 | 职责 |
| --- | --- |
| `utils/sign.ts` | `generateSign` / `generateSignWithKey` / `serializeParamsForSign` |
| `utils/request.ts` | axios 拦截器，自动注入签名头 |

`serializeParamsForSign` 与后端 `signature.js` 的 `serializeQueryForSign` **必须完全一致**（key 字典序、
`encodeURIComponent`、`&` 连接）。只支持扁平 key-value，数组 / 嵌套对象不保证一致。

## 三、安全边界

::: warning 这是弱防爬，不是防伪造
`appKey` 在前端是公开的（代码可反编译）。本机制只防「接口被简单灌水 / 篡改 query」，真正的安全
边界在**后端登录态 + 权限校验**。敏感操作不要指望前端签名。
:::

与旧 `h5TokenMd5`（后端下发 cookie）的区别：不依赖 cookie，跨域 iframe 场景更稳；但密钥固定不变，
安全性不增反降，仅作防爬用。

## 四、RSA 加密（真正的敏感字段保护）

密码等敏感字段不靠签名，靠 **RSA-OAEP 加密**（`utils/crypto.ts`，Web Crypto API）：

- 后端公钥（JWK）有 **localStorage 持久 + 内存**双层缓存；
- 加密结果随 `kid`（公钥 id）回传，后端据此选私钥解密；
- 解密失败 / `kid` 不匹配 → 清两层缓存，下次自动重新获取；
- 登录 `authApi.login` 内，解密失败自动清缓存重试一次（应对服务器重启密钥轮换）。

## 五、稳定设备 ID

`stable-deviceid`（独立包）生成稳定设备 ID，跨 origin 归一同一物理设备身份。用于：

- 风险人机验证的 `x-device-id` 头（与后端 `verified:${userId}:${deviceId}` 标记一致）；
- `LOGIN_SUCCESS` 消息里的权威 `deviceId`（父窗口采纳后做登录基准指纹）。
