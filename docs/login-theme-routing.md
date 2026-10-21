# 登录链路主题路由设计（URL 参数 → store）

> **状态：契约文档（先行，2026-10-19；2026-10-21 随 skinsuite 0.5.0 补设备判定归属）**。代码按本文档实施；落地后在文首标注版本。
> **读者**：改登录链路 / 主题参数 / 调试面板的人；拼 SSO 登录链接的宿友应用方。
> **上位文档**：`multi-theme.md`（主题机制全文与强制规则）、`theme-replacement.md`（主题替换规范）。
> 本文只定**登录链路的 URL 参数契约与 store 化设计**，不重复主题机制全景。

## 0. TL;DR —— 六条契约

1. **分发 = 一条路由 + 宿主设备模块选容器**（mobile→app 登录页 / standard→StandardLogin / mini→MiniLogin / tablet→tablet 登录页）。判定 = `utils/device-resolve.ts` 纯函数 + `composables/useRenderDevice` 薄封装（视口 / URL 词汇，零主题依赖）；**无路由跳转、无参数透传**——store 是跨容器唯一共享通道，设备身份由被选中容器内的 `<ThemeView page="…" device="…">` props 告知。
2. **URL 主题参数只有一套键形**：版式 `th` / `th_<urlKey>`，配色 `th_color` / `th_color_<urlKey>`（配色键顺序与版式相反，历史约定，**不变**）。urlKey 词汇 = `mini` / `tab` / `mobile` / `std`（宿主 `devices.ts` 声明）。
3. **`?device=<id>` 是设备锁定**：只放行锁定设备那条意图链，其它设备的 `th_*` / `th_color_*` **不生效**（不报错、不清洗）。
4. **版式与配色都「URL 一次读入 store」**：debug 改 store 不改路由。
5. **`?theme=dark|light` 废弃失效**（§5）：明暗归主题状态机，不经 URL。
6. **`?debug=theme`** 是主题调试面板的唯一 URL 入口。

## 1. Spec → 现行架构对照（逐条）

| Spec 原话（归纳） | 现行机制 | 处置 |
|---|---|---|
| `/login/...?th=…` 由 router 直达 `view/web/login/index.vue` | 路由即如此；`/login` 与 `/m/login` 共用同一分发器 | ✅ 不动 |
| 屏宽自动判设备，分发到手机端 / web 端 / mini 端 | 宿主设备模块：`utils/device-resolve.ts` 纯函数（`?device=` 锁 > `?isMobile` > `?from=` > 视口 > 兜底）+ `composables/useRenderDevice` 薄封装；分发器按它选容器（Map + 末条兜底） | ✅ 不动 |
| `device=mobile` → `MiniLogin.vue` | **笔误（已与需求方确认）**：`device=mobile` 锁定 mobile 设备 → `view/app/login/index.vue`（手机端全屏）；`MiniLogin.vue` 是 **mini** 设备容器 | 维持现行锁定语义 |
| 初始参数「直接读进库写 store」 | 配色已 store 化（`readUrlIntent` 一次读入）；**版式今天每次渲染现读 `route.query`** | 🔧 §3 改造 |
| `th=aaa` 无效自动转 default | `pick()` 链 + `default` 是 eager 静态引入的内置包，恒在 | ✅ 契约写成明文（§2.3） |
| `th_web=ccc` / `th_app=bbb` 按设备换包 | 词汇映射：`th_web ≡ th_std`、`th_app ≡ th_mobile`；「导航」实为**同路由换容器 + 按设备取 store 意图** | 🔧 词汇映射 + store 化后天然成立 |
| `th_web_color=blue` | 键形 `th_color_std`（配色键 `th_color_<urlKey>`，顺序与版式相反） | ✅ 键形不变 |
| `device=mobile` 锁死 ⇒ `th_web*` 无效 | per-device 意图只对**生效设备**生效 | ✅ 天然成立，用例钉死（§6） |
| web/app 词汇在 `devices.ts` 设置 | urlKey 在 `devices.ts` 声明（`mini`/`tab`/`mobile`/`std`） | ✅ 不改（`std`/`mobile` 即 Spec 的 web/app） |
| `<ThemeView page="login" device="mini">` 的 login/mini 在 `login.ts`/`devices.ts` 设置 | `defineThemePage` + `defineThemeDevice` 纯声明 | ✅ 不动 |
| 全部 store 化，debug 实时替换不改路由 | 配色已如此；**版式 debug 今天写 URL**（`replaceQuery`） | 🔧 §3 改造 |

