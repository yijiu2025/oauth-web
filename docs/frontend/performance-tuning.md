# oauth21 前端性能调优方案与指标

> 2026-10-15 定稿。口径：**生产构建产物 + 真实浏览器实测**（dev server 的请求数/体积无参考价值）。
> 本文分四部分：现状实测 → 已落地优化 → 指标与守门 → 部署层与深水区。
> 所有"实测"数字均可复现，复现命令见每节脚注。

---

## 一、现状实测（2026-10-15，作为一切决策的基线）

### 1.1 首屏流量（生产构建，SW 屏蔽口径）

复现：`npm run build` → `npx vite preview --port 5189 --strictPort` →
`node e2e/measure-load-budget.mjs http://127.0.0.1:5189 dist --block-sw`

| 场景 | 请求数 | 过线字节¹ | 其中 JS | 其中 CSS |
| --- | --- | --- | --- | --- |
| 窄屏 390×844 首屏 `/login` | 47 | **211.0 KB** | 183.4 KB | 21.8 KB |
| 宽屏 1280×900 首屏 `/login` | 43 | **207.9 KB** | 183.7 KB | 20.9 KB |
| `/m/register?view=compact`（非内置包） | 45 | 195.0 KB | 170.4 KB | 21.2 KB |
| `/m/login?theme=cyan`（惰性配色） | 49 | 211.9 KB | 186.5 KB | 21.8 KB |
| 窄屏 → 拉宽 1280 的**增量** | **0** | 0 KB | — | — |
| 宽屏 → 缩回 390 的增量 | **0** | 0 KB | — | — |

> ¹ `vite preview` 默认开 brotli，过线字节 ≈ 真实 CDN brotli 水平；未开压缩的服务端约为其 3 倍。

### 1.2 首屏静态集（`dist/index.html` 引用的 `/assets/`，不可长缓存之外的全部首屏依赖）

| 文件 | gzip | raw |
| --- | --- | --- |
| form-vendor（zod + vee-validate + @vee-validate/zod） | 51.4 KB | 160.1 KB |
| vue-vendor（vue + pinia + vue-router + vue-i18n） | 28.7 KB | 83.0 KB |
| net-vendor（axios） | 18.1 KB | 48.6 KB |
| index（入口 + 同步业务图） | 15.5 KB | 39.4 KB |
| index.css（全局样式 + tailwind base + 同步组件样式） | 11.4 KB | 62.8 KB |
| theme（主题注册表，eager 预载，设计使然） | 8.8 KB | 49.6 KB |
| page / rolldown-runtime | 1.7 KB | 3.1 KB |
| **合计（8 files）** | **135.6 KB** | **446.6 KB** |

### 1.3 产物全景

- dist 总量 **808.5 KB / 90 个 chunk**；构建耗时 **4.3s**（Vite 8 / Rolldown + Oxc）。
- 最大 chunk = form-vendor 51.4 KB gz；无 chunk 触发 500 KB 构建告警线。

### 1.4 结构性结论（先看清再动手）

1. **路由懒加载、vendor 分包、dropConsole、tree-shaking 早已就位**（见 `vite.config.ts` 注释里的演进记录），首屏图的"形态"没有问题。
2. **三形态预热是刻意设计**（v2.20.1「避免切换闪屏」，`e2e/verify-first-paint-budget.mjs` A1 断言）：桌面首屏会加载 mobile/standard/mini 三套版式容器，代价约 19 KB gz，换来的是切换视口/设备时 **0 新请求**（上表已实测）。不为省这 19 KB 破坏它。
3. `useQrLogin`（含 qrcode，9.1 KB gz）在首屏静态图内——**分析后判定不动**：`StandardLogin.vue` / `MiniLogin.vue` 的 `onMounted` 里有 `hasAppName → generateQR()` 自动生成，动态 import qrcode 只会把加载推迟到挂载后几毫秒并多一层瀑布，总流量不变，属负优化。
4. 首屏 135.6 KB gz 的构成里，**form-vendor 51.4 KB 是唯一的大头**（vee-validate `useForm` 链路 + zod4 核心）。它确实被首屏表单校验需要，要砍只能换校验方案（见 §5 深水区）。
5. 部署层（压缩、缓存）此前**没有落地配置**——这是当前最大的确定性收益来源（§4）。

---

## 二、已落地优化（2026-10-15 本次改动）

### 2.1 真 bug 修复：favicon 断链

`index.html` 的 icon 指向 `/vite.svg`——`public/` 下**不存在该文件**（Vite 脚手架模板残留），请求被 SPA fallback 吃成 `index.html`（浏览器拿到 text/html 直接丢弃），症状是**标签页图标静默失效 + 每次访问白背 1.8 KB HTML**。已改为真实存在的 `/favicon.svg`。

### 2.2 静态资源压缩：favicon.svg 9,522 → 8,710 B（-9%）

