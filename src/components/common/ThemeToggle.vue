<script setup lang="ts">
/**
 * 主题切换浮按钮组件
 *
 * 浮在视口底部中央，点击切换深浅色主题。
 * iframe 嵌入时不显示（避免遮挡父页面），由 AuthContainer 控制。
 *
 * @author yijiu2025
 * @since 2026-08-30
 */
import { useThemeStore } from '@/stores/theme';
import Icons from './Icons.vue';

const themeStore = useThemeStore();
</script>

<template>
  <button
    @click="themeStore.toggleTheme()"
    class="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--mauth-surface)] shadow-lg border border-[color:var(--mauth-border)] text-sm font-medium text-[color:var(--mauth-text-body)] hover:scale-105 active:scale-95 transition-all z-50"
    :title="themeStore.isDark ? '切换到浅色' : '切换到深色'"
  >
    <Icons v-if="themeStore.isDark" name="moon" :size="16" />
    <Icons v-else name="sun" :size="16" />
    <span>{{ themeStore.isDark ? 'Dark Mode' : 'Light Mode' }}</span>
  </button>
</template>
