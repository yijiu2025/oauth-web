<script setup lang="ts">
/**
 * 注册页分发器（/register 与 /m/register 共用）
 *
 * 按「当前设备形态」挑渲染哪个容器（mobile / mini / standard / tablet）。设备判定是
 * **宿主自己的模块**（2026-10-20）：`utils/device-resolve.ts`（视口 + URL 词汇，零主题
 * 依赖）经 `composables/useRenderDevice` 接成响应式，本分发器据此选容器。
 *
 * 🔴 分发器**不碰主题**：设备身份由被选中容器内的 `<ThemeView page="register"
 *     device="…">` props 告知主题 store。
 *
 * 另外把父应用跳注册页携带的 OAuth 上下文（appName / client_id / redirect_uri / scope /
 * state / invite / lang）通过 `provide('registerContext')` 透传给子容器。
 */
import { computed, defineAsyncComponent, onMounted, provide, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { deviceIds, fallbackDevice, resolveContainerOf } from 'skinsuite/vue';
import { useRenderDevice } from '@/composables/useRenderDevice';

const route = useRoute();

// 设备判定（宿主口径：视口 + URL 词汇；兜底显式落 standard）
const device = useRenderDevice();

// 异步按需加载不同形态的注册容器：设备 id → 容器，映射从设备清单派生
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'register'))])
);

// 判定 → 选容器：未知 id（`?device=` 写错）才落设备清单末条；兜底已在判定里显式落 standard（主题由容器内 ThemeView 告知）
const activeComponent = computed(() => {
  const fallback = fallbackDevice();
  return deviceComponents.get(device.value) ?? deviceComponents.get(fallback)!;
});

// 透传 OAuth 注册上下文给子组件（子组件用 inject('registerContext') 获取）
const q = route.query;
const registerContext = reactive({
  // 应用展示
  appName: String(q.appName || '') || 'Enterprise SSO',
  // 客户端（后端 OAuth 服务用）
  clientId: String(q.client_id || q.appName || ''),
  // OAuth 回跳（注册成功后跳此 URL，必须同源白名单校验）
  redirectUri: String(q.redirect_uri || q.redirect || ''),
  // 兼容旧字段名（dispatcher 之前是 redirect，新版统一用 redirect_uri 与 OAuth 规范对齐）
  redirect: String(q.redirect || q.redirect_uri || ''),
  // scope + state（OAuth 标准字段，注册成功后回跳 redirect_uri 时会带上）
  scope: String(q.scope || ''),
  state: String(q.state || ''),
  // 邀请码（父应用邀请注册场景）
  invite: String(q.invite || ''),
  // 语言
  lang: String(q.lang || '') || 'zh_cn'
});
provide('registerContext', registerContext);

/**
 * 挂载后立即预热所有设备的注册容器：
 *   ① 避免「切换闪屏」—— 设备形态在运行时才能确定（视口 / `?device=` 锁定），
 *      dispatcher 自身 prefetch 之后，defineAsyncComponent 还要再走一次 chunk 下载；
 *   ② 宽 → 窄 / 窄 → 宽切换**零新请求**（`verify-responsive-switch` C4 守这条）——
 *      拉宽时桌面容器必须已经在缓存里，不能等那一刻才去下载。
 * 🔴 这条预热在 0.5.0 设备判定归宿主的改写中曾被误删（只留下 login 的），
 *     C4 当场红 —— 四个分发器必须同构，别只改一个。
 */
onMounted(() => {
  for (const id of deviceIds()) {
    void resolveContainerOf(id, 'register')().catch(() => {});
  }
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
