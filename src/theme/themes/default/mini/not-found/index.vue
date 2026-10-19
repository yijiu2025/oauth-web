<script setup lang="ts">
/**
 * 404 · **mini 设备**版式（iframe 弹窗单栏卡片）
 *
 * mini 是独立设备（与 mobile / standard / tablet 并列）。由容器
 * `view/web/not-found/MiniNotFound.vue` 通过 `<ThemeView>` 加载。
 * 版式只读 `ctx`、只调 `ctx.actions`，禁止出现请求 / 路由 / store。
 * 契约见 `theme/views/not-found.ts`。
 *
 * 样式：本组件自带 `<style scoped>`（`mnf-*` 体系，已 token 化）。
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import { toRef } from 'vue';
import AuthContainer from '@/components/common/AuthContainer.vue';
import type { NotFoundViewProps } from '@/theme/views/not-found';

const props = defineProps<NotFoundViewProps>();
const ctx = toRef(props, 'ctx');
</script>

<template>
  <div class="mnf-root w-full h-full" data-mauth-view="default">
    <AuthContainer :app-name="'Enterprise SSO'">
      <template #header>
        <h2 class="text-xl font-bold dark:text-white leading-tight">{{ ctx.title }}</h2>
        <p class="text-xs text-slate-400 mt-1">{{ ctx.desc }}</p>
      </template>

      <div class="mnf-body">
        <div class="mnf-icon">
          <svg viewBox="0 0 120 120" width="64" height="64" fill="none" stroke="currentColor" stroke-width="3">
            <circle cx="60" cy="60" r="48" stroke-dasharray="6 4" />
            <path d="M44 50 L44 70 L76 70" stroke-linecap="round" stroke-linejoin="round" />
            <line x1="44" y1="44" x2="76" y2="76" stroke-linecap="round" />
          </svg>
        </div>

        <div class="mnf-path" :title="ctx.path">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{{ ctx.path }}</span>
        </div>

        <div class="mnf-actions">
          <button type="button" class="mnf-btn mnf-btn--ghost" @click="ctx.actions.goBack()">
            {{ ctx.t('not_found.back', '返回上页') }}
          </button>
          <button type="button" class="mnf-btn mnf-btn--primary" @click="ctx.actions.goHome()">
            {{ ctx.t('not_found.home', '返回登录') }}
          </button>
        </div>
      </div>
    </AuthContainer>
  </div>
</template>

<style scoped>
.mnf-root {
  width: 100%;
}

.mnf-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.mnf-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: var(--mauth-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mauth-accent);
}

.mnf-path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--mauth-surface-2);
  color: var(--mauth-text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

.mnf-path svg {
  flex-shrink: 0;
}

.mnf-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.mnf-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.mnf-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.mnf-btn--ghost {
  background: var(--mauth-surface-2);
  color: var(--mauth-text-mid);
}

.mnf-btn--ghost:hover {
  background: var(--mauth-surface-3);
  color: var(--mauth-text-strong);
}

.mnf-btn--primary {
  background: var(--mauth-primary);
  color: var(--mauth-primary-fg);
  box-shadow: var(--mauth-focus-ring);
}

.mnf-btn--primary:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}
</style>
