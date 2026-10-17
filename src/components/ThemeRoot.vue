<script setup lang="ts">
/**
 * 主题外壳的**宿主接线** —— 把本应用的 store / 授权上下文 / 父 origin 白名单注入内核
 *
 * === 机制已下沉（2026-10-17）===
 * 「挂 dark 类、token 底色、父窗口同步、拉后端配色、挂调试面板」这一整套外壳机制
 * 已经收进内核 `skinsuite/vue` 的 `ThemeRoot`。本文件只负责组装 `ThemeRootHost`：
 *
 *   · `isDark`            → 主题 store 的当前明暗（驱动 `html.dark` 与底色过渡）
 *   · `fetchRemoteConfig` → 后端取数（`@/theme/remote`，宿主策略：端点/超时/静默）
 *   · `applyRemoteConfig` → `themeStore.applyThemeConfig`（落进 store）
 *   · `parentSync`        → 父 origin 白名单（`@/utils/parent-origins`）+ 应用入口
 *   · `debugPanel`        → 调试面板 host（`makeThemeDebugPanelHost`）
 *
 * 换一个宿主，重写的就是这一个 `makeThemeRootHost()`，外壳组件与机制零改动。
 *
 * @author yijiu2025
 * @since 2026-10-17（从同名外壳组件退化为接线壳）
 */
import { ThemeRoot as CoreThemeRoot } from 'skinsuite/vue';
import type { ThemeRootHost } from 'skinsuite/vue';
import { useThemeStore } from '@/stores/theme';
import { fetchRemoteThemeConfig } from '@/composables/remote-theme';
import { makeThemeDebugPanelHost } from '@/composables/useThemeDebugPanel';
import { isAllowedParentOrigin } from '@/utils/parent-origins';

const themeStore = useThemeStore();

const host: ThemeRootHost = {
  isDark: () => themeStore.isDark,
  fetchRemoteConfig: clientId => fetchRemoteThemeConfig(clientId),
  applyRemoteConfig: config => themeStore.applyThemeConfig(config),
  parentSync: {
    isAllowedOrigin: isAllowedParentOrigin,
    apply: config => themeStore.applyThemeConfig(config),
    applyDark: dark => themeStore.applyTheme(dark)
  },
  debugPanel: makeThemeDebugPanelHost()
};
</script>

<template>
  <CoreThemeRoot :host="host">
    <slot />
  </CoreThemeRoot>
</template>
