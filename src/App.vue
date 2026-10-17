<script setup lang="ts">
/**
 * 应用根组件 —— **只负责路由舞台**
 *
 * 与主题有关的一切（暗色类、token 底色、父窗口同步、后端配色、调试面板）
 * 都在 `@/theme/ThemeRoot.vue` 里；这里只剩"把当前路由渲染出来并做过渡"。
 * 主题层想换实现、想加能力，都不该再回到这个文件。
 *
 * @author yijiu2025
 */
import ThemeRoot from '@/components/ThemeRoot.vue';
</script>

<template>
  <ThemeRoot>
    <!--
      路由级淡入淡出过渡（v2.20.1 修复手机端「立即注册/立即登录」切换闪屏）

      之前 `<router-view />` 裸渲染：路由切换瞬间旧组件 unmount + 新组件异步 chunk
      还没下载好 → body 背景透出（black 配色下闪黑），用户感知为「闪一下屏幕」。
      给 router-view 套 Transition，配合各 dispatcher 的预取（goRegister/goLogin
      在 push 前先 import 目标 dispatcher chunk），切换就是连贯淡入淡出。

      不在 view/web/login/index.vue 等分发器内层用 `<Transition mode="out-in">` 包
      `<component :is>`：分发器自己要做窄/宽屏异步组件切换，out-in 与异步组件组合
      会导致 leave 后新组件不挂载（白屏）—— 已有注释保护这条不变量。

      默认模式（同时 enter/leave）而非 out-in：leave 阶段旧组件淡出，同时 enter
      阶段新组件淡入 —— 两层透明度叠加，wrapper 始终可见，消除「leave 完成后
      enter 起始的 ~40ms 黑屏」。.route-stage 用 absolute 让 leave/enter 重叠渲染
      （旧组件脱离文档流，新组件覆盖在原位），避免两个组件在文档流里堆叠导致
      wrapper 高度跳动 / 滚动条突现。
    -->
    <router-view v-slot="{ Component }">
      <Transition name="page">
        <div class="route-stage" :key="$route.fullPath">
          <component :is="Component" />
        </div>
      </Transition>
    </router-view>
  </ThemeRoot>
</template>

<style>
/* Global resets if needed */
body {
  margin: 0;
  padding: 0;
}

/*
 * 路由级淡入淡出（v2.20.1）
 * - leave 180ms / enter 220ms（旧出慢、新进快 —— 让人感觉响应即时）
 * - 不用 out-in：默认模式让 leave/enter 重叠，避免 chunk 加载延迟时出现黑屏窗口
 * - 6px 上移（新组件从下方滑入）：暗示「内容轮换」但不抢眼
 * - ease-out（enter 更急促）/ ease-in（leave 更轻柔，给旧组件收尾空间）
 *
 * .route-stage 让 leave 期间旧组件绝对定位脱离文档流，与新组件重叠渲染 ——
 * 不影响父容器 .min-h-screen 的高度，也不会让两个组件堆叠导致页面跳动。
 * route-stage 的父容器（router-view）已 min-h-screen 全屏，子元素 absolute inset:0
 * 自然撑满到父级尺寸。
 */
.route-stage {
  position: absolute;
  inset: 0;
  width: 100%;
}

.page-enter-active {
  transition: opacity 0.22s ease-out, transform 0.22s ease-out;
}
.page-leave-active {
  transition: opacity 0.18s ease-in, transform 0.18s ease-in;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
