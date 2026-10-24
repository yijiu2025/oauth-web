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
import { provide, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { device } from '@/view/devices';

const route = useRoute();

// 设备页装配（判定 + 容器 Map + 末条兜底 + **挂载预热**，四页共用，见 useDevicePage）。
// 预热的两条理由：① 避免切换闪屏（设备形态运行时才定）；② 宽窄切换零新请求
// （verify-responsive-switch C4 守这条；四页同构由 useDevicePage 单点保证，
// 0.5.0「误删后三个的预热」这类漂移不再可能发生）。
const activeComponent = device.useDevicePage('register');

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
