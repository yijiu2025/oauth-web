# 部署流程（全流程）

> 本文覆盖 oauth-web 从「源码」到「线上可访问」的完整部署链路：环境准备 → 配置 → 构建 →
> 静态托管 / Docker / CDN → 后端对齐 → 验证 → CI/CD → 回滚 → 排障。
> 每一条命令、端口、文件名都以本仓实际代码为准，踩坑点标 🔴。

## 〇、一句话概览

oauth-web 是**纯静态前端**：`npm run build` 产出 `dist/` 目录，把 `dist/` 交给任意静态托管
（Nginx / CDN / 对象存储 / Docker Nginx）即可上线。**没有服务端运行时**，账号与授权能力全部
来自后端（CoreFlow / nodeServers），前端只通过 `VITE_API_BASE_URL` 指向它。

```
浏览器
  │  ① 加载静态页面（index.html + assets/*.js + assets/*.css）
  ▼
静态托管（Nginx / CDN / Docker Nginx）
  │  ② /oauth2.1/* /user/v1/* /verify/v1/* /auth/v1/* ...
  ▼
后端 CoreFlow（Fastify，默认 :3000）
```

🔴 **最关键的一条**：所有 `VITE_*` 环境变量都是**构建期**注入的（Vite 编译时把
`import.meta.env.VITE_XXX` 替换成字面量）。也就是说：

- 部署时**改运行时环境变量没用**，必须在 `npm run build` 之前把变量给到构建进程；
- 换个后端地址 / 换套主题配色 = **重新构建一次**，不是改服务器配置。

---

## 一、部署前准备

### 1.1 环境要求

| 项 | 要求 | 来源 |
| --- | --- | --- |
| Node.js | `>= 22.6` | `package.json` 的 `engines.node` |
| npm | `>= 10` | `package.json` 的 `engines.npm` |
| 磁盘 / 内存 | 无特殊要求（构建峰值内存约数百 MB） | — |

### 1.2 获取源码

```bash
git clone https://github.com/yijiu2025/oauth-web.git
cd oauth-web
npm ci            # CI/部署用 npm ci（lock 已入库，可复现）
```

本地日常开发用 `npm install` 亦可；但**部署机 / CI 一律 `npm ci`**（可复现、不会漂版本）。

### 1.3 依赖形态（重要，决定装完能不能跑）

`skinsuite`（主题内核）与 `stable-deviceid`（设备 ID）按「上级目录有没有 `packages/`」自动
切两种形态（`config/aliases.ts` 条件注册）：

| 形态 | 触发条件 | 依赖来源 |
| --- | --- | --- |
| **单仓形态**（部署 / CI / 开源用户） | 上级没有 `packages/` 目录 | `node_modules` 里的 npm 发布版，`npm ci` 装完即用 |
| **monorepo 形态**（主仓库协作开发） | 上级有 `packages/` | alias 源码直供 `packages/*/src`，改包源码即时生效 |

部署机 clone 出来的必然是单仓形态，无需任何额外配置。

### 1.4 一次性环境自检（可选但推荐）

```bash
npm run doctor        # 检查 node/npm 版本、依赖、env 文件、端口、git 状态
```

退出码 `0` = 无 FAIL；`1` = 有 FAIL（先补环境再继续）。

---

## 二、环境变量配置

### 2.1 四个 env 文件的分工

| 文件 | 角色 | 是否入库 | 生效时机 |
| --- | --- | --- | --- |
| `.env` | 本地基础配置 | ❌ gitignore | 所有模式都读，优先级最低 |
| `.env.development` | dev 覆盖 | ✅ | `npm run dev` 时 |
| `.env.production` | **构建**覆盖（只放默认值/占位符） | ✅ | `npm run build` 时 |
| `.env.production.local` | 本机生产构建的**真实密钥**覆盖 | ❌（匹配 `*.local`） | `npm run build` 时，优先级最高 |

优先级：**shell 环境变量 > `.env.production.local` > `.env.production` > `.env`**。

🔴 **不要把真实密钥写进 `.env.production` 再提交**。它的角色是「默认值/占位符」。
真实的生产配置走下面两条路之一：

