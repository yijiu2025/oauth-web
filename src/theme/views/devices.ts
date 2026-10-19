/**
 * 设备清单 —— **纯声明**（判定不在这里）
 *
 * === 本目录的性质：只放声明，不放运行时判断 ===
 * `src/theme/` 是主题域（`themes/` + `views/` + `theme.config.ts`），**整包可以搬到另一个
 * 前端**。`views/*.ts` 会被 `virtual:theme` 当声明副作用 import，所以这里只能有
 * `defineThemeDevice` / `defineThemePage` 这类**声明**，不能有业务判断 ——
 * 否则判定代码会跟着主题域被打进包，而且「主题域可整体迁移」也不再成立。
 *
 * 于是：
 *   · 「有哪些设备、容器在哪、占哪条路由」→ **本文件**（声明事实）
 *   · 「当前属于哪台设备」→ `src/utils/device-resolve.ts`（宿主判定口径：`?device=` /
 *     `?isMobile` / `?from=` / 视口 + UA）
 *   · 「设备域机制」→ `skinsuite/vue`（只收 `resolveDevice` 注入，不认识任何词汇）
 *
 * === 声明顺序 = 优先级，末条是兜底 ===
 * 库的 `fallbackDevice()` / `resolveContainerOf()` 都取**末条**（不写死设备名），
 * 所以 `standard` 必须留在最后。
 *
 * === 本文件是副作用模块 ===
 * 声明即注册进设备域：由 `stores/theme.ts` 的 `import 'virtual:theme'` 拉齐；
 * `bootstrap.ts` 也在 `app.use(theme)` 之前显式 import 它（判定函数要用到已注册清单）。
 *
 * @author yijiu2025
 * @since 2026-09-27（2026-10-17 机制下沉内核；2026-10-18 改用 defineThemeDevice 自动注册）
 * @since 2026-10-19（**判定撤出本文件** → `utils/device-resolve.ts`；这里回到纯声明）
 */
import type { Component } from 'vue';
import { THEME_ID_RE } from 'skinsuite';
import { defineThemeDevice } from 'skinsuite/vue';

defineThemeDevice({
  id: 'mini',
  label: '紧凑版',
  urlKey: 'mini',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'),
    fileRe: /^Mini/,
    idRe: THEME_ID_RE
  },
  routePath: page => `mini/${page}`
});

defineThemeDevice({
  id: 'tablet',
  label: '平板',
  urlKey: 'tab',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/tablet/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  },
  routePath: page => `tablet/${page}`
});

defineThemeDevice({
  id: 'mobile',
  label: '手机端',
  urlKey: 'mobile',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  },
  routePath: page => `m/${page}`
});

defineThemeDevice({
  id: 'standard',
  label: '桌面端',
  urlKey: 'std',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'),
    fileRe: /^Standard/,
    idRe: THEME_ID_RE
  },
  routePath: page => page
});
