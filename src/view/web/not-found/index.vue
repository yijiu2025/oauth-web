<script setup lang="ts">
/**
 * 404「页面未找到」分发器（catch-all 路由的兜底入口）
 *
 * 路由：errorRoutes 的 `:pathMatch(.*)*` 指向本分发器。窄视口 / 真机 → 移动端全屏，
 * `?from=mini` / `/mini*` → 紧凑版卡片，平板 → tablet 版式，否则桌面标准卡片。
 *
 * 为什么要分发：404 是所有未匹配路径的兜底，用户在**任何设备、任何嵌入场景**都可能撞上
 * （手机点坏链、iframe 弹窗里点坏链、平板扫描）—— 不能只给一种桌面卡片。
 *
 * 设备形态**单一来源** = 设备域 `currentDevice()`，分发器不自己 `pickDeviceId`、也不碰主题。
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { currentDevice, deviceIds, resolveContainerOf } from 'skinsuite/vue';

// 异步按需加载各设备形态（设备 id → 容器，从设备清单派生）
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'not-found'))])
);

// 🔴 设备形态单一来源 = 设备域 currentDevice()
const activeComponent = computed(() =>
  deviceComponents.get(currentDevice().value) ?? deviceComponents.get('standard')!
);

// 挂载后预热各形态组件，避免切换闪屏
onMounted(() => {
  for (const id of deviceIds()) {
    void resolveContainerOf(id, 'not-found')().catch(() => {});
  }
});
</script>

<template>
  <div class="not-found-dispatcher-wrapper">
    <!-- 注意：不要用 <transition mode="out-in"> 包 <component :is>。
         自动识别窄屏会在挂载后中途切换异步组件，out-in 与异步组件组合会白屏。 -->
    <component :is="activeComponent" />
  </div>
</template>

<style scoped>
.not-found-dispatcher-wrapper {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 纵向允许滚动：窄窗口/短屏下子内容超出视口时可滚到 */
  overflow-y: auto;
  overflow-x: hidden;
  background: transparent;
}
</style>