- **本机构建**：写 `.env.production.local`（gitignore）；
- **CI / 服务器构建**：在构建步骤里注入 shell 环境变量（见 [九、CI/CD](#九cicd-自动部署)）。

### 2.2 全部 12 个变量逐条说明

> 与 `.env.example` 完全一致（四个 env 文件变量顺序同序同注释，这是有 e2e 关卡守的）。

| 变量 | 默认 | 生产怎么填 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 空 | 🔴 **留空 = 与前端同源**（请求走相对路径，由 Nginx/网关反代到后端，Cookie 无跨域问题）；跨域部署填完整 origin，如 `https://api.example.com`。**dev 未配置才兜底 `http://localhost:3000`，生产不兜底** |
| `VITE_THEME_DIR` | `src/theme` | 一般不动（换主题根目录才改） |
| `VITE_RECAPTCHA_ENABLED` | `false` | 用 hCaptcha 才设 `true` |
| `VITE_RECAPTCHA_SITE_KEY` | 空 | 启用 hCaptcha 时填 site key（site key 本就要下发前端） |
| `VITE_TURNSTILE_ENABLED` | `false` | 用 Cloudflare Turnstile 才设 `true`（与 hCaptcha 二选一，Turnstile 优先） |
| `VITE_TURNSTILE_SITE_KEY` | 空 | 启用 Turnstile 时填 |
| `VITE_PASSWORD_RESET_MODE` | `code` | 🔴 必须与后端 `PASSWORD_RESET_MODE` 一致（`code` 验证码 / `link` 邮件链接） |
| `VITE_SOCIAL_ENDPOINT` | 空 | 第三方登录授权端点，**只接受站内相对路径**（`/` 开头且非 `//`，如 `/api/oauth/social/authorize`）。刻意不支持绝对地址，见 [2.4 第三方登录接入](#24-第三方登录社交登录接入详解) |
| `VITE_SOCIAL_PROVIDERS` | 空 | 默认展示的 provider：`wechat,alipay,qq,weibo,github,apple` 子集，逗号分隔；留空 = 登录页不渲染第三方登录行。见 [2.4](#24-第三方登录社交登录接入详解) |
| `VITE_ALLOWED_PARENT_ORIGINS` | 空（dev 回落 localhost） | 🔴 **生产必填**，iframe SSO 父应用 origin 白名单，逗号分隔。**显式空串 = 拒绝一切**（不回落到 dev 值） |
| `VITE_SIGN_APP_KEY` | 空 | 🔴 必须与后端 `SIGN_APP_KEY` 一致，H5 签名（弱防爬） |
| `VITE_THEME_ENDPOINT` | 空 | 后端主题下发端点（`GET {端点}?client_id=...`），不配 = 机制不生效 |

### 2.3 生产最小必配清单

上线前至少确认这几条（其余按功能启用）：

```bash
# .env.production.local（本机构建）或 CI 构建环境变量（部署构建）
VITE_API_BASE_URL=          # 留空 = 同源反代，或填 https://api.example.com
VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com
VITE_SIGN_APP_KEY=<与后端 SIGN_APP_KEY 相同的值>
VITE_PASSWORD_RESET_MODE=code   # 与后端一致
```

### 2.4 第三方登录（社交登录）接入详解

> 这一节回答「`VITE_SOCIAL_ENDPOINT` 是干啥的」以及「三方登录真实使用怎么处理」。

#### 先说清楚现状：前端目前**没有**第三方登录的后端实现

`src/api/` 里没有任何社交登录端点（微信/支付宝的授权、换取用户信息都在**后端**）。
所以前端这一整套（`useSocialLogin` composable + `MauthSocialRow` 组件）只做**两件事**：

1. 算出「这次要显示哪几个 provider」；
2. 把用户的点击交给真正能处理它的地方——**配置好的授权端点**，或**父应用**。

「没有后端却渲染一排点了没反应的图标，比不显示更糟」是这套设计的出发点。

#### `VITE_SOCIAL_ENDPOINT` 是干啥的

它是**前端点击社交图标后要跳转去的「授权入口」地址**。用户点了微信图标，前端就拼出
`<endpoint>?provider=wechat&client_id=xxx&redirect_uri=<当前页URL>` 然后 `location.href` 跳过去，
剩下「唤起微信授权、换 code、换 token、建 session」全由这个端点（后端）负责。

**为什么刻意不支持绝对地址（`https://…` / `//host/x`）**：

```
VITE_SOCIAL_ENDPOINT=/api/oauth/social/authorize   ✅ 合法（站内相对路径）
VITE_SOCIAL_ENDPOINT=//evil.com/x                  ❌ 拒绝（协议相对 = 外域绝对地址）
VITE_SOCIAL_ENDPOINT=https://evil.com/x            ❌ 拒绝（外域）
VITE_SOCIAL_ENDPOINT=javascript:alert(1)           ❌ 拒绝（不是 / 开头）
```

授权端点是「跳转目标」——一旦能由外部（父应用注入或配置）指定成任意外域，
**「把用户送去任意外域」就从漏洞变成了配置问题**，而配置总会被写错。所以代码里用
`isSafeEndpoint()`（`/` 开头且非 `//`）硬约束，不合法就置空，走「未配置」分支。
真正要跨域接第三方，应该让**后端**那个授权端点（同源）去负责 302 跳转到微信/支付宝，前端始终只跳同源入口。

#### `VITE_SOCIAL_PROVIDERS` 怎么用

它决定登录页**默认渲染哪几个** provider，取值为 `wechat,alipay,qq,weibo,github,apple`
（这是 `SocialProviderId` 封闭联合的全集）的任意子集，逗号分隔：

```
VITE_SOCIAL_PROVIDERS=wechat,qq        # 只显示微信 + QQ
VITE_SOCIAL_PROVIDERS=wechat,alipay,qq,weibo,github,apple   # 全部
VITE_SOCIAL_PROVIDERS=                 # 留空 → 登录页不渲染第三方登录行（默认外观零变化）
```

**provider 列表的优先级（由高到低）**，`useSocialLogin` 按此顺序取值：

| 优先级 | 来源 | 用途 |
| --- | --- | --- |
| 1 | URL `?social=wechat,qq` | 单次会话 / 联调最方便 |
| 2 | 父应用注入 `window.__MAUTH_SOCIAL_PROVIDERS__` | iframe 嵌入方统一下发 |
| 3 | 构建期 `VITE_SOCIAL_PROVIDERS` | 部署默认值 |

三个来源都只做**精确匹配白名单**：`__evil__`、`wx`、`wechat/../x`、空串一律丢弃，
因为 provider id 最终会被拼进跳转 URL，不校验就等于让 URL 决定去哪儿。最多显示 6 个。

同理，授权端点也有父应用注入通道 `window.__MAUTH_SOCIAL_ENDPOINT__`（优先级高于 env），
两者都必须过 `isSafeEndpoint()` 校验。

#### 真实使用时，三方登录的完整链路

前端 + 后端 + 第三方平台三方协作，前端这一环**只负责「把用户带过去 + 记住选择」**：

```
① 用户点微信图标
   └─ 前端 startLogin('wechat')：拼 endpoint?provider=wechat&client_id=..&redirect_uri=..
② 跳转到 VITE_SOCIAL_ENDPOINT（后端同源授权入口）
   └─ 后端校验 client_id / redirect_uri，302 跳到微信开放平台授权页
③ 用户在微信授权页确认
   └─ 微信回调后端，后端换 code → access_token → openid，建 session / 发 token
④ 后端 302 回 redirect_uri（前端登录页，带 lastLogin=wechat 等参数）
   └─ 前端 rememberProvider('wechat')，下次该图标显示「上次登录」徽标
```

**三种「点击后行为」分支**（`startLogin` 的返回值）：

| 分支 | 触发条件 | 行为 |
| --- | --- | --- |
| `redirected` | 配了合法 `VITE_SOCIAL_ENDPOINT` | 直接 `location.href` 跳到授权端点 |
| `notified` | iframe 嵌入且**没配**端点 | `postToParent({ type: 'SOCIAL_LOGIN', ... })` 交给父应用（父应用自己知道跳哪）；父 origin 必须过 `VITE_ALLOWED_PARENT_ORIGINS` 白名单 |
| `unconfigured` | 全屏直连且没配端点 | 明确提示「尚未配置授权地址」，**不静默失败** |

**上线前你需要做的**（前端侧）：

1. 后端先实现同源授权端点（如 `/api/oauth/social/authorize`），处理 `provider` / `client_id` / `redirect_uri` 三个入参；
2. 把该端点路径填进 `VITE_SOCIAL_ENDPOINT`（站内相对路径）；
3. 把要开放的渠道填进 `VITE_SOCIAL_PROVIDERS`；
4. 图标目前是**符号化功能图形**（stroke 风格），不是官方 logo——正式上线需替换成对应平台的**授权素材**（避免品牌合规问题），替换 `<svg>` 节点即可，颜色/尺寸由 `--mauth-social-ink-<id>` / `--mauth-social-size` 控制。

### 2.5 shell 环境变量怎么用（构建期注入）

Vite 的 `VITE_*` 变量是**构建期静态替换**（不是运行期读的）。所以「注入」发生在 `npm run build`
那一刻，shell 里 export 的值会被 Vite 读进去。

#### 优先级（见 2.1）

**shell 环境变量 > `.env.production.local` > `.env.production` > `.env`**。
即：构建时 shell 里 `export VITE_XXX=yyy` 会**覆盖**同名 `.env` 文件里的值。

#### Linux / macOS（bash / zsh）

```bash
# 方式一：临时注入（只对本次构建生效，最干净）
VITE_SIGN_APP_KEY=xxx \
VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com \
VITE_SOCIAL_PROVIDERS=wechat,qq \
npm run build

# 方式二：先 export 再构建
export VITE_SIGN_APP_KEY=xxx
export VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com
npm run build
```

#### Windows（PowerShell / Git Bash）

```powershell
# PowerShell：用 $env: 注入
$env:VITE_SIGN_APP_KEY = "xxx"
$env:VITE_ALLOWED_PARENT_ORIGINS = "https://app.example.com"
npm run build
```

```bash
# Git Bash：与 Linux 一样
VITE_SIGN_APP_KEY=xxx VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com npm run build
```

#### CI（GitHub Actions）里的写法

```yaml
- name: Build
  env:
    VITE_SIGN_APP_KEY: ${{ secrets.SIGN_APP_KEY }}
    VITE_ALLOWED_PARENT_ORIGINS: https://app.example.com
    VITE_SOCIAL_PROVIDERS: wechat,qq
  run: npm run build
```

> ⚠️ 变量名**必须以 `VITE_` 前缀**才会被注入到客户端代码；没有前缀的 shell 变量 Vite 默认忽略
> （除非在 `vite.config.ts` 里显式声明 `envPrefix`）。这一点对所有 12 个变量都成立。

---

## 三、构建

### 3.1 构建命令

```bash
npm run build        # = npm run type-check && vite build
```

- 先 `vue-tsc -b` 做全量类型检查（失败即中断，不会产出半成品）；
- 再 `vite build` 打包到 `dist/`（默认 `sourcemap: false`，不泄露源码）。

### 3.2 产物清单（`dist/`）

| 路径 | 内容 | 说明 |
| --- | --- | --- |
| `index.html` | 入口 HTML（~7KB） | 引用 6 个首屏静态文件 |
| `assets/index-*.js` | 业务入口 chunk（含主题引擎） | 首屏必载 |
| `assets/vue-vendor-*.js` | vue / pinia / vue-router / vue-i18n | 首屏必载 |
| `assets/form-vendor-*.js` | zod / vee-validate / @vee-validate/zod | 首屏必载 |
| `assets/net-vendor-*.js` | axios | 首屏必载 |
| `assets/index-*.css` | 全部样式 | 首屏必载 |
| `assets/theme-*.js` | 主题包/配色的版式 chunk | 按需（非内置包懒加载） |
| `assets/*Login*` `*Register*` 等 | 各页面 / 组件懒加载 chunk | 路由级按需 |
| `sw.js` | 🔴 PWA 自毁迁移脚本 | 清理旧用户已安装的 SW，**必须随部署**，不要删 |
| `favicon.svg` / `icons.svg` | 站点图标 / SVG 雪碧图 | 静态资源 |

首屏体积参考：**约 162.6 KB gzip / 616.5 KB 原始**（6 个文件，有 `verify-bundle-budget` 关卡守
175 KB gz 预算线，`dist/` 总量 ≤ 1024 KB）。

### 3.3 `dist-nopwa`（特殊构建，非部署产物）

```bash
npx vite build --outDir dist-nopwa
```

这是验证关卡「PWA 已移除 / SW 迁移」用的对照产物（检查 `dist-nopwa` 里没有 SW），**不是上线产物**。
正常部署只用 `dist/`。

### 3.4 本地预览（上线前快速验证）

```bash
npm run preview                                      # vite preview，默认 4173
npx vite build --outDir dist-nopwa && \
  npx vite preview --outDir dist-nopwa --port 5189   # 生产验证组的约定端口 5189
```

---

## 四、部署方式

### 方式 A：Nginx 静态托管 + 同源反代（推荐生产方案）

**同源反代**是最稳的：前端页面和 API 在同一个 origin 下，Cookie（Session 鉴权）天然可用，
没有 CORS / `withCredentials` 的坑。

```nginx
server {
    listen 443 ssl http2;
    server_name login.example.com;

    ssl_certificate     /etc/nginx/certs/login.example.com.pem;
    ssl_certificate_key /etc/nginx/certs/login.example.com.key;

    root /srv/oauth-web/dist;
    index index.html;

    # ── 静态资源：带 hash 的 assets 可长缓存 ──
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # ── 后端 API 反代（与前端同源）──
    location ~ ^/(api|oauth2\.1|user/v1|verify/v1|auth/v1|send-code|verify-code) {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 后端下发 Cookie 需要保留
        proxy_cookie_path / /;
    }

    # ── SPA 回退：非文件请求全部回 index.html ──
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";   # index.html 永不缓存，保证发版即时生效
    }

    # 安全头（按需收紧 CSP）
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;      # 若页面本身要被 iframe 嵌入，改为按父域 CSP frame-ancestors
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    # add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://app.example.com" always;
}
```

要点：

- **`try_files ... /index.html`** 是 SPA 必需（`/authorize`、`/m/login` 这些前端路由没有真实文件）；
- **`index.html` 不缓存、`/assets/` 长缓存**：发版后用户立刻拿到新入口，旧 hash 资源自然淘汰；
- 反代路径集合与前端 `src/api/*` 里用到的端点前缀一一对应（见上表）；
- 🔴 **iframe SSO 场景**：如果 oauth-web 要被宿主应用 `iframe` 嵌入，不要给 `X-Frame-Options: DENY`，
  应改用 `Content-Security-Policy: frame-ancestors <父应用 origin>` 精确控制谁能嵌。

### 方式 B：CDN / 对象存储 / 托管平台（Netlify、Vercel、Cloudflare Pages、OSS）

纯静态托管同样可行，但两点必须处理：

1. **SPA 回退**：404 全部回 `index.html`（各平台叫法不同：Netlify `_redirects`、Vercel `rewrites`、
   Cloudflare Pages 自定义 404 规则）；
2. **跨域 Cookie**：若 API 在另一个域名（`VITE_API_BASE_URL=https://api.example.com`），需要
   - 后端 CORS 显式放行前端 origin 且 `credentials: true`；
   - 前端 `axios` 已带 `withCredentials: true`（`utils/request.ts`），无需改；
   - 现代浏览器对跨域 Cookie 要求 `SameSite=None; Secure`，后端须同步配置。
   > 能同源就同源，跨域 Cookie 在 iframe / 隐私模式里是排障重灾区。

### 方式 C：GitHub Pages（仅文档站）

文档站（VitePress）由 `.github/workflows/docs-pages.yml` 自动部署到
`https://yijiu2025.github.io/oauth-web/`（push `docs/**` 变更时触发）。

**登录页面本身不建议放 GitHub Pages**：它是纯静态且固定子路径，无法同源反代后端 API，
只能跨域部署（回到方式 B 的跨域 Cookie 问题）。

### 方式 D：Docker（可选，一条龙构建 + 运行）

本仓**已内置** `Dockerfile`（多阶段构建：`node:22-slim` 构建 + `nginx:1.27-alpine` 托管）、
`nginx.conf`（SPA 回退 + 同源反代）和 `.dockerignore`（排除 node_modules/dist/.env，防密钥进镜像层）。
（根目录 nodeServers 的 Dockerfile 是**后端**的，别跟本仓这份混。）

> 🔴 **Docker 与 lockfile**：本仓 `npm ci` 依赖已入库的 lockfile，但主仓 workspace 形态下根 lock
> 会记录 `link:` 软链（见 memory 里「后端三 job 用 `--no-package-lock`」的坑）。单仓 clone 出来的
> oauth-web 是普通形态，`npm ci` 正常。若你在 monorepo 里构建，注意 `--workspaces=false` 只装本包。

本地构建 + 运行：

```bash
docker build \
  --build-arg VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com \
  --build-arg VITE_SIGN_APP_KEY=xxx \
  --build-arg VITE_SOCIAL_ENDPOINT=/api/oauth/social/authorize \
  --build-arg VITE_SOCIAL_PROVIDERS=wechat,qq \
  -t oauth-web:latest .
docker run -d -p 8080:80 oauth-web:latest
```

> 构建参数（`--build-arg`）会把 `VITE_*` 变量 bake 进镜像；哪些变量各是什么含义见
> [2.2 全部 12 个变量逐条说明](#22-全部-12-个变量逐条说明)。`nginx.conf` 里的后端反代默认指向
> `http://backend:3000`（容器网络里的服务名），单机跑需改 `proxy_pass` 或起个同名 network。

#### 方式 D.1：上传到公共 Docker 库（Docker Hub / GHCR）

**为什么要传公共库**：让服务器 / CI / 协作者直接 `docker pull` 现成镜像，而不是每台机器各自
跑一遍 `npm ci + build`（慢、且构建环境漂移）。

**两个主流目标**：

| 目标 | 地址格式 | 说明 |
| --- | --- | --- |
| Docker Hub | `docker.io/<用户名>/<镜像名>:<tag>` | 最通用，公开仓库可匿名 pull |
| GitHub Container Registry (GHCR) | `ghcr.io/<owner>/<镜像名>:<tag>` | 与 GitHub 生态贴合，支持 OIDC 无密钥推送 |

##### 1) 推到 Docker Hub

```bash
# ① 登录（首次交互式输入账号密码 / token）
docker login
# 或显式指定：
docker login -u <你的DockerHub用户名>

# ② 构建时直接打上目标 tag（含用户名前缀）
docker build \
  --build-arg VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com \
  --build-arg VITE_SIGN_APP_KEY=xxx \
  -t <用户名>/oauth-web:1.0.0 \
  -t <用户名>/oauth-web:latest \
  .

# ③ 推送
docker push <用户名>/oauth-web:1.0.0
docker push <用户名>/oauth-web:latest

# ④ 别处拉取
docker pull <用户名>/oauth-web:latest
docker run -d -p 8080:80 <用户名>/oauth-web:latest
```

**命名约定**：Docker Hub 的镜像名必须是 `<用户名>/<镜像名>`（不带头 `library/` 默认走官方仓库）。
`latest` 只是约定 tag，不代表真最新，生产建议打**语义化版本 tag**（如 `1.0.0`）。

##### 2) 推到 GHCR（GitHub Container Registry）

```bash
# ① 登录 GHCR（用 GitHub Personal Access Token，权限勾 read:packages + write:packages）
echo $GITHUB_TOKEN | docker login ghcr.io -u <GitHub用户名> --password-stdin

# ② 构建并打 GHCR tag
docker build \
  --build-arg VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com \
  --build-arg VITE_SIGN_APP_KEY=xxx \
  -t ghcr.io/<owner>/oauth-web:1.0.0 \
  -t ghcr.io/<owner>/oauth-web:latest \
  .

# ③ 推送
docker push ghcr.io/<owner>/oauth-web:1.0.0
docker push ghcr.io/<owner>/oauth-web:latest
```

> GHCR 首次使用前，需在 GitHub 仓库 **Settings → Packages** 里把该包设为 **Public**
> （默认 private，匿名 pull 会 401）。公开后任意机器 `docker pull ghcr.io/<owner>/oauth-web:latest`。

##### 3) 用 GitHub Actions 自动构建 + 推送（✅ 已实际跑通，推荐）

本仓已内置 `.github/workflows/docker-publish.yml`，**打 tag `v*` 即触发**，同时推送到
**GHCR + Docker Hub** 两个仓库。发新版只需两条命令，无需本机装 Docker、无需手动敲构建/推送：

```bash
git tag v1.1.2 && git push origin v1.1.2
```

实际镜像地址（最新 `v1.1.2`，2026-10-28 跑通）：

| 仓库 | 镜像 | 说明 |
| --- | --- | --- |
| Docker Hub | `docker.io/qirly/oauth-web:1.1.2` / `:latest` | ✅ 公开，匿名可 pull |
| GHCR | `ghcr.io/yijiu2025/oauth-web:1.1.2` / `:latest` | ✅ 已设为 public，匿名可 pull（设置方式见下方说明） |

workflow 用 `secrets.GITHUB_TOKEN` 免密钥推 GHCR（`packages: write` 权限），Docker Hub 走仓库
secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`。**需在仓库 Settings → Secrets and variables →
Actions 里配好**：

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| Secret | `DOCKERHUB_USERNAME` | Docker Hub 用户名（本仓为 `qirly`） |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub Access Token（🔴 不是网页密码，去 hub.docker.com/settings/security 生成 Read & Write token） |
| Secret | `SIGN_APP_KEY` | 后端 `SIGN_APP_KEY` 真实值，覆盖仓库里占位符 `coreflow-sign-key-2026-change-me` |
| Variable | `ALLOWED_PARENT_ORIGINS` | iframe 父应用 origin（可选，不配 = 空 = 拒绝一切） |
| Variable | `SOCIAL_ENDPOINT` | 第三方授权端点（可选） |
| Variable | `SOCIAL_PROVIDERS` | 如 `wechat,qq`（可选） |

完整 workflow（本仓已提交，此处是原样摘录）：

```yaml
name: docker-publish
on:
  push:
    tags: ['v*']
  workflow_dispatch: {}

permissions:
  contents: read
  packages: write   # 允许推送 GHCR

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: |
            ghcr.io/yijiu2025/oauth-web
            docker.io/qirly/oauth-web
          tags: |
            type=semver,pattern={{version}}
            type=ref,event=tag
            type=raw,value=latest
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            VITE_API_BASE_URL=
            VITE_ALLOWED_PARENT_ORIGINS=${{ vars.ALLOWED_PARENT_ORIGINS }}
            VITE_SIGN_APP_KEY=${{ secrets.SIGN_APP_KEY }}
            VITE_SOCIAL_ENDPOINT=${{ vars.SOCIAL_ENDPOINT }}
            VITE_SOCIAL_PROVIDERS=${{ vars.SOCIAL_PROVIDERS }}
```

> - **`SIGN_APP_KEY` 必须配**：否则镜像里会是仓库的占位值 `coreflow-sign-key-2026-change-me`，
>   签名对不上后端，所有请求 401/403。真实值只在 CI secrets 里，不进 git、不进镜像明文仓库。
> - **GHCR 默认 private**：`ghcr.io/yijiu2025/oauth-web` 推上去后默认是私有包，匿名 `docker pull` 会 401。
>   本仓已将其设为 public，匿名可 pull。设置/改回方式：GitHub 头像 → Packages → `oauth-web` →
>   Package settings → Change visibility → Public / Private。
>   若要保持 private，拉取前先 `docker login ghcr.io` 即可。
> - **版本号与 tag 同步**：`docker/metadata-action` 用 `type=semver,pattern={{version}}` 从 `v1.1.2`
>   生成 `1.1.2` 镜像 tag，所以 `git tag` 的版本要和 `package.json` 的 `version` 一致（本仓发版
>   流程 `scripts/release.mjs` 已保证这一点）。

##### 4) 公共库的安全注意

- 🔴 **构建参数 `VITE_SIGN_APP_KEY` 会打进镜像产物**（前端代码里明文可见）。签名 key 本就是
  弱防爬、需下发前端的值，但**仍不要**把更敏感的密钥（如后端 secret）用 build-arg 注入公共镜像；
- 镜像分层会残留 `ARG`/`ENV` 值，若某变量属敏感信息，宁可运行时注入（nginx 反代在运行时读），
  也不要 bake 进公开镜像层；
- 公开镜像 = 任何人可 pull，务必确认里面只有静态产物 + nginx，没有 `.env`、没有源码里的密钥。

---

## 五、后端对齐（CoreFlow / nodeServers）

oauth-web 是纯前端，后端的部署在前端仓之外（主仓 `nodeServers` 有 `Dockerfile` +
`docker-compose.yml` + `docker/entrypoint.mjs`，覆盖 app + MySQL + Redis）。前端侧只需要对齐
下面这几条，否则「页面正常、一提交就红」：

| 对齐项 | 前端 | 后端 | 不一致的后果 |
| --- | --- | --- | --- |
| H5 签名 appKey | `VITE_SIGN_APP_KEY` | `SIGN_APP_KEY` | 所有请求签名校验失败（401/403） |
| 人机验证开关 | `VITE_RECAPTCHA_ENABLED` / `VITE_TURNSTILE_ENABLED` | 对应启用开关 + secret | 验证码不出现 / token 校验失败 |
| 密码重置方式 | `VITE_PASSWORD_RESET_MODE` | `PASSWORD_RESET_MODE` | 前端走验证码、后端发邮件链接，流程对不上 |
| OAuth 回调域 | 授权页跳转的后端返回 `redirect_url` | client 注册的 `redirect_uri` 白名单 | 后端拒签授权码 |
| API 基地址 | `VITE_API_BASE_URL` | 后端监听地址（默认 `:3000`） | 请求打到错误地址 |

联调验证最小闭环：

```bash
# 后端侧（主仓）
npm run migrate && npm run dev     # :3000

# 前端侧（本仓）
npm run dev                        # :5174，/api /oauth2.1 等由 vite proxy 转 3000
```

---

## 六、iframe SSO 白名单（生产必查）

oauth-web 被宿主应用 `iframe` 嵌入时，`postMessage`（`SSO_READY` / `LOGIN_SUCCESS` / 主题同步）
只发给 `VITE_ALLOWED_PARENT_ORIGINS` 白名单内的父窗口。

- 生产**必须显式配置**真实父应用 origin（如 `https://app.example.com`），逗号分隔；
- 🔴 **显式空串 = 白名单为空 = 拒绝一切**（2026-10-27 起不会再回落 dev 的 localhost 值）；
- 漏配的典型症状：宿主弹窗「正在加载安全登录」要等满 3s 兜底超时，控制台出现
  `[SSO] 拒绝 postMessage：父 origin 未授权 <origin>`；
- 不要把 oauth-web 自己的端口写进去（它是被嵌方，不是父应用）。

---

## 七、部署后验证清单

### 7.1 自动化关卡

```bash
npm run doctor                        # 环境预检（0 FAIL 才能继续）
npm test                              # 单测（76 用例）
npm run build                         # 类型检查 + 构建（部署前必过）
node e2e/verify-all.mjs --only static # 静态关卡（需 dist/，其中 verify-no-pwa 需 dist-nopwa）
node e2e/verify-all.mjs               # 全量（需 dev 5174 / link 5175 / 5177 / 5197 / 5189 端口组）
```

> 浏览器实测需本机有 Chrome 或设 `CHROME_PATH`（`e2e/lib/chrome.mjs` 统一解析）。

### 7.2 手工冒烟清单（部署后逐项点一遍）

- [ ] 打开 `/login` 能渲染表单，无控制台红错
- [ ] 邮箱登录：发码 → 输入 6 位码 → 登录/二次验证
- [ ] 密码登录：先过图形码 → 登录
- [ ] 注册：三步表单 + 图形码 + 协议勾选
- [ ] 忘记密码：验证码重置 / 链接重置
- [ ] 扫码登录：二维码能生成（需后端）→ 轮询状态
- [ ] `/authorize?client_id=...` 授权页 + `/consent` 确认页
- [ ] iframe SSO：宿主弹窗嵌入，握手 `SSO_READY` 正常、主题同步正常
- [ ] 移动端 `/m/login` 在窄屏（390px）渲染正常
- [ ] 生产构建（非 dev）页面首屏无 `console.*` 输出

---

## 八、CI/CD 与自动部署

### 8.1 内置 CI（推送即门禁）

`.github/workflows/ci.yml`（入口）调用共享门禁 `.github/workflows/ci-quality.yml`：

```
push main / PR → 完整性自检 → npm ci → 类型检查 → ESLint → Vitest → 生产构建 → 构建后静态关卡
```

- 需要 dev server / preview 的关卡组（`verify-all` 的 ②③④ 组）**刻意不进 CI**（起服务易 flake），
  由本地全量跑；
- `docs-pages.yml` 在 `docs/**` 变更时自动部署文档站到 GitHub Pages。

### 8.2 生产自动部署（示例：rsync 到服务器）

```yaml
# .github/workflows/deploy.yml（本仓未内置，按需添加）
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          VITE_ALLOWED_PARENT_ORIGINS: ${{ secrets.VITE_ALLOWED_PARENT_ORIGINS }}
          VITE_SIGN_APP_KEY: ${{ secrets.VITE_SIGN_APP_KEY }}
      - uses: easingthemes/ssh-deploy@v5
        with:
          REMOTE_HOST: ${{ secrets.DEPLOY_HOST }}
          REMOTE_USER: ${{ secrets.DEPLOY_USER }}
          SSH_PRIVATE_KEY: ${{ secrets.DEPLOY_KEY }}
          SOURCE: dist/
          TARGET: /srv/oauth-web/dist
          ARGS: "-rlgoDzvc --delete"
```

🔴 关键点再次强调：生产变量是在 **build 步骤**注入的（`env:`），不是部署后。

---

## 九、回滚

静态站点的回滚很简单，但前提是**别让 `index.html` 被缓存**：

1. 每次构建的 `assets/*.js` 带内容 hash，互不覆盖；
2. 回滚 = 把上一版 `dist/` 原样放回（或 rsync 上一版产物），`index.html` 重新指向旧 hash 即生效；
3. 保留最近 3~5 个版本的 `dist` 归档（`dist-<tag>.tar.gz`）即可秒级回滚；
4. 🔴 若误把 `index.html` 也设了长缓存，回滚/发版都会被浏览器旧入口卡住——这是静态站最常见的事故。

---

## 十、常见问题排障

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 页面白屏、控制台 `ERR_CONNECTION_REFUSED` 到 `:3000` | 后端没起 / `VITE_API_BASE_URL` 指向错误 | 起后端；或改为同源反代后**重新构建** |
| 所有接口签名校验失败 | 前后端 `SIGN_APP_KEY` 不一致 | 对齐后重新构建 |
| iframe 弹窗「正在加载安全登录」卡 3s | `VITE_ALLOWED_PARENT_ORIGINS` 漏配父 origin | 补配后重新构建 |
| 直开 `/authorize` 404 | 静态托管没配 SPA 回退 | Nginx `try_files ... /index.html` 或平台重写规则 |
| 发版后用户看到旧页面 | `index.html` 被缓存 | `index.html` 改 `no-cache`；`/assets/` 才允许长缓存 |
| 生产页面控制台有 `console.*` | 用了 dev 构建产物 | 用 `npm run build` 产物（构建已 dropConsole） |
| 主题/配色不对 | `VITE_THEME_DIR` 或主题目录结构变了 | 恢复默认 `src/theme`，重跑 `verify-theme-dirs` |
| 验证码不出现 | 人机验证开关/密钥没配 | 对齐 `VITE_RECAPTCHA_ENABLED` / `VITE_TURNSTILE_ENABLED` 与后端 |

---

## 十一、上线安全自查（一页清单）

- [ ] 真实密钥只进 `.env.production.local` / CI secrets，**不落 git、不落镜像层**
- [ ] `VITE_SIGN_APP_KEY` 与后端一致且非占位值（`change-me`）
- [ ] `VITE_ALLOWED_PARENT_ORIGINS` 显式配置为真实父应用 origin
- [ ] 全站 HTTPS；API 与页面同源（或跨域 Cookie 已按 `SameSite=None; Secure` 配置）
- [ ] 响应头：`X-Content-Type-Options` / `Referrer-Policy` / 合理的 CSP（iframe 场景用 `frame-ancestors`）
- [ ] 生产产物来自 `npm run build`（无 sourcemap、无 console）
- [ ] 协议文件占位符已替换（上线前跑 `node e2e/verify-agreement-placeholders.mjs`）
- [ ] 最近几个版本的 `dist` 归档可回滚
