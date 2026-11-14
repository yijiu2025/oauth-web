<script setup lang="ts">
/**
 * 授权确认页 · **mini 设备**版式 —— 转发 standard 的那一份
 *
 * mini 是 iframe 紧凑版（宽 854），卡片 max-width 440 本就装得下，
 * standard 版式已含窄屏媒体查询，复制 DOM 只会多一个漂移点。
 * 设备目录必须存在：`<ThemeView :device>` 按 `<包>/<设备>/<页>/index.vue` 查找。
 *
 * @author yijiu2025
 * @since 2026-11-15
 */
import Base from '../../standard/consent/index.vue';
import type { ConsentViewProps } from '@/theme/views/consent';

defineProps<ConsentViewProps>();
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
