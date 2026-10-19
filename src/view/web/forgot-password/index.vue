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
 * 设备形态**单一来源** = 设备域 `currentDevice()`，分发器不自己 `pickDeviceId`、也不碰主题。
 *
 * @author yijiu2025
 */
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { currentDevice, deviceIds, resolveContainerOf } from 'skinsuite/vue';

// 异步按需加载三种形态（设备 id → 容器，从设备清单派生）
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'forgot-password'))])
);

// 🔴 设备形态单一来源 = 设备域 currentDevice()
const activeComponent = computed(() =>
  deviceComponents.get(currentDevice().value) ?? deviceComponents.get('standard')!
);

// 挂载后预热各形态组件，避免「回到登录」切换闪屏
onMounted(() => {
  for (const id of deviceIds()) {
    void resolveContainerOf(id, 'forgot-password')().catch(() => {});
  }
});
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
