# 术语表（theme domain glossary）

> **用途**：主题域概念密度全仓最高，一个词在不同文档里有不同时代印记（`皮肤包` / `主题包`、
> `?view.` / `?th`）。本表收**现行口径**，一词一条：是什么 / 不是什么 / 在哪定义。
> 与代码冲突时以代码为准；与参数键形冲突时以 [login-theme-routing.md](./login-theme-routing.md)（唯一真源）为准。
>
> **读者**：第一次接触本仓主题机制的人；review 时想确认「这个词到底指什么」的人。

## 身份四维（一个主题记录由四段定位）

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **设备 device** | 页面身份维度，四台平级：`mobile` / `standard` / `mini` / `tablet` | mini **不是** mobile 的缩写（独立设备，有自己的容器与目录） | `src/view/devices.ts` 清单（词汇经 `createThemeState({ devices })` 注入 store） |
| **urlKey** | 设备在 URL 参数里的缩写名：`mini` / `tab` / `mobile` / `std`（standard 的缩写是 `std` 不是 `web`，历史约定不改） | 不是设备 id 本身（id 是 `standard`，urlKey 是 `std`）；未声明缩写的设备回落 id | 同左（`DEVICES` 声明的 `urlKey` 字段） |
| **页面 page** | 配色 / 版式的查找范围之一：`login` / `register` / `forgot-password` … | 不是路由 path（`/login` 投影成 `login`） | `src/theme/views/<page>.ts`（`defineThemePage` 声明） |
| **主题包 pkg** | 一套完整设计，**一种版式**：目录名即 id（`default` / `compact`） | 不是「配色集合」（配色住在包的页面下）；版式 id ≡ 包名（`view ≡ pkg`） | `src/theme/themes/<包>/` |
| **四段键** | 注册表键结构 `包/设备/页面/配色` —— 一个主题记录由这四段定位 | 不是 URL 参数（URL 只有六键，见下） | `buildRegistry()`（内核 `skinsuite`） |

## 可换的三样（三段正交的现行说法）

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **版式 view** | 可换的 UI 结构。**加一种版式 = 加一个主题包**（不是加深目录） | `'base'` **不是**合法 view 名；版式层没有独立目录（`<页面>/` 下只有 `index.vue` + `colors/`） | `themes/<包>/<设备>/<页面>/index.vue` |
| **配色 color** | 只换颜色 / 圆角 / 背景，**同 DOM**（black / white / blue / cyan …） | 不换结构；五色并列，**没有「基线配色」这个概念** | `themes/.../colors/<配色>/` |
| **token** | 扁平 CSS 变量值（`--color-*` / `--radius-*` …），注入到 `html` | 不是「两档」（明暗是同一组 token 的两个值域） | 包目录 `tokens` 声明 |
| **皮肤包** | **旧称**，≡ 现在的「主题包」。仅残存于主 README 旧句 | 不是另一个概念 —— 看到它当「主题包」读 | — |

## 明暗与色系

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **mode** | 明暗三态 `system` / `light` / `dark`，用户选择优先，localStorage 持久化 | URL **不能**指定明暗（`?theme=dark` 2026-10-20 已废弃失效，§5 迁移契约） | 主题状态机（内核 `useThemeIntent`） |
| **tone 色系** | 明暗会**单向联动**配色系别（深色整套切到深色系） | tone 不是独立维度 —— 明暗 ≡ 色系（`mode` 是「切到哪一系别」的意图） | 内核 `scheme.ts` |

## 视图层（谁渲染谁）

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **容器 container** | 业务容器，按设备四套（`view/web` / `view/app` / `view/mini` / `view/tablet`），拿数据、调 actions | 不直接读主题机制（经 store / ctx） | `src/view/<设备>/<页面>/index.vue` |
| **分发器 dispatcher** | 每页一个的壳：按**当前设备**选容器（Map + 末条兜底） | 不碰主题参数、不改 URL；「无路由跳转、无参数透传」 | `src/view/web/login/index.vue` 等 |
| **版式组件** | 主题包里的 `<页面>/index.vue`，**只读渲染**：容器传 `ctx`（数据 + actions）进来 | 不发请求、不写 store（只调 `ctx.actions`） | `themes/<包>/<设备>/<页面>/index.vue` |
| **ctx** | 容器传给版式的「数据 + actions」包 | 不是全局 store（版式不直接摸 store） | multi-theme.md §三 职责红线 |

