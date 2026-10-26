# 目录结构

读代码从 `main.ts` 入口开始，下面按层说明每个目录的职责。

## 顶层结构

```text
oauth-web/
├── src/
│   ├── api/             # 接口请求层（auth.ts：登录 / 授权 / 扫码 / 验证码）
│   ├── assets/          # 静态资源（图标 / 全局样式）
│   ├── components/      # 业务组件 + 原子组件
│   ├── composables/     # 组合式函数（useLoginFlow / useQrLogin …）
│   ├── device/          # 设备机制层（判定 + 容器布线，宿主自己的事实）
│   ├── i18n/            # 国际化（zh_cn 默认 / en 兜底）
│   ├── layouts/         # 布局组件
│   ├── router/          # 路由与守卫（页面路由由注册表自动生成）
│   ├── stores/          # Pinia 状态模块
│   ├── theme/           # 主题资产（接入 skinsuite，机制不在本仓）
│   ├── types/           # 全局 TypeScript 类型（external.ts 收外部边界类型）
│   ├── utils/           # 通用工具（request 封装 / 签名 / 存储）
│   └── view/            # 页面：web 桌面 / app 移动 / tablet 平板三套版式
├── config/aliases.ts    # 路径别名单一来源
├── docs/                # 本文档站（VitePress）
├── scripts/             # 发布脚本（release-web.mjs）
├── __tests__/           # 单元测试（Vitest）
├── e2e/                 # 端到端验证关卡
├── public/              # 原样拷贝的静态资源
└── vite.config.ts       # Vite 配置（proxy / 别名 / 自动导入 / SVG 雪碧图）
```

## 关键模块

### `src/api/auth.ts` — 唯一的接口层

所有认证 / 授权 / 扫码 / 验证码接口都收敛在这里（`authApi` 对象）。API 层只做请求转发，
不含业务逻辑：登录的 nonce / timestamp / RSA 加密在 `utils/crypto.ts` 的
`buildEncryptedLoginPayload` 里组装；scope 不由前端携带（scope 是 app 属性，后端从
`client.scope` 兜底 + 边界校验）。

### `src/composables/` — 组合式函数

| 文件 | 职责 |
| --- | --- |
| `useLoginFlow.ts` | 登录流程：统一封装 directLogin 响应的四种分支（consent / needs_email_verify / max_sessions / 成功） |
| `useQrLogin.ts` | 扫码登录：轮询二维码状态 |
| `useCaptcha.ts` / `useCaptchaFlow.ts` | 图形验证码 |
| `usePasswordStrength.ts` | 密码强度 |
| `useCountdown.ts` | 验证码倒计时 |
| `useSocialLogin.ts` | 第三方登录 |
| `useAgreementVersion.ts` | 协议版本快照 |

### `src/stores/` — 状态

| 文件 | 职责 |
| --- | --- |
| `auth.ts` | 认证状态（登录 / 登出 / 用户信息） |
| `theme.ts` | 主题状态（仅 `defineStore` 壳 + 接入 skinsuite，机制不在本仓） |

### `src/utils/` — 工具

| 文件 | 职责 |
| --- | --- |
| `request.ts` | axios 封装（拦截器：H5 签名、401 重放守卫） |
| `sign.ts` | H5 签名（appKey + timestamp + nonce + url + body 的 SHA-256） |
| `crypto.ts` | RSA-OAEP 加密（Web Crypto API，公钥双层缓存） |
| `parent.ts` / `parent-origins.ts` | 安全 postMessage 到父窗口（origin 白名单） |
| `redirect.ts` | 站内回跳白名单（`sanitizeLocalRedirect` 防开放重定向） |
| `anti-cache.ts` | 反缓存 |

### `src/device/` — 设备机制层（宿主自己的事实）

设备判定、容器布线是**宿主 oauth-web 自己的机制**，不是 skinsuite 的导出。`src/view/devices.ts`
声明设备清单，`device/resolve/` 做组合判定（视口 / URL / iframe 来源规则 → 设备 id）。

### `src/theme/` — 主题资产（接入 skinsuite）

主题包、配色、版式的**目录契约与机制**在 skinsuite 文档站（
[目录约定](https://yijiu2025.github.io/theme/guide/directory.html)）。本仓只放资产（`themes/`、
`views/`、`theme.config.ts`），`stores/theme.ts` 是接入壳。**新增主题包 / 改配色 / 加版式，
去 skinsuite 文档站读规范，不要在本仓重复造轮子。**

## 读代码顺序

`main.ts`（入口）→ `bootstrap.ts`（装配）→ `router/routes.ts`（路由怎么生成）→
`view/web/login/index.vue`（分发器）→ `composables/useLoginFlow.ts`（登录流程）→
`api/auth.ts`（接口）→ `utils/sign.ts`（签名）。
