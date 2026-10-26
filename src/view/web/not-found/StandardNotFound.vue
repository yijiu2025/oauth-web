<script setup lang="ts">
/**
 * 桌面端标准「404 页面未找到」—— **业务容器**
 *
 * === 分层（2026-10-19，与登录/注册/忘记密码三页对齐）===
 * 本文件只负责「404 这件事」：提取访问路径、决定「返回上页」还是「回登录」。
 * **页面长什么样不在这里**，而在**当前主题包**里的版式组件里：
 *
 *    本容器 ──传 ctx──▶ theme/themes/<包>/standard/not-found/index.vue
 *                 ▲
 *                 └── 契约定在 theme/views/not-found.ts（各包共用这一份，版式只读它）
 *
 * 于是「换一套 UI」= 在包里加一个版式目录，本文件零改动。
 * **内置包**（`default`）的 base 由内核 eager 静态引入，首帧零请求。
 *
 * === 设备身份 ===
 * 默认 `standard`（文件位置即身份）。其它设备（如 tablet）复用本容器的业务时
 * 通过 `device` prop 覆盖 —— 避免复制业务。
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

/** 本容器的设备身份（tablet 复用业务时覆盖为 tablet） */
const props = withDefaults(defineProps<{ device?: string }>(), { device: 'standard' });

/** 尝试提取原始访问的路径（安全 decode，畸形 URL 不抛 URIError） */
const attemptedPath = computed(() => safeDecodeURIComponent(route.fullPath));

/** 返回登录：标准桌面场景去 /login */
function goHome() {
  router.replace({ path: '/login' });
}

/** 返回上页：有历史就 back，否则回登录（直接打开时 back 会离开站点甚至白屏） */
function goBack() {
  if (window.history.length > 1) router.back();
  else goHome();
}

/* ============================================================================
   契约组装（版式渲染已收进 <ThemeView>，本容器只组装 ctx）
   ========================================================================== */

// 契约组装样板（translate/assertContract）收口在 src/utils/contract-utils.ts
/** 翻译函数：只把「key + （命名参数 | 兜底文案）」这一子集交给版式 */
const translate: NotFoundTranslate = makeTranslate(t);

/** 交给版式的上下文（reactive：契约里声明的标量，在容器里是 ref，reactive 自动解包） */
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
  <ThemeView page="not-found" :device="props.device" :ctx="ctx" />
</template>
