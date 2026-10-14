# OAuth Web · 企业统一身份认证前端（OAuth 2.1 登录 / 授权）

[English](README.en.md) | **简体中文**

企业统一身份认证（SSO）体系的**纯前端部分**：登录、注册、找回密码、扫码登录、OAuth 2.1
应用授权页（authorize / consent）一整套页面，外加多主题、多设备版式、中英文国际化与深色模式。
后端账号与授权服务在另一个仓库 [CoreFlow（nodeservers）](https://github.com/yijiu2025/CoreFlow)。

**它解决什么问题**：子应用（retroweb / posecraft / firewall …）不各自建登录页，统一把用户送到
这里登录、授权，拿回 OAuth 2.1 授权码。本仓库既可以作为授权中心独立部署，也可以被其他应用
以 iframe 方式嵌入（`/mini-login` 快捷登录）。

> 技术栈：Vue 3.5（Composition API）+ TypeScript 6 + Vite 8（Rolldown + Oxc）+ Pinia 3 + Vue Router 5
> + vue-i18n 11 + Tailwind CSS 3.4 + SCSS + VeeValidate 4 + Zod 3 + axios + Vitest 4
> 端口：**5174**（`strictPort`，`/api` 代理到后端 `localhost:3000`）
> 许可：[GPL-3.0](LICENSE)

## 能力一览

| 能力 | 说明 |
| --- | --- |
| 账号密码登录 | 登录 / 注册 / 邮箱验证码 / 找回密码 / 重置密码全流程 |
| 扫码登录 | 后端发二维码 token，前端轮询状态，扫码后自动登录 |
| OAuth 2.1 授权 | `/authorize` 授权页 + `/consent` 授权确认页，支持授权码 + PKCE 流程 |
| iframe 嵌入登录 | `/mini-login` 紧凑版路由，供宿主应用弹窗嵌入；父 origin 白名单校验后才 `postMessage` |
| 多设备版式 | web（桌面）/ app（移动端）/ tablet / mini 四套版式，URL 不被视口改写 |
| 多主题 | 主题包 × 设备 × 配色三段正交，深 / 浅色一键切换，首屏无白闪 |
| 国际化 | vue-i18n，简体中文（`zh_cn`）为默认语言，英文（`en`）兜底 |
| 请求安全 | H5 签名（appKey + timestamp + nonce + url + body 的 SHA-256），弱防爬 |
| 表单校验 | VeeValidate + Zod 声明式 schema，前后端同规则 |

## 快速索引

| 想做的事 | 看哪节 |
| --- | --- |
| 把它跑起来 | [一、跑起来](#一跑起来) |
| 看代码该从哪读起 | [二、目录结构](#二目录结构) |
| 页面和路由都有哪些 | [三、页面与路由](#三页面与路由) |
| 跟后端联调（接口 / 签名 / SSO） | [四、与后端联调](#四与后端联调) |
| 主题 / 版式 / 多语言怎么扩 | [五、主题版式与多语言](#五主题版式与多语言) |
| 动手前先看约束 | [六、已知约束](#六已知约束) |

---

## 一、跑起来

前置依赖：Node.js 18+（建议 20+）、npm 9+。后端服务（CoreFlow）另行启动，见
[四、与后端联调](#四与后端联调)。

```bash
git clone https://github.com/yijiu2025/oauth-web.git
cd oauth-web
npm install
npm run dev            # http://localhost:5174
```

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（端口 5174，`strictPort` 被占直接报错，不静默换端口） |
| `npm run build` | 先 `vue-tsc -b` 类型检查，再 `vite build` 产物构建 |
| `npm run preview` | 本地预览构建产物 |
| `npm test` | Vitest 跑单元测试（`__tests__/` 与 `e2e/`） |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run type-check` | 仅类型检查（`vue-tsc -b`） |

### 环境变量

复制 `.env.example` 为 `.env`（开发环境默认读 `.env.development`，两者都不要提交真实密钥）：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 后端 API 基地址；开发环境由 vite proxy 转发 `/api` | `http://localhost:3000` |
| `VITE_APP_TITLE` | 页面标题 | `Enterprise Identity System` |
| `VITE_RECAPTCHA_ENABLED` | 是否启用人机验证（与后端 `RECAPTCHA_ENABLED` 对应） | `false` |
| `VITE_RECAPTCHA_SITE_KEY` | hCaptcha site key（site key 本就公开） | — |
| `VITE_PASSWORD_RESET_MODE` | 密码重置方式：`code` 验证码 / `link` 邮件链接 | `code` |
| `VITE_ALLOWED_PARENT_ORIGINS` | iframe 父应用 origin 白名单，逗号分隔 | 本地开发用的一组 origin |
| `VITE_SIGN_APP_KEY` | H5 签名 appKey（前后端共享；弱防爬，敏感操作仍靠登录态 + 权限） | — |
| `VITE_SOCIAL_ENDPOINT` | 第三方登录授权端点，**只接受站内相对路径**（刻意不支持绝对地址） | 空 |
| `VITE_SOCIAL_PROVIDERS` | 默认展示的第三方 provider，逗号分隔（`wechat,alipay,qq,weibo,github,apple`） | 空 |

## 二、目录结构

```text
oauth-web/
├── src/
│   ├── api/             # 接口请求层（auth.ts：登录 / 授权 / 扫码 / 验证码）
│   ├── assets/          # 静态资源（图标 / 全局样式）
│   ├── components/      # 业务组件 + ui 原子组件（SvgIcon 等）
│   ├── composables/     # 组合式函数（useAuth / useTheme …）
│   ├── i18n/            # 国际化（zh_cn 默认 / en 兜底）
│   ├── layouts/         # 布局组件
│   ├── router/          # 路由与守卫（页面路由由注册表自动生成）
│   ├── stores/          # Pinia 状态模块
│   ├── theme/           # 主题体系：包 × 设备 × 配色三段正交
│   ├── types/           # 全局 TypeScript 类型
│   ├── utils/           # 通用工具（request 封装 / 校验 / 存储）
│   └── view/            # 页面：web 桌面 / app 移动 / tablet 平板三套版式
├── config/aliases.ts    # 路径别名单一来源
├── __tests__/           # 单元测试（Vitest）
├── e2e/                 # 端到端测试
├── public/              # 原样拷贝的静态资源
└── vite.config.ts       # Vite 配置（proxy / 别名 / 自动导入 / SVG 雪碧图）
```

读代码建议顺序：`main.ts`（入口）→ `router/routes.ts`（路由怎么生成）→
`view/web/login/index.vue`（分发器）→ `theme/README.md`（主题体系总说明）。

## 三、页面与路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 登录 | 账号密码 + 扫码登录；`?from=mini` 进入紧凑形态 |
| `/m/login` | 登录（移动端） | 与 `/login` 共用分发器，窄视口渲染手机版式，**URL 不被视口改写** |
| `/mini-login` | 快捷登录 | 供宿主应用 iframe 嵌入的紧凑独立路由 |
| `/register` | 注册 | 邮箱验证码注册 |
| `/forgot-password` | 找回密码 | 验证码 / 邮件链接两种模式（`/reset-password?token=` 会重定向到这里并透传 query） |
| `/authorize` | 应用授权 | OAuth 2.1 授权码 + PKCE 流程入口 |
| `/consent` | 授权确认 | 授权确认页（authorize 流带 `session_id`，login 流带 `consent_key`） |

路由由页面注册表（`theme/views/pages.ts`）**自动生成**：新增页面 = 写契约文件 + 分发器目录 +
主题目录，不用手改路由表。

## 四、与后端联调

本仓库是纯前端，所有账号 / 授权能力来自后端
[CoreFlow（nodeservers）](https://github.com/yijiu2025/CoreFlow)。本地联调：

1. 后端跑在 `localhost:3000`（Fastify + Sequelize + Redis），先执行数据库迁移；
2. 本仓库 `npm run dev`，`/api` 与 `/oauth2.1` 由 vite proxy 转发到后端；
3. 前端 `.env` 的 `VITE_SIGN_APP_KEY` 必须与后端 `.env` 的 `SIGN_APP_KEY` 一致，否则 H5 签名校验失败；
4. 前端 `VITE_RECAPTCHA_ENABLED` 与后端 `RECAPTCHA_ENABLED`、`VITE_PASSWORD_RESET_MODE` 与后端
   `PASSWORD_RESET_MODE` 需分别对应。

前端主要调用（`src/api/auth.ts`）：

| 端点 | 用途 |
| --- | --- |
| `POST /oauth2.1/login` | 账号密码登录 |
| `POST /oauth2.1/login/consent/confirm` | 授权确认 |
| `POST /oauth2.1/login/verify-email` | 邮箱验证码校验 |
| `GET /oauth2.1/authorize` | 获取授权页信息 |
| `POST /oauth2.1/authorize/consent` | 提交授权 |
| `GET /oauth2.1/qr/generate` | 生成扫码登录二维码 |
| `GET /oauth2.1/qr/status` | 轮询扫码状态 |

### iframe SSO（被其他应用嵌入）

宿主应用（retroweb / posecraft / firewall 同款模式）以 iframe 打开 `/mini-login`：

- 宿主与本应用做 **origin + source 双校验** 的 `postMessage` 握手（`SSO_READY` / 主题同步）；
- 只有父 origin 命中 `VITE_ALLOWED_PARENT_ORIGINS` 白名单才发消息——漏配的症状是宿主弹窗
  「正在加载安全登录」等满 3 秒兜底超时；
- 弹窗宽高按 iframe 内口 1:1 设置。

## 五、主题 / 版式与多语言

- **主题三段正交**：token 基线 → 皮肤包 → 版式，三者独立组合；目录名即 id，注册表自动发现；
- **设备平级**：`mobile | standard | mini | tablet`，mini 是独立设备维度（不是 mobile 的缩写）；
- **URL 参数**：`?theme=` / `?skin=` 设备无关；`?view=<page>` 覆盖版式声明，非法值不回退；
- **深色模式**：`index.html` 内联预置主题，首屏无白闪；
- **国际化**：`src/i18n/index.ts`，默认 `zh_cn`，`en` 兜底；新增语言加一个 messages 对象即可。

## 六、已知约束

- **强依赖后端**：没有 CoreFlow 后端时，登录 / 授权 / 扫码全部不可用（页面能打开，接口会失败）；
- **端口写死 5174**：`strictPort`，被占用会直接启动失败——这是故意的，避免手机调试连错端口；
- **`.env` 不入库**：只提交 `.env.example` 与 `.env.development`，真实密钥一律走部署环境变量；
- **H5 签名是弱防爬**：前端代码可被反编译，appKey 拿得到，真正的安全边界在后端登录态 + 权限校验；
- **第三方登录端点只认站内相对路径**：端点一旦能由外部指定，"把用户送去任意外域"就从漏洞变成配置问题。

## 开源协议

[GNU General Public License v3.0](LICENSE)。与后端 CoreFlow 保持一致：你可以自由使用、修改和
再分发本代码，但衍生作品必须以相同协议开源。