## 2. 参数契约（唯一真源）

### 2.1 键表

| 参数 | 层 | 含义 | 示例 |
|---|---|---|---|
| `th` | 版式 | 三端通用版式（**版式 id ≡ 主题包名**） | `?th=compact` |
| `th_<urlKey>` | 版式 | 设备专属版式 | `?th_std=compact&th_mobile=default` |
| `th_color` | 配色 | 三端通用配色 | `?th_color=blue` |
| `th_color_<urlKey>` | 配色 | 设备专属配色 | `?th_color_mobile=blue` |
| `device` | 设备 | 设备锁定（§2.4） | `?device=mobile` |
| `debug` | 调试 | 主题调试面板入口（清单 `debug` 开关 + 值命中） | `?debug=theme` |

Spec 词汇 → 实现词汇：`th_web` → `th_std`、`th_app` → `th_mobile`、`th_web_color` → `th_color_std`。
（standard 的 urlKey 是 `std` 不是 `web`，mobile 的是 `mobile` 不是 `app`——2026-10-19 与需求方确认**不改缩写**，继续使用 `mini`/`tab`/`mobile`/`std`。）

### 2.2 urlKey 词汇表（宿主 `src/theme/views/devices.ts` 声明，纯声明）

| 设备 id | label | urlKey | 容器（login 页） | routePath |
|---|---|---|---|---|
| mini | 紧凑版 | `mini` | `view/web/login/MiniLogin.vue` | `mini/<page>` |
| tablet | 平板 | `tab` | `view/tablet/login/index.vue` | `tablet/<page>` |
| mobile | 手机端 | `mobile` | `view/app/login/index.vue` | `m/<page>` |
| standard | 桌面端 | `std` | `view/web/login/StandardLogin.vue` | `<page>` |

🔴 **urlKey ≠ 设备 id**：id 管 `?device=`、容器 glob、routePath；urlKey 只是 URL 参数后缀。两者已在 `defineThemeDevice` 分离，改缩写不动 id。
声明顺序 = 优先级，**末条（standard）是兜底**。

### 2.3 取值链与兜底（每台设备各一条）

```
版式： th_<urlKey>  →  th  →  包声明  →  当前包
配色： th_color_<urlKey>  →  th_color  →  后端下发  →  localStorage  →  该范围兜底配色
```

- **空串 = 未指定**：`?th_std=` 不顶掉 `?th=compact`（部署方常用"这台设备不特殊指定"）。
- **「无效自动转 default」是明文契约**：版式链走到头（无 URL 值、无包声明）时当前包 = `default`——eager 静态引入的内置包，恒在。任何非法 / 缺失的版式 id 都落这里，不报错。
- 非法值（非字符串、未注册 id）由下游 `pick()` 按"落当前包"处理，与历史行为一致。

### 2.4 锁定语义（`?device=<id>`）

- 锁定 = 该次访问的设备身份被钉死，视口 / UA / `?from=` 全部让位。
- **只有锁定设备那条意图链参与解析**：`?device=mobile&th_std=compact&th_color_std=blue` → app 登录页 + default 包 + 默认配色（std 两条全程不参与）。
- 锁定**不报错、不清洗 URL**——旧链接带多余参数是常态，静默忽略是设计。

### 2.5 参数白名单（e2e 守）

允许且仅允许：`th` / `th_<urlKey>` / `th_color` / `th_color_<urlKey>` / `device` / `debug`。
🔴 禁点号旧键（`?view.` / `?theme.` / `?skin.`）复活——2026-10-18 已统一下划线，门禁防回潮。

## 3. 目标设计：版式意图 store 化（本次唯一代码改造）

### 3.1 现状：两条意图链不对称

| | 配色（themeId） | 版式（viewId） |
|---|---|---|
| 读取时机 | URL **一次读入** store（`readUrlIntent`） | **每次渲染**现读 `route.query` |
| 读取处 | store 一处 | `ThemeView` + debug 面板**两处各读各的** |
| debug 改写 | 只写 store，**URL 不变** | 写 URL（`replaceQuery`），地址栏变 |
| 跨容器共享 | store（全局） | 无——各容器自己读 query |

