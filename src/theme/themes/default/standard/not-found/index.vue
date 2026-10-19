<script setup lang="ts">
/**
 * 404 · **standard 设备**基础版式（桌面主窗口居中卡片）
 *
 * 由容器 `view/web/not-found/StandardNotFound.vue` 通过 `<ThemeView>` 加载（内置包 default）。
 * 版式只读 `ctx`、只调 `ctx.actions`，禁止出现请求 / 路由 / store。
 * 契约见 `theme/views/not-found.ts`。
 *
 * 样式：本组件自带 `<style scoped>`（`notfound-*` 体系，已 token 化），
 * 与 mobile-auth.scss 的 `mauth-*` 是两套（桌面卡片 vs 移动全屏）。
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
  <div class="notfound-root" data-mauth-view="default">
    <AuthContainer :app-name="'Enterprise SSO'">
      <template #branding>
        <div class="notfound-brand-icon">
          <svg viewBox="0 0 120 120" width="80" height="80" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="60" cy="60" r="48" stroke-dasharray="6 4" />
            <path d="M44 50 L44 70 L76 70" stroke-linecap="round" stroke-linejoin="round" />
            <line x1="44" y1="44" x2="76" y2="76" stroke-linecap="round" />
          </svg>
        </div>
        <h1 class="notfound-code">404</h1>
        <p class="notfound-brand-desc">{{ ctx.t('not_found.brand_desc', '您访问的页面不存在或已被移除。') }}</p>
      </template>

      <div class="notfound-body">
        <h2 class="notfound-title">{{ ctx.title }}</h2>
        <p class="notfound-desc">{{ ctx.desc }}</p>

        <!-- 原始路径 -->
        <div class="notfound-path" :title="ctx.path">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{{ ctx.path }}</span>
        </div>

        <div class="notfound-actions">
          <button type="button" class="notfound-btn notfound-btn--ghost" @click="ctx.actions.goBack()">
            {{ ctx.t('not_found.back', '返回上页') }}
          </button>
          <button type="button" class="notfound-btn notfound-btn--primary" @click="ctx.actions.goHome()">
            {{ ctx.t('not_found.home', '返回登录') }}
          </button>
        </div>
      </div>
    </AuthContainer>
  </div>
</template>

<style scoped>
.notfound-root {
  min-height: 100vh;
}

/* ================================
   branding（左侧品牌面板）
   ================================ */
.notfound-brand-icon {
  width: 96px;
  height: 96px;
  border-radius: 24px;
  background: var(--mauth-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mauth-accent);
  margin-bottom: 24px;
}

.notfound-code {
  font-size: 30px;
  font-weight: 700;
  color: var(--mauth-text-strong);
  margin: 0 0 12px;
  letter-spacing: -0.02em;
}

.notfound-brand-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--mauth-text-faint);
  max-width: 280px;
  margin: 0;
}

/* ================================
   body（右侧内容面板）
   ================================ */
.notfound-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 380px;
  margin: 0 auto;
}

.notfound-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--mauth-text-strong);
  margin: 0 0 8px;
}

.notfound-desc {
  font-size: 13px;
  color: var(--mauth-text-faint);
  margin: 0 0 24px;
  line-height: 1.6;
}

/* 原始路径 */
.notfound-path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 12px;
  margin-bottom: 28px;
  border-radius: 8px;
  background: var(--mauth-surface-2);
  color: var(--mauth-text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.notfound-path svg {
  flex-shrink: 0;
}

.notfound-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* ================================
   按钮
   ================================ */
.notfound-actions {
  display: flex;
  gap: 12px;
}

.notfound-btn {
  height: 40px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.notfound-btn--ghost {
  background: var(--mauth-surface-2);
  color: var(--mauth-text-mid);
}

.notfound-btn--ghost:hover {
  background: var(--mauth-surface-3);
  color: var(--mauth-text-strong);
}

.notfound-btn--primary {
  background: var(--mauth-primary);
  color: var(--mauth-primary-fg);
  box-shadow: var(--mauth-focus-ring);
}

.notfound-btn--primary:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}
</style>
