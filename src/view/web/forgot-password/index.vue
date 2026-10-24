<script setup lang="ts">
/**
 * 忘记密码/重置密码 分发器（/forgot-password）
 *
 * 路由：authRoutes。窄视口 / 真机 / 显式 `?isMobile=true` → 渲染移动端全屏页，
 * `?fromLogin=mini` → 渲染紧凑版卡片，否则渲染桌面标准双栏卡片。
 *
 * 为什么要分发：「忘记密码」的入口在三处都能点到 —— 电脑版登录页、手机端登录页、
 * 以及用户邮箱里的重置链接。手机端登录页的按钮已直连 `/m/forgot-password`；
 * 邮件链接指向 `/reset-password?token=…`，那条路径重定向到本路由（见 router/routes.ts），
 * 用户在手机上点邮件时靠这里兜住，否则会看到桌面双栏卡片被塞进手机屏。
 *
 * 设备判定是**宿主自己的模块**（2026-10-20）：`utils/device-resolve.ts`（视口 + URL
 * 词汇，零主题依赖）经 `composables/useRenderDevice` 接线，本分发器据此选容器；
 * **不碰主题** —— 设备身份由容器内的 `<ThemeView device="…">` props 告知主题 store。
 *
 * @author yijiu2025
 */
import { device } from '@/view/devices';

// 设备页装配（判定 + 容器 Map + 末条兜底 + **挂载预热**，四页共用，见 useDevicePage）。
// 预热的两条理由：① 运行时才能定设备形态，预热避免「切换闪屏」；② 宽窄切换零新请求
// （拉宽时桌面容器必须已缓存，verify-responsive-switch C4 守这条 —— 四页同构由
// useDevicePage 单点保证，0.5.0「误删后三个的预热」这类漂移不再可能发生）。
const activeComponent = device.useDevicePage('forgot-password');
</script>

<template>
  <div class="forgot-dispatcher-wrapper">
    <!-- 注意：不要用 <transition mode="out-in"> 包 <component :is>。
         自动识别窄屏会在页面挂载后中途切换异步组件，out-in 与异步组件/多根节点
         组合会导致 leave 后新组件不挂载（白屏）。设备切换不需要动画，直接渲染。 -->
    <component :is="activeComponent" />
  </div>
</template>

<style scoped>
.forgot-dispatcher-wrapper {
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
