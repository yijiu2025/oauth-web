/**
 * 主题域**运行时装配** —— 宿主的**唯一装配点**（机制全在 `skinsuite`，这里只注入宿主事实）
 *
 * === 一次性做三件事（不再分散到两处）===
 *   1. **注册表安装**（模块求值期的副作用）：`buildThemeRegistry` + `installThemeRegistry`
 *      —— 虚拟模块的三个加载表 + 设备白名单 → 内核模块级单例。
 *      ⚠️ 任何 store / 查询函数都依赖它已就绪。本文件 import 即装。
 *   2. **清单单例**：`resolveThemeManifest` 兜底（目录没写 `theme.config.ts` 时用默认值）。
 *   3. **设备同步**（`initThemeDomain`）：建立「设备身份 → store」的 watch，
 *      `bootstrap.ts` 只调一行 `initThemeDomain({...})`。
 *
 * === 为什么合并（2026-10-17）===
 * 此前 `setupTheme`（skinsuite/vue）与 `@/theme-manifest`（副作用 import）是**两处**装配：
 * 「设备同步」在 bootstrap 调、「注册表安装」靠 import 的模块求值期副作用。
 * 改一个考另一个 → "漏了副作用 import 就静默失效"（memory 里已踩过）。
 * 现在 `initThemeDomain` 是本文件的导出 → import 它的那一刻注册表必然已装。
 *
 * @author yijiu2025
 * @since 2026-10-17（原 theme/index.ts + theme/manifest.ts + bootstrap 的 setupTheme 合并而来）
 */
import {
  buildThemeRegistry,
  installThemeRegistry,
  resolveThemeManifest
} from 'skinsuite';
import type { ResolvedThemeManifest } from 'skinsuite';
import {
  colors as colorModules,
  manifest,
  packages as packageModules,
  styles as colorStyles
} from 'virtual:theme';
import { asThemeDevice } from '@/theme/views/devices';
import { setupTheme } from 'skinsuite/vue';

/* ---------------------------------------------------------------------------
 * 1. 注册表安装（模块求值期的副作用）—— import 本文件即装
 * ------------------------------------------------------------------------- */

installThemeRegistry(
  buildThemeRegistry(
    { packages: packageModules, colors: colorModules, styles: colorStyles },
    raw => asThemeDevice(raw) !== null,
    import.meta.env.DEV ? console.warn : undefined
  )
);

/* ---------------------------------------------------------------------------
 * 2. 清单单例
 * ------------------------------------------------------------------------- */

/** 生效中的主题域清单（没有 theme.config.ts 时是机制默认值） */
export const themeManifest: ResolvedThemeManifest = resolveThemeManifest(manifest);

/* ---------------------------------------------------------------------------
 * 3. 设备同步（运行时装配入口）—— bootstrap.ts 只需调这一行
 * ------------------------------------------------------------------------- */

export interface InitThemeDomainOptions {
  /** 当前设备身份从哪来（宿主定义；如路由 meta.device） */
  deviceSource(): string;
  /** 设备变化时写回哪里（如 themeStore.setActiveDevice） */
  setDevice(device: string): void;
}

/**
 * 初始化主题域（注册表已在模块求值时装好，这里只接设备同步）
 *
 * @example
 * ```ts
 * import { initThemeDomain } from '@/theme-manifest';
 *
 * initThemeDomain({
 *   deviceSource: () => router.currentRoute.value.meta.device === 'mobile' ? 'mobile' : 'standard',
 *   setDevice: device => useThemeStore().setActiveDevice(device as ThemeDevice)
 * });
 * ```
 *
 * @since 2026-10-17（合并 setupTheme + theme-manifest 副作用 import，从此宿主只调一行）
 */
export function initThemeDomain(options: InitThemeDomainOptions): void {
  setupTheme({ ...options, manifestRoutes: themeManifest.routes });
}
