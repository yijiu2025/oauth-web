# 性能调优

> 本文摘要自 `docs/frontend/performance-tuning.md`（2026-10-15 定稿），完整实测数据与复现命令
> 见原文。口径：**生产构建产物 + 真实浏览器实测**。

## 一、基线（2026-10-15 实测）

| 场景 | 请求数 | 过线字节（brotli） |
| --- | --- | --- |
| 窄屏 390×844 首屏 `/login` | 47 | 211.0 KB |
| 宽屏 1280×900 首屏 `/login` | 43 | 207.9 KB |
| 窄屏 → 拉宽 1280 的增量 | **0** | 0 KB |
| 宽屏 → 缩回 390 的增量 | **0** | 0 KB |

首屏静态集 8 个文件合计 **135.6 KB gzip**（446.6 KB raw）；dist 总量 808.5 KB / 90 chunk；
构建 4.3s（Vite 8 / Rolldown + Oxc）。

## 二、结构性结论

1. **路由懒加载、vendor 分包、dropConsole、tree-shaking 早已就位**，首屏图形态没问题；
2. **三形态预热是刻意设计**：桌面首屏加载 mobile/standard/mini 三套版式容器，代价约 19 KB gz，
   换来切换视口 / 设备时 **0 新请求**——不为省这 19 KB 破坏它；
3. `useQrLogin`（含 qrcode 9.1 KB gz）在首屏静态图内——分析后判定**不动**（动态 import 是负优化）；
4. 首屏大头是 `form-vendor` 51.4 KB gz（vee-validate + zod4），它确实被首屏表单校验需要。

## 三、已落地优化

- **favicon 断链修复**：`/vite.svg`（脚手架残留）→ `/favicon.svg`；
- **favicon.svg 安全子集压缩**：9,522 → 8,710 B（-9%），视觉无损（像素级验证）；
- **关闭 modulepreload polyfill**：不为 <1% 存量浏览器每次访问多付 0.4 KB；
- **体积预算守门** `e2e/verify-bundle-budget.mjs`：把「产物悄悄膨胀」钉成硬预算（含毒丸自证）。

## 四、指标与守门

| 指标 | 目标 | 工具 |
| --- | --- | --- |
| LCP | ≤ 2.0s（4G 中位） | Lighthouse / CrUX |
| INP | ≤ 200ms | 同上 |
| CLS | ≤ 0.1 | 同上 |
| 首屏静态集 gzip | ≤ 175 KB（硬守） | `verify-bundle-budget.mjs` |
| 首屏总流量 | ≤ 220 KB | `measure-load-budget.mjs` |
| 视口/设备切换增量请求 | 0 | `measure-load-budget.mjs` |
| dist 总量 | ≤ 1 MB（硬守） | `verify-bundle-budget.mjs` |

## 五、部署层

首屏 211 KB 是在 preview 已开 brotli 下测得的。线上 nginx 建议：

- **brotli 优先 + gzip 兜底**（否则首屏膨胀到 ~580 KB）；
- `/assets/` 内容带 hash → 强缓存一年（`immutable`）；
- `index.html` 与 `sw.js` **绝不强缓存**（`no-cache`，版本指针 + 自毁迁移载体）；
- SPA fallback：`try_files $uri $uri/ /index.html`。

完整 nginx 片段见原文第四节。

## 六、深水区选项（本次刻意不动）

| 选项 | 估计收益 | 风险 |
| --- | --- | --- |
| A. vee-validate → 轻量校验 | -35 ~ -45 KB | 中高：全部表单页重写 + 3 个关卡同步适配 |
| B. axios → fetch 薄封装 | -15 ~ -18 KB | 中：拦截器（签名 / 401 重放）需复刻语义 |
| C. index.css 拆细 | -3 ~ -6 KB | 低，收益也低 |

排期建议 A > B > C。A 是唯一能改变量级的选项（首屏压到 ~100 KB gz 内），但触碰全部表单页，
必须先全量过 e2e 三视图关卡再上。
