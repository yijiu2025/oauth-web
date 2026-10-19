<script setup lang="ts">
/**
 * tablet（平板）404 容器 —— **业务零复制**的薄转发（同 `tablet/login/index.vue`）
 *
 * tablet 的业务与 standard（桌面）**完全一致**，区别只在「设备身份」——
 * 它决定主题作用域（配色从 `themes/<包>/tablet/` 找）与版式加载。
 * 转发 StandardNotFound 的完整业务，用 `device="tablet"` 覆盖设备身份。
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import StandardNotFound from '@/view/web/not-found/StandardNotFound.vue';
</script>

<template>
  <StandardNotFound device="tablet" />
</template>
