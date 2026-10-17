/**
 * 调试面板的**宿主接线** —— 把本应用的 store / router / 页面机制翻译成内核 host
 *
 * === 机制已下沉（2026-10-17）===
 * 面板适配器（「把状态算成 model、把动作落到 URL 和 store」这段翻译逻辑）已经收进
 * 内核 `skinsuite/vue` 的 `useThemeDebugPanel(host)`。本文件只负责组装那个 `host`：
 * 把本应用的三个事实注入进去，**不再持有任何翻译逻辑**。
 *
 *   · 读侧：当前路由（`useRoute`）、主题 store（`useThemeStore`）、页面版式机制
 *     （`@/theme/views/pages`）、配色查询（`@/theme`）、设备词汇表（`./devices`）；
 *   · 写侧：换版式改 URL（保留 `client_id`）、换色/换明暗写 store。
 *
 * 换一个宿主，重写的就是这几十行「来源 / 目标」接线，而不是一百多行翻译。
 *
 * ⚠️ 本文件是「接线胶水」，不是「机制」：内核 `useThemeDebugPanel` 才是机制唯一实现。
 *   要改「面板怎么算版式 / 怎么落 URL」，去内核；这里只改「本应用从哪读、写到哪」。
 *
 * @author yijiu2025
 * @since 2026-10-17（从同名适配器文件退化为接线壳）
 */
import { useRoute, useRouter } from 'vue-router';
import { useThemeDebugPanel as coreUseThemeDebugPanel } from 'skinsuite/vue';
import type { ThemeDebugPanelHost } from 'skinsuite/vue';
import { listColorViews, listColorsOf, toneOfColor, type ThemeMode } from 'skinsuite';
import { useThemeStore } from '@/stores/theme';
import { deviceLabel, THEME_DEVICES, type ThemeDevice } from '@/theme/views/devices';
import { themeManifest } from '@/theme-manifest';
import { pageFromPath, viewsForPage } from '@/theme/views/pages';
import { readDeviceParam } from 'skinsuite';

/**
 * 组装调试面板的 host —— 把本应用的 store / router / 页面机制注入进内核 host
 *
 * 单独抽出来是为了让 `ThemeRoot` 也能复用它（外壳把面板 host 一并传给内核），
 * 避免「面板 host 的组装」和「面板的调用」耦合在一起。
 */
export function makeThemeDebugPanelHost(): ThemeDebugPanelHost {
  const route = useRoute();
  const router = useRouter();
  const themeStore = useThemeStore();

  /** 把当前 query 复制一份（保留 `client_id` 等授权上下文），只增删目标那一项 */
  const replaceQuery = (patch: Record<string, string | undefined>): void => {
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(route.query)) {
      if (typeof value === 'string') query[key] = value;
      else if (Array.isArray(value)) query[key] = value.filter((x): x is string => typeof x === 'string');
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete query[key];
      else query[key] = value;
    }
    void router.replace({ query });
  };

  return {
    path: () => route.path,
    query: () => route.query as Record<string, unknown>,

    store: {
      packageId: () => themeStore.packageId,
      activePage: () => themeStore.activePage,
      activeDevice: () => themeStore.activeDevice,
      themeRecordFor: (pkg, device, page) =>
        themeStore.themeRecordFor(pkg, device as ThemeDevice, page),
      viewFor: (page, device) => themeStore.viewFor(page, device as ThemeDevice),
      themeId: () => themeStore.themeId,
      mode: () => themeStore.mode
    },

    replaceQuery,
    setTheme: id => themeStore.setTheme(id),
    setMode: mode => themeStore.setMode(mode as ThemeMode),

    devices: THEME_DEVICES,
    deviceLabel,

    manifest: { debug: themeManifest.debug },

    pageFromPath,
    viewsForPage,
    listColorsOf,
    toneOfColor,
    listColorViews,
    readDeviceParam
  };
}

/** 组装 host 并调用内核 `useThemeDebugPanel`（薄包装，保留无参调用面） */
export function useThemeDebugPanel() {
  return coreUseThemeDebugPanel(makeThemeDebugPanelHost());
}
