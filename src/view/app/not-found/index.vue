<script setup lang="ts">
/**
 * 移动端「404 页面未找到」—— **业务容器**（/m/* 未匹配时的兜底形态）
 *
 * === 分层（2026-10-19，与登录/注册/忘记密码三页对齐）===
 * 本文件只负责「404 这件事」：提取访问路径、决定「返回上页」还是「回登录」。
 * **页面长什么样不在这里**，而在**当前主题包**里的版式组件里：
 *
 *    本容器 ──传 ctx──▶ theme/themes/<包>/mobile/not-found/index.vue
 *                 ▲
 *                 └── 契约定在 theme/views/not-found.ts（各包共用这一份，版式只读它）
 *
 * 与桌面版的差异（刻意为之）：
 *   - 「返回登录」直连 `/m/login`（移动端全屏直达，不被视口改写）
 *   - 全屏布局用 `mauth-*` 样式体系（`mobile-auth.scss`），与移动端三页同源
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import { computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/theme';
import { ThemeView } from 'skinsuite/vue';
import type { NotFoundTranslate, NotFoundViewContext } from '@/theme/views/not-found';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const themeStore = useThemeStore();

/** 尝试提取原始访问的路径（decode 防止双重编码） */
const attemptedPath = computed(() => decodeURIComponent(route.fullPath));

/** 返回登录：移动端直连 /m/login */
function goHome() {
  router.replace({ path: '/m/login' });
}

/** 返回上页：有历史就 back，否则回登录 */
function goBack() {
  if (window.history.length > 1) router.back();
  else goHome();
}

/* ============================================================================
   契约组装（版式渲染已收进 <ThemeView>，本容器只组装 ctx）
   ========================================================================== */

function assertNotFoundContract(ctx: NotFoundViewContext): NotFoundViewContext {
  return ctx;
}

const translate: NotFoundTranslate = (key, params) => {
  if (params === undefined) return t(key);
  return typeof params === 'string' ? t(key, params) : t(key, params as never);
};

const ctx = assertNotFoundContract(
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
  <ThemeView page="not-found" device="mobile" :ctx="ctx" />
</template>