后果：① debug 换版式改地址栏（违反 Spec 最后一条）；②「哪层读哪条键」的规则散落两处；③ 同路由换容器时版式意图靠 query 隐式传递，与 store 化目标相悖。

### 3.2 目标：版式侧与配色侧**完全同形**

```
store.deviceTheme: Map<device, themeId>   ↔   store.deviceView: Map<device, viewId>
store.themeId（通用意图）                   ↔   store.viewIntent（通用意图）
deviceThemeOf(device) / setDeviceTheme(...) ↔  deviceViewOf(device) / setDeviceView(...)
```

- **一次读入**：URL 上 `th` / `th_<urlKey>` 原始值在 store 初始化时读入 `deviceView` + `viewIntent`（与配色侧 `readUrlIntent` 同批）。
- **保持响应**：watch 设备域 `currentQuery()`，仅当 URL 上 `th*` **原始值**变化才同步进 store——`/login → /register` 带不同 `th` 仍生效；debug 改写（只写 store）不产生 URL 变化，不会被 watch 冲掉。
- **API 与配色侧逐字同形**，配置者只记一套规则：「设备专属优先、空串未指定、锁定只挡自动改写」。

### 3.3 消费方改造（两处）

- `ThemeView.vue`：viewId 的 URL 源改读 `store.deviceViewOf(device)`，不再现读路由。
- `useThemeDebugPanel.ts`：`pickView` 从 `replaceQuery` 改为 `store.setDeviceView(device, id)`；`activeViewId` 改读 store 意图。
- ⇒ **debug 换版式从此零路由变化**（Spec 最后一条达成）。

（2026-10-21 补，随 skinsuite 0.5.0：`ThemeView` 新增 `watch(() => props.device, …)` → `store.setActiveDevice`——设备身份与页/版式告知同帧，见 §3.4 与 §6 步骤 6。）

### 3.4 分发与容器：零改动

- 分发器按宿主设备模块（`useRenderDevice()`）选容器（§4），**不做导航透传**——透传反而会丢 debug 的实时修改。
- 分发器**不碰主题**（不 import store、不 `setActiveDevice`）：设备身份由被选中容器内的 `<ThemeView page="…" device="…">` props 告知 store（`setActiveDevice`，与 `setActivePageView` 同帧）——「选哪个容器」与「主题按哪台设备渲染」是同一处事实，不会分家。
- 各容器 `<ThemeView page="login" device="…">` 读 store 里**自己设备**那条意图：
  - 窄屏（mobile）：`th_mobile` 包（Spec 的 `th_app`）
  - 宽屏（standard）：`th_std` 包（Spec 的 `th_web`）
  - mini：`th_mini`，缺席落通用 `th`
- 「窄屏用 th_app 包、宽屏用 th_web 包」= per-device 意图 + 容器分发，**天然成立，无需新机制**。

### 3.5 数据流（目标态）

```
URL ?th / ?th_<urlKey> ──一次读入──▶ store.deviceView + viewIntent ──▶ ThemeView（各容器）
                                          ▲
debug pickView ───setDeviceView───────────┘（零路由变化）
watch currentQuery ──URL 原始值变化才同步──┘
```

## 4. 登录链路全景（目标态）

```
/login?...  或  /m/login?...
   │
   ▼
view/web/login/index.vue（分发器：useRenderDevice() 选容器，不换路由、不碰主题）
   ├─ mobile   → view/app/login/index.vue      <ThemeView page="login" device="mobile">
   ├─ standard → view/web/login/StandardLogin  <ThemeView page="login" device="standard">
   ├─ mini     → view/web/login/MiniLogin      <ThemeView page="login" device="mini">
   └─ tablet   → view/tablet/login/index.vue   <ThemeView page="login" device="tablet">

被选中容器内的 <ThemeView> props（page/device）即告知主题 store：setActivePageView + setActiveDevice
```

主题三通道互不越权：**URL 定初始意图 → store 是唯一运行时真源 → debug 改 store 不改路由**。

## 5. `?theme=dark|light` 废弃契约

### 5.1 现状（两处读取）