## 设备怎么定（判定在宿主，机制在库）

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **设备判定** | `?device=` 锁定 > `?isMobile` > `?from=` > 视口 > 兜底（standard），纯函数 | **不归主题库**（库零判定词汇，2026-10-21 起判定整体在宿主） | `src/utils/device-resolve.ts` + `useRenderDevice` |
| **`?device=<id>`** | 设备锁定：钉死该次访问的设备身份，视口 / UA 全部让位 | 不报错、不清洗 URL；锁定后其它设备的 `th_*` / `th_color_*` 不生效 | login-theme-routing.md §2.4 |
| **兜底设备** | 分发器 Map 的末条（`standard`）——未知 `?device=` 静默落这里 | 不是 bug 是设计；dev 下调试句柄会喊（见下） | 宿主设备模块 |

## URL 参数（六键白名单，现行键形）

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **`th` / `th_<urlKey>`** | 版式意图键（通用 / 设备专属） | 旧名 `?view.` / `?view.<设备>`（点号）已废 | login-theme-routing.md §2.1 |
| **`th_color` / `th_color_<urlKey>`** | 配色意图键（注意与版式相反的键序，历史约定不变） | 旧名 `?theme.` / `?skin.` 已废 | 同左 |
| **`?theme=dark\|light`** | **已废弃**：明暗归状态机，不经 URL（忽略，不报错） | 不要再教 / 不要再写 | 同左 §5 |
| **空串 = 未指定** | `?th_std=` 不顶掉 `?th=compact`（「这台设备不特殊指定」） | 空串不是「指定为空版式」 | 同左 §2.3 |
| **非法值不回退** | URL 显式非法值（拼错 / 未注册 id）落**当前包**，不回退 theme 档、不抛错 | 不是「落 default」——是落**当前包**（`default` 只是因为恒在才像兜底） | 同左 §2.3 |
| **重复键** | `?th=a&th=b`（router 给数组）：版式键按未指定、配色键取首值 | 不猜用户想要哪个 | 内核 `param-audit.ts` |

## 取值链（优先级，逐字背下来）

```text
版式： th_<urlKey>  →  th  →  包声明(views)  →  当前包
配色： th_color_<urlKey>  →  th_color  →  后端下发  →  localStorage  →  该范围兜底配色
```

- **store 化**：URL 只负责**初始化播种**（一次读入），运行时一切读写走 store；debug 面板改版式只写 store、**不改路由**（2026-10-20 起，与配色侧同形）。

## 机制与基建

| 术语 | 是什么 | 不是什么 | 在哪定义 |
| --- | --- | --- | --- |
| **skinsuite** | 主题内核包（monorepo 里 `packages/theme-core`）：纯逻辑 + `skinsuite/vue` 绑定层 + `skinsuite/vite` 构建插件三个入口 | 不认路由 / store / DOM（Vue 绑定层除外）；**零外部 import**（会造成两份 Vue 实例） | `packages/theme-core/` |
| **virtual:theme** | 构建期虚拟模块：`themeAssets()` 插件扫 `themes/` 生成注册表 + 清单 | 不是运行时请求（编译进 bundle） | 内核 vite 插件 |
| **eager** | `default` 包静态引入、恒在（「无效自动转 default」契约的物理基础） | 非内置包是按需独立 chunk | multi-theme.md §五 |
| **`__MAUTH_STORE__`** | dev + `?debug=theme` 时的只读探针（store 内部 11 键 + `url` / `effectiveView` / `warnings` 三链路键） | 只在 dev 存在（prod 静态消失） | login-theme-routing.md §2.6 |
| **调试句柄** | dev **无门控**的 console 警告：非法版式值 / 未知设备锁定 / 重复键（静默失败不靠「记得开开关」防） | 不是「调试面板」（那是 `?debug=theme` 的 UI） | 同左 §2.6 |
| **`stable-deviceid`** | 设备 ID 工具（扫码登录轮询键），与主题无关的独立小包 | 不是主题机制的一部分 | 根 `packages/stable-deviceid/` |

## 旧名 → 现行名（看到旧词别慌）

| 旧 | 现行 | 说明 |
| --- | --- | --- |
| `?view.<设备>` / `?view=` | `th_<urlKey>` / `th` | 2026-10-18 统一下划线 + urlKey |
| `?theme.<设备>` / `?skin.` | `th_color_<urlKey>` / `th_color` | 同上 |
| `?theme=dark\|light` | （无对应，已废弃） | 明暗归状态机 |
| 皮肤包 | 主题包 | 同义词，现行文档统一用「主题包」 |
| 基线配色 | （无对应，已取消） | 五色并列，无基线 |
