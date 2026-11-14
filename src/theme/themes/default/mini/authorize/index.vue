<script setup lang="ts">
/**
 * 授权页 · **mini 设备**版式 —— 转发 standard 的那一份
 *
 * mini 是 iframe 紧凑版（宽 854），与 standard 的差别只在可用宽度，
 * 而 standard 版式已经用媒体查询处理窄屏（卡片 max-width 440 + 移动端紧凑内边距），
 * 复制一份 DOM 只会多一个漂移点。设备目录仍需存在：`<ThemeView :device>` 按
 * `<包>/<设备>/<页>/index.vue` 查找，缺目录 = 该设备白屏。
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
