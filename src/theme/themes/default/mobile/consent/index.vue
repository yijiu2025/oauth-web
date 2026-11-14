<script setup lang="ts">
/**
 * 授权确认页 · **mobile 设备**版式 —— 转发 standard 的那一份
 *
 * 手机端与桌面共用同一套 DOM（standard 版式按 640px 分档写了内边距 / 圆角 / 安全区），
 * 拆两份只会漂移。设备目录必须存在，否则 `<ThemeView :device="'mobile'">` 白屏。
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
