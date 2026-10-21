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
 *   · 「有哪些设备、容器在哪」→ **本文件**（声明事实）
 *   · 「当前属于哪台设备」→ 宿主设备模块（`utils/device-resolve.ts` 判定 +
 *     `composables/useRenderDevice` 接线），页面分发器据此选容器
 *   · 「设备身份怎么进主题」→ 被选中容器内的 `<ThemeView page="…" device="…">` props
 *     告知 store（`setActiveDevice`）；库不认识任何判定词汇
 *
 * === 声明顺序 = 优先级，末条是兜底 ===
 * 库的 `fallbackDevice()` / `resolveContainerOf()` 都取**末条**（不写死设备名），
 * 所以 `standard` 必须留在最后。
 *
 * === 本文件是副作用模块 ===
 * 声明即注册进设备域：由 `stores/theme.ts` 的 `import 'virtual:theme'` 拉齐；
 * `bootstrap.ts` 也在 `app.use(theme)` 之前显式 import 它（分发器与 store 的
 * 设备清单 / 兜底设备来自已注册清单）。
 *
 * @author yijiu2025
 * @since 2026-09-27（2026-10-17 机制下沉内核；2026-10-18 改用 defineThemeDevice 自动注册）
 * @since 2026-10-19（**判定撤出本文件** → `utils/device-resolve.ts`；这里回到纯声明）
 * @since 2026-10-20（判定消费方改为宿主设备模块 + 分发器；主题经 ThemeView props 接收）
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
  }
});

defineThemeDevice({
  id: 'tablet',
  label: '平板',
  urlKey: 'tab',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/tablet/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  }
});

defineThemeDevice({
  id: 'mobile',
  label: '手机端',
  urlKey: 'mobile',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  }
});

defineThemeDevice({
  id: 'standard',
  label: '桌面端',
  urlKey: 'std',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'),
    fileRe: /^Standard/,
    idRe: THEME_ID_RE
  }
});
