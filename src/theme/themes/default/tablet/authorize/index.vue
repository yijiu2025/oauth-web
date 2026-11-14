<script setup lang="ts">
/**
 * 授权页 · **tablet 设备**版式 —— 转发 standard 的那一份
 *
 * 平板与桌面同构（都是宽屏卡片），差异只在主题作用域与配色，不在 DOM。
 * 详见 `../../standard/authorize/index.vue` 与 `mini` / `mobile` 两份转发的说明。
 *
 * @author yijiu2025
 * @since 2026-11-15
 */
import Base from '../../standard/authorize/index.vue';
import type { AuthorizeViewProps } from '@/theme/views/authorize';

defineProps<AuthorizeViewProps>();
</script>

<template>
  <!--
    display: contents：本层只为携带版式身份（data-mauth-view = 包名，e2e 关卡据此判定
    「这份版式属于哪个包」），不生成盒子、不影响布局；真正的 DOM 在 Base 里。
  -->
  <div class="device-view-alias" data-mauth-view="default">
    <Base :ctx="ctx" />
  </div>
</template>

<style scoped>
.device-view-alias {
  display: contents;
}
</style>
