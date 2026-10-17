# 主题域配置设计（theme domain）

> 状态：**已落地**（2026-10-17，目录口径定为「主题根目录」）
> 目标：把"主题相关的一切"收进**一个目录 + 一次初始化**，App.vue 只剩路由舞台，
> 调试开关与路由映射变成数据而不是代码。
> 关联：[多主题开发模式](./multi-theme.md)（规则）、[抽包立项](../../docs/standards/theme-package-extraction.md)（分层依据）。

## 一、要解决的问题

现在"主题"这件事分散在**六个地方**，改一个概念要同时动多处，漏一处就是静默半生效：

| 概念 | 现在住在哪 | 问题 |
| --- | --- | --- |
| 主题目录 | `import.meta.glob('./themes/...')` 字面量 | 目录写死在源码里，改不了 |
| 默认包 / 默认色 / 参数名 | `packages/theme-core/src/constants.ts` | 想改要发内核版本 |
| 路由 → 页面名 | `src/theme/views/pages.ts` 的 `pageFromPath()` | 加一个页面要改代码 |
| 路由 → 设备 | `router/routes.ts` 的 `meta.device` | 与上一条两套世界观 |
| 调试面板开关 | `App.vue` 里读 `route.query.debug` | 开关是代码不是配置 |
| 面板 / 父窗口同步 | `src/components/dev/`、`src/composables/` | 与应用耦合，换应用要重写 |

目标形态：**目录由环境变量给、开关与路由由目录里的配置文件给、其余全是主题包。**

## 二、目标结构

```
oauth21/
├── .env                                 ← ① 目录：VITE_THEME_DIR
├── src/
│   ├── bootstrap.ts                     ← ② 初始化：setupTheme()
│   ├── App.vue                          ← 只剩 <ThemeRoot> + router-view
│   └── theme/                           ← ③ 主题**根目录**（VITE_THEME_DIR 默认指这里）
│       ├── theme.config.ts              ←    域清单：debug / routes（与 themes、views 平级）
│       ├── themes/                      ←    主题包目录（**固定子目录名**，插件扫这里）
│       │   ├── default/                 ←      主题包 = 一种版式
│       │   │   ├── index.ts
│       │   │   ├── mobile/login/{index.vue,colors/white/...}
│       │   │   ├── standard/login/...
│       │   │   └── mini/login/...
│       │   └── compact/
│       ├── views/                       ←    版式契约目录（**固定子目录名**，不扫）
│       │   ├── login.ts / register.ts / forgot-password.ts
│       │   └── registry.ts / picker.ts / page.ts / pages.ts / params.ts
│       ├── devices.ts                   ←    设备清单（随应用走，天然在根目录）
│       ├── registry.ts                  ←    配色注册表构建（读虚拟模块）
│       ├── index.ts                     ←    查询层 + re-export 壳
│       ├── setup.ts                     ←    setupTheme（bootstrap 里唯一主题接线）
│       ├── ThemeRoot.vue                ←    暗色类 / token 容器 / 父窗口同步 / 面板
│       ├── useThemeDebugPanel.ts        ←    面板适配器（宿主世界观）
│       ├── manifest.ts                  ←    清单运行时入口（单例）
│       └── remote.ts                    ←    后端配色取数（策略）
└── config/theme-assets-plugin.ts        ← 构建期适配器（扫 env 指的根目录下的 themes/）
```

三条边界：

1. **`.env` 只放路径**。部署方/构建方决定"主题根目录在哪"，一行环境变量。
2. **`theme/theme.config.ts` 放策略**。开关、路由投影 —— 住在**根目录**，与 `themes/`、
   `views/` 平级，复制一个主题域就带着配置走。
3. **主题包内不放配置**。包只描述"我长什么样"，不描述"什么时候启用我"。

**根目录内的三个固定名字**（约定俗成，换根目录位置时整包跟着走）：

| 名字 | 是什么 | 谁扫它 |
| --- | --- | --- |
| `theme.config.ts` | 域清单（debug + routes） | 构建插件（虚拟模块 `manifest` 导出） |
| `themes/` | 主题包目录 | 构建插件（虚拟模块 `packages`/`colors`/`styles`） |
| `views/` | 版式契约目录 | `views/pages.ts` 自己的 `import.meta.glob('./*.ts')` |

`themes` 是**固定子目录名**（不是可配置项）：`views/*.ts` 里
`import.meta.glob('/src/theme/themes/...')` 的字面量依赖它稳定，所以插件扫描包目录时
也认这个名字 —— 两者靠「名字固定」对齐，不靠配置。同理 `views` 也是固定名。

## 三、配置契约

### 3.1 `.env` —— 只声明根目录

```dotenv
# 主题根目录（相对项目根；构建期扫描，运行期不读）
VITE_THEME_DIR=src/theme
```

