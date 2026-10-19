# 贡献指南

感谢你愿意为 oauth-web 出力。这份指南帮你少踩坑：怎么把项目跑起来、哪些红线不能碰、提交与 PR 该走什么流程。**动手前花五分钟读完，尤其是「代码红线」一节**——这里的每一条都是实战踩出来的。

## 这个仓库是什么

企业统一身份认证（SSO）体系的**纯前端部分**：登录、注册、找回密码、扫码登录、OAuth 2.1 授权页（authorize / consent）一整套页面，外加多主题、多设备版式、国际化与深色模式。

- 技术栈：Vue 3.5（Composition API）+ TypeScript 6 + Vite 8（Rolldown + Oxc）+ Pinia 3 + Vue Router 5 + vue-i18n 11 + Tailwind CSS 3.4 + SCSS + VeeValidate 4 + Zod 3 + Vitest 4
- 端口：**5174**（`strictPort`），`/api` 与 `/oauth2.1` 由 vite proxy 转发到后端 `localhost:3000`
- 协议：[GPL-3.0](LICENSE)
- 后端账号与授权服务在另一个仓库 [CoreFlow](https://github.com/yijiu2025/CoreFlow)，本仓所有接口都来自它

## 一、上手

前置依赖：Node.js 18+（建议 20+）、npm 9+。

```bash
git clone https://github.com/yijiu2025/oauth-web.git
cd oauth-web
npm install
npm run dev            # http://localhost:5174
```

> **没有后端也能 `npm run dev`**：页面能打开，但登录 / 授权 / 扫码的接口会全部失败——这是预期现象，不是 bug。本地联调先起 CoreFlow 后端（`localhost:3000`，含数据库迁移），并保证前端 `.env` 的 `VITE_SIGN_APP_KEY` 与后端 `.env` 的 `SIGN_APP_KEY` 一致，否则 H5 签名校验失败。

### `skinsuite` / `stable-deviceid` 的两种形态

主题内核（`skinsuite`）与设备 ID 工具（`stable-deviceid`）按**上级目录是否存在 `packages/`** 自动切换（`config/aliases.ts` 条件注册）：

- **单仓形态**（上面的 clone 方式，也是 CI / 开源用户的形态）：两个包走 `node_modules` 里的 npm 发布版，无需任何额外目录；
- **monorepo 形态**（在 CoreFlow 主仓库内开发）：上级有 `packages/` 时 alias 自动指向包源码，改包源码即时生效。

关卡 `e2e/verify-alias-single-source.mjs` 等按同一物理条件分流验证，两种形态下单测 / 构建 / 静态关卡均全绿。**报告 bug 时请说明你用的是哪种形态。**

### 常用命令

| 命令                                    | 作用                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`                           | 开发服务器（端口 5174，`strictPort`，被占直接报错，不静默换端口）                                   |
| `npm run build`                         | 先 `vue-tsc -b` 类型检查，再 `vite build` 生产构建                                                  |
| `npm run preview`                       | 本地预览构建产物                                                                                    |
| `npm run type-check`                    | 仅类型检查（`vue-tsc -b`）                                                                          |
| `npm test`                              | Vitest 跑单元测试（`__tests__/` 与 `e2e/`）                                                         |
| `npm run lint` / `lint:fix`             | ESLint 检查 / 自动修复                                                                              |
| `npm run audit`                         | 依赖漏洞审查（`--audit-level=moderate`）                                                            |
| `node e2e/verify-all.mjs --only static` | 静态关卡：主题目录形态 / 别名单一来源 / 内核零框架耦合 / console 剥离 / any 债务 / PWA / 包体积预算 |

需要 dev server 的关卡组刻意不进 CI（起服务易 flake），本地用 `node e2e/verify-all.mjs` 全量跑。

#### 本地多实例验收：每个实例必须独占 `cacheDir`

全量 `verify-all.mjs` 需要 5174 / 5175 / 5177 / 5197 四个 dev 实例同时在线，而它们**不能共享 `node_modules/.vite/deps`**：env 会参与配置哈希，各实例的 `browserHash` 因此不同，会互相判定对方的依赖已过期，返回 `504 Outdated Optimize Dep` → 异步组件加载失败 → 页面白屏。

症状极具误导性：e2e 里成片的**纯 DOM 断言**变红（等 `.mauth-page` / `[data-mauth-view]` 超时），看起来完全像业务代码坏了。**排查顺序固定：先看浏览器控制台有没有 504，再怀疑自己的改动。**

给每个实例配独立缓存目录（`.tmp-probe/` 已 gitignore，探针配置不入库）：

```js
// .tmp-probe/vite.probe.config.mjs
import base from '../vite.config.ts';
export default { ...base, cacheDir: process.env.PROBE_CACHE_DIR || 'node_modules/.vite' };
```

```bash
PROBE_CACHE_DIR=node_modules/.vite-p5174 npx vite --config .tmp-probe/vite.probe.config.mjs --port 5174 --strictPort
PROBE_CACHE_DIR=node_modules/.vite-p5175 VITE_PASSWORD_RESET_MODE=link npx vite --config .tmp-probe/vite.probe.config.mjs --port 5175 --strictPort
PROBE_CACHE_DIR=node_modules/.vite-p5177 npx vite --config .tmp-probe/vite.probe.config.mjs --port 5177 --strictPort
PROBE_CACHE_DIR=node_modules/.vite-p5197 npx vite --config .tmp-probe/vite.probe.config.mjs --port 5197 --strictPort
```

实测差距：同一份代码，共享缓存 **19/22**，隔离后 **22/22**。`main` 在该环境下同样只有 19/22 —— 所以这类失败基本与代码无关。

两个配套判据：

- `node_modules/.vite/` 里若**只有 `deps_temp_*` 而没有 `deps/`**，说明预打包从未成功提交（Windows 上多进程抢原子重命名），同样白屏。清掉这些残留目录后由单个实例重建即可。
- **`curl` 取源码模块返回 200，不代表浏览器能加载**。504 发生在 `node_modules/.vite/deps/*` 上，只看源码模块状态会得出「服务正常」的错误结论。

**CI**：push 到 `main`、开 PR 或手动触发时，GitHub Actions 跑「类型检查（vue-tsc -b）→ ESLint → Vitest → 生产构建 → 附加构建（dist-nopwa）→ 静态关卡」（`.github/workflows/ci.yml`）。

### 环境变量

复制 `.env.example` 为 `.env` 起步。四个 env 文件（`.env` / `.env.development` / `.env.production` / `.env.example`）的**变量顺序完全一致**（14 个变量），每个文件内的注释就是完整解释（含漏配症状与安全边界）。完整清单见 [README 环境变量一节](README.md#环境变量)。用不到的变量留空即「不启用」，**不要删行**。

## 二、代码红线

以下每一条都对应一类「本可以拦住」的事故，违反会被 review 打回：

1. **端口 5174 是写死的**：`strictPort` 被占会直接启动失败——这是故意的，避免手机调试连错端口。不要为了自己方便改端口。
2. **env 四文件必须同序同注释**：新增变量时四个文件同时加、注释写全（含漏配症状）；`.env` 永远不入库；真实密钥一律走部署平台，`.env.production` 只放默认值 / 占位符。
3. **第三方登录端点只接受站内相对路径**：`VITE_SOCIAL_ENDPOINT` 刻意不支持绝对地址——端点一旦能由外部指定，「把用户送去任意外域」就从漏洞变成配置问题。
4. **iframe 消息必须 origin + source 双校验**：只有父 origin 命中 `VITE_ALLOWED_PARENT_ORIGINS` 白名单才 `postMessage`。漏配的症状是宿主弹窗「正在加载安全登录」等满 3 秒兜底超时——不报错，极难排查。
5. **主题 / 版式三段正交，目录名即 id**：token 基线 → 皮肤包 → 版式三者独立组合；`view ≡ pkg`（**`'base'` 不是合法 view 名**）；设备平级 `mobile | standard | mini | tablet`（mini 是独立设备维度，不是 mobile 的缩写）；版式优先级 `?view=` > 包声明 > 包名；URL 显式非法值**不回退**。完整规范（目录契约 / 替换入口 / 优先级 / 安全边界 / 验收清单）以 [docs/theme-replacement.md](docs/theme-replacement.md) 为单一来源，动手前先读它。
6. **改别名只改 `config/aliases.ts` 一处**：vite alias 与 tsconfig paths 都从它派生，两处同改、别手改下游。`skinsuite` / `stable-deviceid` **零外部 import**——包内 `import vue` 会造成两份 Vue 实例，主题与设备 ID 静默失效。
7. **H5 签名是弱防爬，不是安全边界**：appKey 必然随前端代码分发，真正的边界在后端登录态 + 权限校验。不要在前端加「自以为安全」的校验来替代后端控制。
8. **eslint 全局是按目录配的**：`e2e/`（node + browser）、`scripts/`（node）、`src`（浏览器）三组 `languageOptions.globals` 各管各的。新增同类脚本目录要先补对应的 languageOptions 块，否则满屏 no-undef。
9. **本机 `vite build` 有 shim**：后台构建时若清理 dist 超过 50 个文件会被拦（前台执行可正常过；CI runner 无此限制）。本地验证构建请优先前台跑，别被假红误导。
10. **不要提交 `dist/`、`.tmp-probe/` 等产物**：构建产物与探针目录都在 `.gitignore` 里；提交前 `git status` 自查。
11. **Tailwind 是 v4 原生形态，不存在 `tailwind.config.js`**：语义色板 / 圆角 / 字体栈全部写在 `src/assets/styles/main.scss` 的 `@theme` 里，`@config` 兼容层 2026-10-17 已退役。**不要为了改配色重新引入 JS 配置**——那会把项目退回「v4 引擎 + v3 配置」的混合态。三条硬约束：
    - **token 名不可改**：`packages/theme-core` 的皮肤 / 版式替换体系按名引用 `--color-*`、`--radius-*`，改名直接打破主题替换。可以改「值」，不能改「名」。
    - **`dark` 变体固定为 `@custom-variant dark (&:is(.dark *))`**：不要「顺手优化」成官方文档示例的 `:where(.dark, .dark *)`。后者会新增 `.dark` 自匹配并把特异性从 (0,2,0) 降到 (0,1,0)，而本仓大量存在「组件类 + `dark:` 覆写」并存的写法，属真实行为变化。
    - **类名扫描范围用 `@source` 声明**（含 `src/**/*.html`）。删掉 `@source` 后 v4 的自动探测不保证覆盖模板里的动态类名。

## 三、提交与发版

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：`<类型>(<范围>): <描述>`，类型用 `feat` / `fix` / `perf` / `refactor` / `style` / `test` / `docs` / `chore` / `ci` / `build`。

```text
feat(login): 扫码登录轮询间隔可配置
fix(theme): 修复深色模式下 token 对比度不足
```

一次提交只做一件事；描述写「做了什么 + 为什么」，不写流水账。

### 发版判据

本仓用自包含脚本 `scripts/release-web.mjs`（可拷走单独用）：

```bash
node scripts/release-web.mjs            # 预览：算版本、生成 Release 说明
node scripts/release-web.mjs --apply    # 执行：打 tag + 推 tag + 建 GitHub Release
node scripts/release-web.mjs --npm      # 追加：发布 npm 包（默认不发）
```

| 累积提交类型                                     | 版本动作 |
| ------------------------------------------------ | -------- |
| 有 `feat`                                        | minor    |
| 仅 `fix` / `perf`                                | patch    |
| 有破坏性变更（commit footer `BREAKING CHANGE:`） | major    |
| 其余（docs / chore / refactor…）                 | 不发版   |

版本源是 git tag，`package.json` 单向跟随。完整规则（提交 / 版本号 / 分支三合一）见 [docs/git-release-rules.md](docs/git-release-rules.md)。

## 四、PR 流程

1. **开分支**：有写权限直接从主仓开 `feat/xxx`、`fix/xxx`；外部贡献者先 fork。
2. **本地全绿再推**：`npm run type-check && npm run lint && npm test && node e2e/verify-all.mjs --only static`。UI 改动请附截图 / 录屏（桌面 + 移动 + 深色三态）。
3. **提交信息**遵循上面的 Conventional Commits。
4. **开 PR 到 `main`**，按模板填写：改动类型、动机、主要改动、测试证据、自检清单。
5. **CI 五环节全绿**且 review 通过后才合并；大改动建议先开 issue 讨论方案再动手。
6. 合并策略：squash merge。发版由维护者按上面的判据执行，贡献者不需要自己打 tag。

## 五、相关仓库

改动前先确认目录归属，别把改动提到错误的仓库：

| 仓库                                                        | 内容                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| [oauth-web](https://github.com/yijiu2025/oauth-web)（本仓） | SSO 登录 / 授权前端全部页面、主题体系、构建关卡                 |
| [CoreFlow](https://github.com/yijiu2025/CoreFlow)           | 后端账号与授权服务（Fastify），本仓所有接口的来源               |
| [log](https://github.com/yijiu2025/log)                     | `packages/log` 日志包                                           |
| [theme](https://github.com/yijiu2025/theme)                 | `packages/theme-core` 主题内核（monorepo 形态下即 `skinsuite`） |
| [phonecopy](https://github.com/yijiu2025/phonecopy)         | `phonecopy/`（submodule，与本仓无直接关系）                     |

## 六、其他约定

- 行为准则见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)；安全漏洞请走私密渠道，见 [SECURITY.md](SECURITY.md)。
- 无障碍目标与已知局限见 [ACCESSIBILITY.md](ACCESSIBILITY.md)。
- 项目文档在 [docs/](docs/)（前端生成手册、主题替换规范、主题热更新设计、Git 发版规则等），README 有完整索引。
- 提 bug 前先搜已有 issue，并用 issue 模板（含环境与脱敏检查项）。
