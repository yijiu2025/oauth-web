<script setup lang="ts">
/**
 * 桌面端紧凑「404 页面未找到」（iframe 弹窗场景）—— **业务容器**
 *
 * 与 StandardNotFound 业务完全一致，差异仅在「返回登录」的去向：mini 场景指向
 * `/mini-login`。本文件只负责「404 这件事」，UI 在
 * `theme/themes/<包>/mini/not-found/index.vue`。
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import { computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/theme';
import { ThemeView } from 'skinsuite/vue';
import { safeDecodeURIComponent } from '@/utils/safe-decode';
import { makeTranslate, assertContract } from '@/utils/contract-utils';
import type { NotFoundTranslate, NotFoundViewContext } from '@/theme/views/not-found';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const themeStore = useThemeStore();

/** 尝试提取原始访问的路径（安全 decode，畸形 URL 不抛 URIError） */
const attemptedPath = computed(() => safeDecodeURIComponent(route.fullPath));

/** 返回登录：mini 场景指向 /mini-login */
function goHome() {
  router.replace({ path: '/mini-login' });
}

/** 返回上页：有历史就 back，否则回登录 */
function goBack() {
  if (window.history.length > 1) router.back();
  else goHome();
}

/* ============================================================================
   契约组装（版式渲染已收进 <ThemeView>，本容器只组装 ctx）
   ========================================================================== */

// 契约组装样板（translate/assertContract）收口在 src/utils/contract-utils.ts
const translate: NotFoundTranslate = makeTranslate(t);

const ctx = assertContract<NotFoundViewContext>(
  reactive({
    t: translate,
    title: computed(() => t('not_found.title', '页面未找到')),
    desc: computed(() => t('not_found.desc', '抱歉，您访问的地址不存在。')),
    path: attemptedPath,
    isDark: computed(() => themeStore.isDark),
    actions: {
      goBack,
      goHome
    }
  })
);
</script>

<template>
  <ThemeView page="not-found" device="mini" :ctx="ctx" />
</template>
