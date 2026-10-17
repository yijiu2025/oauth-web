/**
 * 页面版式总览 —— **宿主壳**（机制已下沉到 `skinsuite/vue` 的 `createPageIndex`）
 *
 * 机制（「一批页面模块怎么汇总、怎么查询、怎么按路径投影」）已收进内核；本文件只做
 * 三件宿主事实：
 *   1. `import.meta.glob('./*.ts', { eager: true })` —— glob 模式必须是字面量，只能写这里；
 *   2. 设备归一化（`DEFAULT_THEME_DEVICE` + `asThemeDevice`）—— 设备词汇表是宿主事实；
 *   3. 路径投影（`resolveThemePage(themeManifest.routes, path)`）—— 清单是宿主部署事实。
 *
 * 消费者是调试面板（`useThemeDebugPanel` 适配器 → 主题库里的 `ThemeDebugPanel`）。
 *
 * ⚠️ 注释里不要写出「星号紧跟斜杠」的两个字符：它会提前闭合本段块注释。
 *
 * @author yijiu2025
 * @since 2026-10-17（机制下沉内核，本文件退化为壳）
 */
import { createPageIndex } from 'skinsuite/vue';
import { DEFAULT_THEME_DEVICE, asThemeDevice } from './devices';
import { resolveThemePage } from 'skinsuite';
import { themeManifest } from '@/theme-manifest';

/** 各页面的版式模块（`./login.ts`、`./register.ts` 等） */
const registryModules = import.meta.glob<Record<string, unknown>>('./*.ts', {
  eager: true
});

export type { PageViews } from 'skinsuite/vue';

/** 页面索引单例：glob 结果 + 设备归一化 + 路径投影 → 全套查询函数 */
const index = createPageIndex(registryModules, {
  defaultDevice: DEFAULT_THEME_DEVICE,
  asKnownDevice: asThemeDevice,
  resolvePage: path => resolveThemePage(themeManifest.routes, path),
  onWarn: import.meta.env.DEV ? console.warn : undefined
});

/** 所有接了可换 UI 的页面（按页面名排序） */
export const listPageViews = index.listPageViews;

/** 按页面名取；该页面未接入版式机制时返回 undefined */
export const viewsForPage = index.viewsForPage;

/**
 * 路径 → 页面名，**由主题清单的 `routes` 投影决定**
 *
 * 未投影的路径返回 undefined；清单与页面注册表的一致性由关卡守着。
 */
export const pageFromPath = index.pageFromPath;
