<script setup lang="ts">
/**
 * 登录页分发器（/login 与 /m/login 共用）
 *
 * 按「当前设备形态」挑渲染哪个容器：mobile → view/app/login、mini → MiniLogin、
 * standard/tablet → StandardLogin。设备判定是**宿主自己的模块**（2026-10-20）：
 * `utils/device-resolve.ts`（视口 + URL 词汇，零主题依赖）经
 * `composables/useRenderDevice` 接成响应式，本分发器据此选容器。
 *
 * 🔴 分发器**不碰主题**：不 import store、不 `setActiveDevice`。设备身份由被选中
 *    容器内的 `<ThemeView page="login" device="mini">` props 告知主题 store ——
 *    「选哪个容器」与「主题按哪台设备渲染」因此不会分家（同一个 props，同帧生效）。
 *
 * 主题 / 语言等 query 参数（`?lang=` / `?th_color=` / `?appName=` / `?qrCodeFirst=` …）
 * 由子容器（MiniLogin / StandardLogin）自己用 `useRoute().query` 读，本分发器不中转。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { postToParent } from '@/utils/parent';
import { device } from '@/view/devices';

const route = useRoute();

/** 父应用是否禁用 SSO_READY 消息（`?notLoadSsoView=true`） */
const notLoadSsoView = ref(false);

// 只保留本分发器真正要用的 query 参数；lang/theme/appName 等由子容器自己读 route.query。
watch(
  () => route.query,
  query => {
    notLoadSsoView.value = query.notLoadSsoView === 'true';
  },
  { immediate: true, deep: true }
);

// 设备页装配（判定 + 容器 Map + 末条兜底 + 挂载预热，四页共用，见 useDevicePage）
const activeComponent = device.useDevicePage('login');

// 组件挂载后执行
onMounted(() => {
  // SSO_READY 统一在此发送（dispatcher 入口），子组件不再重复发。
  // 父窗口收到后关 loading + 同步主题。
  // （各设备容器的预热已收进 useDevicePage，这里只管 SSO。）
  if (shouldSendSSOMessage.value) {
    postToParent({ type: 'SSO_READY' });
    console.warn('[SSO] 发送 SSO_READY 消息到父窗口');
  }
});

// 是否发送 SSO 消息给父窗口
const shouldSendSSOMessage = computed(() => {
  return !notLoadSsoView.value && window.parent && window.parent !== window;
});
</script>

<template>
  <div class="login-dispatcher-wrapper">
    <!-- 注意：不要用 <transition mode="out-in"> 包 <component :is>。
         自动识别窄屏会在页面挂载后中途切换异步组件，out-in 与异步组件/多根节点
         组合会导致 leave 后新组件不挂载（白屏）。设备切换不需要动画，直接渲染。 -->
    <component :is="activeComponent" />
  </div>
</template>

<style scoped>
.login-dispatcher-wrapper {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 纵向允许滚动：窄窗口/短屏下子内容超出视口时可滚到，不再被裁切 */
  overflow-y: auto;
  overflow-x: hidden;
  background: transparent;
}
</style>