- 缺省回落 `src/theme`（没配也能跑，DX 优先），构建时打一条 `info`。
- 只有**构建期**用：`vite.config.ts` 用 `loadEnv()` 读出后交给插件；运行期代码不碰 env
  —— 避免"改 env 要重启、但运行期读的是旧值"这类不一致。
- 根目录里没有 `theme.config.ts` 时按空配置处理，不报错（允许极简项目只有主题包）。

### 3.2 `theme/theme.config.ts` —— 域清单

```ts
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  /** 调试面板：off | url | always（缺省 url） */
  debug: {
    enabled: 'url',                 // 见下方「三档语义」
    query: 'debug',                 // 触发参数名
    value: 'theme'                  // 触发参数值 → ?debug=theme
  },

  /** 路由投影：路径 → 页面（主题解析的唯一依据） */
  routes: [
    { path: '/login',           page: 'login' },
    { path: '/register',        page: 'register' },
    { path: '/forgot-password', page: 'forgot-password' },
    { path: '/m/:page',         page: ':page' },
    { path: '/mini-login',      page: 'login' }
  ]
});
```

**`debug.enabled` 三档语义**

| 值 | 构建产物里面板是否下载 | 何时可用 | 用途 |
| --- | --- | --- | --- |
| `off` | 永不 | 不可用 | 对外交付的严肃部署 |
| `url`（缺省） | 带参数才下载 | `?debug=theme` | **生产默认**：真机没有 DevTools，线上排查"这个租户颜色不对"是刚需 |
| `always` | 首次渲染即下载 | 总是 | 演示 / 联调环境 |

> 为什么不设"仅 dev"：本项目的反复痛点就是"真机出问题看不见"。面板只暴露主题名与色值，
> 它们本来就在前端产物里，不构成信息泄露。真要关，就把 `enabled` 设 `off`。

**`routes` 的作用与边界**

- 它是**投影**，不是路由表：真正的路由仍由 `router/routes.ts` 定义（路径、守卫、懒加载）。
  主题只关心"这条路径属于哪个页面"，因为配色与版式的查找范围由它们决定。
- 🔴 **清单里刻意没有「设备」**：设备由宿主的路由元信息基线（`meta.device`）+
  渲染形态分发器决定（见 `router/index.ts` 的 `setupTheme` 与 `view/web` 分发器）。
  清单再声明一份就是第二个真相 —— 两处不一致时没有任何报错，只有"配色找错范围"
  这种无从归因的症状。设备清单本身在 `src/theme/devices.ts`（随应用走，天然在根目录）。
- ⚠️ **两处必须一致**：`routes` 里出现的每个路径都必须真的存在于 `router/routes.ts`，
  反之每个"挂了配色"的页面都必须有投影。这条由关卡机械比对（见 §六），
  否则会出现"切换页面后主题不跟着变"这种无从归因的静默 bug。
- 支持 `:param` 段：`/m/:page` 命中 `/m/login` → `page='login'`。等价于现在的
  `pageFromPath()`，但变成声明。

### 3.3 主题包（不变）

```
themes/<包>/index.ts                             包定义：meta + 可选 views/coverage
themes/<包>/<设备>/<页面>/index.vue               该包在该设备的唯一版式
themes/<包>/<设备>/<页面>/colors/<配色>/index.ts  配色 tokens
themes/<包>/<设备>/<页面>/colors/<配色>/theme.scss 惰性样式
```

仍然是「**一个主题包 = 一种版式**」，不变。

## 四、初始化：`bootstrap.ts` 一次搞定

```ts
// src/bootstrap.ts
import { setupTheme } from '@/theme/setup';

export function bootstrap() {
  const app = createApp(App);
  app.use(pinia);
  app.use(router);
  app.use(i18n);

  // 主题域初始化：在 mount 之前完成首帧应用（实例化主题 store → 存量 watch 立即执行）
  setupTheme({ router });

  // …其余装配
  router.isReady().then(() => app.mount('#app'));
}
```

`setupTheme()` 做两件事：

1. **设备基线同步**：watch `router.currentRoute` 的 `meta.device`，把「当前路由属于哪种
   设备」同步给主题 store（`/m/*` → mobile，其余 standard）。这是**基线**，会被桌面
   分发器按实际渲染形态纠正。
2. **实例化主题 store**：明暗类、`data-mauth-theme`、CSS 变量都在 store 的
   `watch(immediate)` 里，实例化就等于让它们跑起来 —— 所以必须在 `app.mount()` 之前
   调用，首帧才是终态（否则会先渲染基线色再跳变）。

清单（`theme.config.ts`）的加载发生在**模块求值期**：`manifest.ts` 从虚拟模块读，
`defineThemeManifest` 的错误启动就炸。清单缺失时退回机制默认值（面板 `url` 档、无路由投影）。

`App.vue` 之后只剩：