`public/favicon.svg` 做**安全子集**压缩：删等于默认值的 `fill-opacity:1`、删与 style 链重复的 presentation attribute、小数按量级自适应降精度（|v|≥0.1 保留 2 位，<0.1 保留 4 位——**教训：无脑 round(2) 会把 `matrix(.00324 …)` 的微缩放因子归零，装饰椭圆变形，G 通道最大差 27/255，肉眼可见**）。
视觉无损验证：Chrome 无头 4× 渲染前后两版逐像素对比，99.99% 差异像素 Δ≤7/255，仅 2 px Δ>15 且位于模糊光晕高梯度边缘（0.005px 坐标差在陡边的放大），显示尺寸下不可感知。脚本与备份在 `.tmp-probe/`（`shrink-favicon.py` / `favicon.orig.svg`）。

### 2.3 构建配置：关闭 modulepreload polyfill

`build.modulePreload.polyfill: false`。原生 modulepreload = Chrome 66+ / Edge 79+ / Firefox 68+ / Safari 16.4+（2023-03）。不支持的浏览器分两类：连 ESM 都不支持的（入口 `type="module"` 本就跑不起来，polyfill 无从救起）；Safari 16.3 及以下（失去的只是预加载加速，功能不受影响）。登录页"用完即走"形态下，不为 <1% 存量浏览器每次访问多付 0.4 KB + 一段同步执行。**若未来要覆盖企业内网旧 Safari，改回 `true` 即可，不影响其它配置。**

### 2.4 刻意不做的两项（分析结论，防后人重复踩）

- **不显式设 `build.target`**：Vite 8 默认就是 `baseline-widely-available`（约 chrome107/safari16），手写 `es2020` 反而比它宽、还让配置落后于上游。
- **不动 `useQrLogin` 的静态引入**（见 §1.4-3，负优化）。

### 2.5 防回归守门：`e2e/verify-bundle-budget.mjs`（新关卡）

把"产物悄悄膨胀"这类**功能一切正常、没有任何现有关卡会红**的退化钉成硬预算。对**落盘后真实字节**用 `zlib.gzip(level 6)` 自算（不信任构建日志的逐文件估算值），口径自持：

| 预算项 | 线 | 实测 |
| --- | --- | --- |
| 首屏静态集 gzip 总量 | ≤ 150 KB | 135.6 KB |
| 首屏静态集文件数 | ≤ 12 | 8 |
| 单 chunk gzip / raw | ≤ 60 KB / 200 KB | 51.4 / 160.1 KB |
| dist 总量 | ≤ 1024 KB | 808.5 KB |
| index.html | ≤ 8 KB | 2.8 KB |

- 已接入 `e2e/verify-all.mjs` 静态关卡组（产物不存在时 exit 3 跳过，不误红）。
- 自带毒丸自证：`--poison` 把预算线压到 -1 必须全红（已实测 exit 1）——**恒绿的关卡等于没关卡**。
- 改预算线 = 显式性能决策，必须同步改文件头「实测基线」注释并写清理由。

---

## 三、指标定义与目标值

### 3.1 核心 Web Vitals（ Lighthouse / Chrome UX Report 口径 ）

| 指标 | 定义 | 目标 | 现状估计 |
| --- | --- | --- | --- |
| **LCP** | 最大内容绘制（登录卡片/表单首帧） | ≤ 2.0s（4G 中位） | 首屏静态集 135.6 KB gz + 无渲染阻塞外链，预计 1.2~1.8s |
| **INP** | 交互到下一帧（输入校验、tab 切换、验证码倒计时） | ≤ 200ms | 主线程无长任务设计（轮询 2s 一次、无同步大计算），预计 < 100ms |
| **CLS** | 累积布局偏移 | ≤ 0.1 | 版式容器尺寸由 CSS 锁定、二维码区固定占位，预计 ≈ 0 |
| **TTFB** | 首字节（同域部署） | ≤ 300ms | 取决于后端；前端侧 index.html 仅 2.8 KB、无外链依赖 |

### 3.2 业务/工程指标（本仓可自测，均有工具）

| 指标 | 目标 | 工具 |
| --- | --- | --- |
| 首屏静态集 gzip | ≤ 150 KB（关卡硬守） | `verify-bundle-budget.mjs` |
| 首屏总流量（含按需） | ≤ 220 KB | `measure-load-budget.mjs`（当前 211.0 KB） |
| 视口/设备切换增量请求 | **0** | `measure-load-budget.mjs` 场景②③（三形态预热的设计回报） |
| 非内置包 chunk 首屏加载数 | **0** | `verify-first-paint-budget.mjs` |
| theme.scss 惰性 | 首屏 0 个 | 同上 |
| 构建耗时 | ≤ 10s | `npm run build`（当前 4.3s） |
| dist 总量 | ≤ 1 MB（关卡硬守） | `verify-bundle-budget.mjs`（当前 808.5 KB） |

### 3.3 监控接入建议（不在本仓改动，部署侧二选一）

1. **web-vitals + 现有上报通道**：前端引 `web-vitals` 包，LCP/INP/CLS 经 `useErrorReporter` 同款 `/api/v1/client-error` 通道上报（该通道已存在，改后端接收即可）。
2. **Lighthouse CI**：对 preview 服务跑 `npx lighthouse http://127.0.0.1:5189/login --only-categories=performance`，分数入 CI 制品。注意登录页是 SPA，Lighthouse 分数对 TTFB 敏感，只做趋势对比、不做绝对门槛。

