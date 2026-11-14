<script setup lang="ts">
/**
 * 授权页 · **mobile 设备**版式 —— 转发 standard 的那一份
 *
 * 手机端（`/m/*`、窄视口）与桌面共用同一套 DOM：standard 版式本就按 375px→640px
 * 分档写了媒体查询（内边距、圆角、图标尺寸、安全区留白），再拆一份只会漂移。
 * 设备目录必须存在 —— `<ThemeView :device="'mobile'">` 找不到目录就是白屏。
 *
 * 配色差异（tone / 底色）走本目录下的 `colors/`，不动 DOM。
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
