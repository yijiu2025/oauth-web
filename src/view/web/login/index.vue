<script setup lang="ts">
/**
 * 登录页分发器（/login 与 /m/login 共用）
 *
 * 按「当前设备形态」挑渲染哪个容器：mobile → view/app/login、mini → MiniLogin、
 * standard → StandardLogin。设备形态**单一来源** = 设备域 `currentDevice()`（由
 * `app.use(theme, { router })` 装配，监听路由 + 视口判定）——分发器不再自己
 * `pickDeviceId`，也不碰主题（`setActiveDevice`/`setActivePageView` 是 theme-scope
 * 订阅设备域 + `<ThemeView>` 的职责）。
 *
 * 主题 / 语言等 query 参数（`?lang=` / `?theme=` / `?appName=` / `?qrCodeFirst=` …）
 * 由子容器（MiniLogin / StandardLogin）自己用 `useRoute().query` 读，本分发器不中转。
 */
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAntiCache } from '@/composables/useAntiCache';
import AntiCacheDebugPanel from '@/components/common/AntiCacheDebugPanel.vue';
import { postToParent } from '@/utils/parent';
import { currentDevice, deviceIds, resolveContainerOf } from 'skinsuite/vue';

const route = useRoute();

/** 父应用是否禁用 SSO_READY 消息（`?notLoadSsoView=true`） */
const notLoadSsoView = ref(false);

// 使用防缓存功能
const { rnd, debugInfo } = useAntiCache({
  autoRefresh: true,
  refreshInterval: 5 * 60 * 1000, // 5分钟刷新一次
  enableDebug: false
});

// 调试面板显示状态：由 enableDebug 间接控制（debugInfo 为 undefined 时不显示）
const showDebugPanel = ref(!!debugInfo);

// 只保留本分发器真正要用的 query 参数；lang/theme/appName 等由子容器自己读 route.query。
watch(
  () => route.query,
  query => {
    notLoadSsoView.value = query.notLoadSsoView === 'true';
    rnd.value = (query.rnd as string) || '';
  },
  { immediate: true, deep: true }
);

// 异步按需加载不同形态的登录组件
// 🔴 数据化：设备 id → 该页容器 的映射从设备清单派生，不再写死三选一。
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'login'))])
);

// 🔴 设备形态单一来源 = 设备域 currentDevice()：渲染哪个组件与主题设备作用域同源。
const activeComponent = computed(() =>
  deviceComponents.get(currentDevice().value) ?? deviceComponents.get('standard')!
);

// 组件挂载后执行
onMounted(() => {
  // SSO_READY 统一在此发送（dispatcher 入口），子组件不再重复发。
  // 父窗口收到后关 loading + 同步主题。
  if (shouldSendSSOMessage.value) {
    postToParent({ type: 'SSO_READY' });
    console.warn('[SSO] 发送 SSO_READY 消息到父窗口');
  }
  // 挂载后立即预热所有设备的登录容器，避免「切换闪屏」。
  for (const id of deviceIds()) {
    void resolveContainerOf(id, 'login')().catch(() => {});
  }
});

// 调试面板关闭事件处理
const onDebugPanelClose = () => {
  showDebugPanel.value = false;
  console.warn('防缓存调试面板已关闭');
};

// 是否发送 SSO 消息给父窗口
const shouldSendSSOMessage = computed(() => {
  return !notLoadSsoView.value && window.parent && window.parent !== window;
});
</script>

<template>
  <div class="login-dispatcher-wrapper">
    <!-- 调试信息面板 -->
    <AntiCacheDebugPanel
      :visible="showDebugPanel"
      :refresh-interval="5 * 60 * 1000"
      @update:visible="onDebugPanelClose"
    />

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
