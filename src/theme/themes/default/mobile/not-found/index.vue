<script setup lang="ts">
/**
 * 404 · **mobile 设备**基础版式（移动端全屏）
 *
 * 由容器 `view/app/not-found/index.vue` 通过 `<ThemeView>` 加载。版式只读 `ctx`、
 * 只调 `ctx.actions`，禁止出现请求 / 路由 / store。契约见 `theme/views/not-found.ts`。
 *
 * 样式：本组件**不自带 `<style>`** —— 移动端认证页样式单一来源是
 * `assets/styles/mobile-auth.scss`（`mauth-*` 体系，登录/注册/重置密码/404 共用）。
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import { toRef } from 'vue';
import MauthThemeSwitch from '@/components/auth/MauthThemeSwitch.vue';
import type { NotFoundViewProps } from '@/theme/views/not-found';

const props = defineProps<NotFoundViewProps>();
const ctx = toRef(props, 'ctx');
</script>

<template>
  <!-- 移动端全屏 404（与手机端登录/注册/重置密码共用 mauth-* 样式体系）
       data-mauth-view：版式自己声明身份，值 = 主题包名 -->
  <div class="mauth-page" data-mauth-view="default">
    <!-- 顶部 Header：返回 + 主题切换 + 标题 -->
    <header class="mauth-header">
      <button class="mauth-back-btn" :aria-label="ctx.t('not_found.back', '返回上页')" @click="ctx.actions.goBack()">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <!-- 右上角主题切换（跟随系统 / 浅色 / 深色 三态） -->
      <MauthThemeSwitch />
      <div class="mauth-header-content">
        <div class="mauth-logo">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1 class="mauth-title">{{ ctx.title }}</h1>
      </div>
    </header>

    <main class="mauth-body">
      <section class="mauth-step">
        <!-- 404 图标面板 -->
        <div class="mauth-panel">
          <div class="mauth-panel-icon mauth-panel-icon-info">
            <svg viewBox="0 0 120 120" width="28" height="28" fill="none" stroke="currentColor" stroke-width="4">
              <circle cx="60" cy="60" r="48" stroke-dasharray="6 4" />
              <path d="M44 50 L44 70 L76 70" stroke-linecap="round" stroke-linejoin="round" />
              <line x1="44" y1="44" x2="76" y2="76" stroke-linecap="round" />
            </svg>
          </div>
          <p class="mauth-panel-text">{{ ctx.desc }}</p>
        </div>

        <!-- 原始路径 -->
        <div class="mauth-notfound-path" :title="ctx.path">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{{ ctx.path }}</span>
        </div>

        <!-- 主操作：返回登录 -->
        <button type="button" class="mauth-submit" @click="ctx.actions.goHome()">
          {{ ctx.t('not_found.home', '返回登录') }}
        </button>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 原始路径：移动端专属的一小块（mauth-* 没有现成类），token 化 */
.mauth-notfound-path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 8px 14px;
  margin: 16px auto 8px;
  border-radius: 10px;
  background: var(--mauth-surface-2);
  color: var(--mauth-text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.mauth-notfound-path svg {
  flex-shrink: 0;
}

.mauth-notfound-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