| 位置 | 代码 | 语义 |
|---|---|---|
| `view/web/login/MiniLogin.vue` | `appConfig.theme`（L44）+ onMounted `applyTheme`（L139-141） | iframe 弹窗场景父应用透传明暗 |
| `view/web/auth/Consent.vue` | onMounted 读 `route.query.theme` → `applyTheme`（L173-176） | 授权页跟随父应用 |

### 5.2 为什么废弃

1. **两套主题入口并存**：`th_color*` 已覆盖"配色系别（含明暗底色）"，`?theme=` 再开一个明暗覆写通道，配置者要记两套规则。
2. **明暗归属状态机**：`mode`（`system`/`light`/`dark`）由主题状态机掌管——localStorage 持久化 + 调试面板 + 页面内 `toggleTheme`。URL 一次性覆写打破"用户选择优先"。
3. **与 store 化目标冲突**：URL 覆写 store 是配色 / 版式的**初始意图**特例通道；明暗若保留 URL 入口，三条链的规则再次不对称。

### 5.3 废弃行为与时间线

1. **本文档发布（2026-10-19，契约先行）**。
2. 同批实施：移除两处读取（`MiniLogin.vue` / `Consent.vue`）。
3. 之后 `?theme=` = **忽略**：不报错、无效果、不打日志；明暗落状态机默认（`mode=system` 或用户上次选择）。

### 5.4 迁移指引

- 父应用要指定深色 → 走主题状态机既有通道：localStorage 持久化的 `mode` / 调试面板 / 页面内切换。**URL 只保留 `th*` / `device` / `debug`**。
- 宿友应用（firewall / posecraft）拼 SSO 登录链接**不带** `theme=`（已核实），零影响。

### 5.5 影响面

- 代码：仅 oauth21 上述两处。
- 行为：旧带 `?theme=dark` 的已下发链接失去深色效果（落状态机默认）。本文档即知会；依赖旧行为的部署方在迁移完成前不要升级。

## 6. 实施计划（按序，勿跳步）

| # | 步骤 | 内容 | 完成判据 |
|---|---|---|---|
| 1 | 本文档 | 契约先行 | ✅ 已发布（2026-10-19） |
| 2 | 库侧 skinsuite **0.4.0** | 版式意图 store 化（§3）：`deviceView`/`viewIntent`/`setDeviceView`；`ThemeView` + debug 面板改读 store；watch `currentQuery` | 库 build + 单测绿；**无破坏性键变更**（纯 feature） |
| 3 | 宿主 oauth-web | `?theme=` 两处移除（失效）；依赖升 `^0.4.0` | vue-tsc / vitest 绿 |
| 4 | 测试与门禁 | 新用例：`?th_std=x` 仅 standard 生效；`?device=mobile&th_std=x` 锁定后无效；`setDeviceView` 不改 URL；`?theme=dark` 被忽略；参数白名单门禁 | e2e 全绿 |
| 5 | 发布验证 | npm 发布 + CI 双端全绿 | CI 绿 |
| 6 | 设备判定归宿主（2026-10-21，skinsuite **0.5.0**） | 判定改纯函数（`utils/device-resolve.ts`）+ 薄封装（`useRenderDevice`），零主题 import；分发器只选容器不碰主题；`ThemeStoreLike` 补 `activeDevice`/`setActiveDevice`，`<ThemeView>` device prop 告知；库撤全部注册槽 / 判定 composable | 库 build + 单测绿；宿主 vue-tsc / vitest / build 绿；e2e 静态断言改版后全绿 |

## 7. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 版式意图不再逐渲染随 URL 变 | watch `currentQuery` 兜住；回归面 = 跨页带不同 `th` 的链接，用例钉死（步骤 4） |
| `?theme=` 失效后旧链接深色失效 | §5 文档知会 + 迁移指引；回滚 = 恢复两处读取 |
| 0.4.0 需先发 npm 再升宿主 | 任一步红 → 停发，宿主不升；行为可回退 |

## 8. 文档债务（知悉即可）

`multi-theme.md` 的参数章节仍教 2026-10-18 之前的**点号旧名**（`?theme.<设备>` / `?view.<设备>`），已在文首加指向本文的横幅；全文参数修订排期，不挡本次实施。
