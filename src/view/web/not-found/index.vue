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
 * 设备判定是**宿主自己的模块**（2026-10-20）：`utils/device-resolve.ts`（视口 + URL
 * 词汇，零主题依赖）经 `composables/useRenderDevice` 接线，本分发器据此选容器；
 * **不碰主题** —— 设备身份由容器内的 `<ThemeView device="…">` props 告知主题 store，
 * 主题跟随渲染入口这台设备。
 *
 * @author yijiu2025
 * @since 2026-10-19
 * @since 2026-10-20（设备判定归宿主设备模块；主题经 ThemeView props 接收）
 */
import { device } from '@/view/devices';

// 设备页装配（判定 + 容器 Map + 末条兜底 + 挂载预热，四页共用，见 useDevicePage）；
// 预热保证宽窄切换零新请求（verify-responsive-switch C4 守这条，四页同构由单点保证）。
const activeComponent = device.useDevicePage('not-found');
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