```vue
<script setup lang="ts">
import ThemeRoot from '@/theme/ThemeRoot.vue';
</script>

<template>
  <ThemeRoot>
    <router-view v-slot="{ Component }">
      <Transition name="page">
        <div class="route-stage" :key="$route.fullPath">
          <component :is="Component" />
        </div>
      </Transition>
    </router-view>
  </ThemeRoot>
</template>
```

`ThemeRoot` 负责：暗色类、token 底色容器、父窗口主题同步、后端配色拉取、调试面板挂载。

## 五、库的分层与调试面板

```
skinsuite               纯机制（零运行时依赖）：常量 / 类型 / token 校验 / 配置 / 形状归一
skinsuite/vue           Vue 绑定（peer: vue）：useParentThemeSync + 面板 props 契约
skinsuite/vue/panel     只导出面板组件，专供 defineAsyncComponent（独立 chunk）
```

调试面板改成**纯展示组件**：`model`（当前页面/设备/版式/配色/明暗）+ `actions`
（pickDevice / pickView / pickColor / pickMode / reset）。它不读路由、不读 store ——
「点版式改哪个 query」是宿主的 `useThemeDebugPanel.ts`，约 100 行。

为什么必须这样拆：面板一旦自己 `useRoute()`，就绑死了 vue-router 的 query 语义，
换一个宿主（Next / Nuxt / 多页应用）就得重写整个面板；而且它无法在单测里喂假数据。

样式用 **scoped CSS 而不用 Tailwind**：库不能假定宿主装了 Tailwind，也不该让宿主的
`@source` 扫描范围决定库组件长什么样。

## 六、判据（新增 / 需要改的关卡）

| 判据 | 内容 |
| --- | --- |
| 配置合法性 | `theme.config.ts` 的 `debug/routes/defaults` 形状正确；非法 id 在**声明期**抛错 |
| 路由一致性（新） | manifest 的每个 `path` 在 `router/routes.ts` 里存在；每个挂了配色的 `page` 有投影；反之亦然 |
| 首屏不加载面板 | 不带 `?debug=theme` 时主包**不含** `data-mauth-debug`（已实测：面板独立 chunk `panel-*.js`，主包 0 命中） |
| 首帧即终态 | 首屏 HTML 的 `html.dark` / `data-mauth-theme` 与最终态一致（不闪色） |
| 目录口径 | 现有 `verify-theme-dirs`（552 项）继续跑，`themesDir` 从 env 取 |
| 别名一致性 | `verify-alias-single-source` 增加 `skinsuite/vue` / `skinsuite/vue/panel` 两条 |

## 七、迁移分期

| 期 | 内容 | 风险 | 状态 |
| --- | --- | --- | --- |
| A | 库：`manifest.ts`（`defineThemeManifest`/`resolveThemePage`）、`remote-config.ts`、`vue/` 三件套 | 低（纯新增） | ✅ 完成 |
| B | 宿主：插件读 env、`theme/theme.config.ts` 落地、`registry.ts` 改读虚拟模块、`VITE_THEME_DIR` 指向根目录 | 中（首屏构建链） | ✅ 完成 |
| C | 宿主：`setupTheme()` + `bootstrap.ts` 接线 + `App.vue` 瘦身 | 中（首帧时序） | ✅ 完成 |
| D | 关卡：新增路由一致性；e2e 全量重写 | 低（但要跑一轮） | ⏳ e2e 用户说做再做 |
| E | 把 `views/<page>.ts`（版式注册表）也搬进 `themes/`（可选） | 高（改 40+ 处 import） | ❌ 已决定不做 |

## 八、最终敲定的决定

1. **`views/` 不搬**。它声明"某页有哪些版式、各自怎么加载"，是**代码**（含 `import()`
   加载器），且 40+ 处 import 要改。`src/theme` 本身就是主题根目录，`views/` 已在根下，
   天然满足"版式契约归主题根目录"。manifest 的 `routes` 承担"页面清单"。

2. **`debug.enabled` 缺省 `url`**。生产也能用 URL 打开面板（线上排查刚需）。

3. **`routes` 只做投影**。路由定义仍归 router，manifest 声明"路径 → 页面"。
   由一致性关卡（`__tests__/theme-manifest.test.ts`）比对，不接管 router。

4. **`VITE_THEME_DIR` 指向主题根目录**（`src/theme`），不是主题包目录。
   根目录下 `themes/`（主题包）、`views/`（版式契约）、`theme.config.ts`（清单）三个
   固定名字；设备清单 `devices.ts` 随应用走、天然在根目录。

## 相关

- [多主题 / 多版式开发模式](./multi-theme.md) —— 目录约定、选择优先级、安全边界。
- [主题框架抽包立项](../../docs/standards/theme-package-extraction.md) —— 内核与壳的分层依据。