---

## 四、部署层优化（当前最大确定性收益，nginx 配置片段）

首屏 211 KB 过线是在 **preview 已开 brotli** 下测得的。若线上 nginx 只开 gzip 甚至不开压缩，首屏将膨胀到 ~580 KB。以下片段按本仓产物特征（hash 资源 + SPA fallback + sw.js 自毁迁移）编写：

```nginx
server {
  # ---------- 压缩 ----------
  # brotli 优先（对 JS/CSS/SVG 比 gzip 再小 15~25%），gzip 兜底（旧客户端）
  brotli on;
  brotli_comp_level 6;
  brotli_types text/css application/javascript application/json image/svg+xml;
  gzip on;
  gzip_comp_level 6;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;          # 小文件压缩收益不抵 CPU

  # ---------- 缓存 ----------
  # /assets/ 全部带内容 hash，内容不变 hash 不变 → 强缓存一年
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
  }
  # index.html 与 sw.js：**绝不强缓存**。前者是版本指针，后者是自毁迁移的载体
  # （见 vite.config.ts 里 PWA 移除注释：老用户要能即时拿到自毁版 sw.js）
  location = / {
    add_header Cache-Control "no-cache";   # 每次回源校验
  }
  location = /sw.js {
    add_header Cache-Control "no-cache";
  }
  # favicon.svg 等 public 直出文件：无 hash，短缓存 + 需验证
  location ~* \.(svg|png|jpg|woff2?)$ {
    expires 7d;
    add_header Cache-Control "public, must-revalidate";
  }

  # ---------- SPA fallback ----------
  location / {
    try_files $uri $uri/ /index.html;
  }

  # ---------- HTTP/2 ----------
  # listen 443 ssl;  + http2 on;   （首屏 47 请求，H2 多路复用是硬需求；
  # 若前面有 CDN，确认 CDN 回源也用 H2）
}
```

**衔接注意**：本仓 `docker-compose.yml` / `docker/` 的部署方式若要改，先读 `docs/development/` 下部署文档再动（本方案只给配置语义，不擅自改部署编排）。压缩中间件与 CDN 叠加时，确认 CDN 已正确传递 `Accept-Encoding: br`。

---

## 五、深水区选项（收益大、动架构，需单独评审）

以下三项**本次刻意不动**，列为后续候选。每项都给出收益估计与风险，供排期决策：

| 选项 | 估计收益（首屏 gz） | 风险 / 代价 |
| --- | --- | --- |
| **A. vee-validate → 轻量校验**：仅用 `useForm` 的 9 处调用改为 zod 直调 + 百行级薄封装（或 Form 组件自管状态） | **-35 ~ -45 KB** | 中高：登录/注册/找回三页表单错误态、`defineField` 双向绑定、`toTypedSchema` 联动要逐页重写；`verify-login-view` 等 3 个关卡（36+36+56 项）要同步适配 |
| **B. axios → fetch 薄封装**：net-vendor 18.1 KB gz，本仓请求面（`utils/request.ts` + api 层）窄且集中 | **-15 ~ -18 KB** | 中：拦截器（H5 签名、401 重放、`_retry` 守卫）需重写并复刻现有语义；`verify-no-any-debt` 等类型关卡要过 |
| **C. index.css 拆细**：62.8 KB raw 里 tailwind 工具类占比可观，可将 tailwind 输出与全局 scss 分文件，按路由 chunk 拆 CSS | 首屏 -3 ~ -6 KB（gz） | 低，但收益也低；建议与 A/B 一起做时顺手验证 |

**排期建议**：A > B > C。A 单独做即可把首屏静态集压到 ~100 KB gz 以内，是唯一能改变量级的选项；但它触碰全部表单页，必须先在测试环境全量过 e2e 三视图关卡再上。

---

## 六、附录：本次改动文件清单

| 文件 | 改动 |
| --- | --- |
| `index.html` | favicon 断链修复（/vite.svg → /favicon.svg） |
| `vite.config.ts` | `build.modulePreload.polyfill: false` + target 决策注释 |
| `public/favicon.svg` | 安全子集压缩 -9%（视觉无损，像素级验证） |
| `e2e/verify-bundle-budget.mjs` | **新增**：包体积预算守门（含毒丸自证） |
| `e2e/verify-all.mjs` / `e2e/VERIFY.md` | 接入新关卡（活跃关卡 21 → 22） |

复现命令（全量）：

```bash
cd oauth21
npm run build                                   # 类型检查 + 生产构建
node e2e/verify-bundle-budget.mjs               # 体积预算（正常）
node e2e/verify-bundle-budget.mjs --poison      # 毒丸自证（必须红）
npx vite preview --port 5189 --strictPort &     # 起预览
node e2e/measure-load-budget.mjs http://127.0.0.1:5189 dist --block-sw
node e2e/verify-all.mjs --only static           # 全部静态关卡
```
