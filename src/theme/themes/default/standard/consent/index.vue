<script setup lang="ts">
/**
 * 授权确认页 · **standard 设备**基础版式（外壳 + ConsentPanel）
 *
 * 由容器 `view/web/auth/Consent.vue` 经 `<ThemeView page="consent">` 渲染。
 * 版式只读 `ctx`、只调 `ctx.actions`（契约见 `theme/views/consent.ts`）。
 *
 * 🔴 权限清单与批准/拒绝按钮**不在本文件**：`components/auth/ConsentPanel.vue` 是
 * 登录页内嵌面板与本页共用的唯一实现，这里只做外壳（头部 + 完成/缺参两态）。
 * 把列表抄进来 = 第三份实现，改文案要改三处。
 *
 * @author yijiu2025
 * @since 2026-11-15（自 `view/web/auth/Consent.vue` 内联 template 搬出）
 */
import { toRef } from 'vue';
import ConsentPanel from '@/components/auth/ConsentPanel.vue';
import type { ConsentViewProps } from '@/theme/views/consent';

const props = defineProps<ConsentViewProps>();
const ctx = toRef(props, 'ctx');
</script>

<template>
  <div class="consent-viewport" data-mauth-view="default" :class="{ dark: ctx.isDark }">
    <div class="consent-card animate-fade-in">
      <!-- 完成态（登录流无回跳目标时的收尾提示） -->
      <div v-if="ctx.done" class="consent-state">
        <div class="state-icon state-icon-success">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 class="state-title">{{ ctx.t('login.consent_title') }}</h1>
        <p class="state-desc">{{ ctx.t('auth.consent_done_desc') }}</p>
      </div>

      <!-- 缺凭据（全屏直接打开 /consent） -->
      <div v-else-if="ctx.paramsMissing" class="consent-state">
        <div class="state-icon state-icon-warn">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <h1 class="state-title">{{ ctx.t('auth.params_missing_title') }}</h1>
        <p class="state-desc">{{ ctx.t('auth.consent_missing_desc') }}</p>
      </div>

      <!-- 授权确认 -->
      <template v-else>
        <header class="consent-head">
          <div class="head-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
            </svg>
          </div>
          <h1 class="consent-title">{{ ctx.t('login.consent_title') }}</h1>
          <p class="consent-sub">{{ ctx.t('login.consent_desc', { app: ctx.clientName }) }}</p>
        </header>

        <ConsentPanel
          :consent-state="ctx.consentState"
          :submitting="ctx.submitting"
          :on-deny="ctx.actions.deny"
          :on-approve="ctx.actions.approve"
        />

        <p class="consent-foot">{{ ctx.t('auth.consent_footer_hint') }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.consent-viewport {
  /* dvh 防移动端地址栏收放导致内容被裁；100vh 兜底 */
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%);
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.consent-viewport.dark {
  background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%);
}

.consent-card {
  width: 100%;
  max-width: 440px;
  margin: auto;
  background: #ffffff;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.12);
  padding: 24px 20px;
  box-sizing: border-box;
}

.consent-viewport.dark .consent-card {
  background: #1e293b;
  border-color: #334155;
}

@media (min-width: 640px) {
  .consent-card {
    border-radius: 32px;
    padding: 32px;
  }
}

/* 头部 */
.consent-head {
  text-align: center;
  margin-bottom: 20px;
}

.head-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 14px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.25);
}

.consent-title {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

.consent-viewport.dark .consent-title {
  color: #f1f5f9;
}

.consent-sub {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

.consent-foot {
  margin-top: 18px;
  text-align: center;
  font-size: 10px;
  line-height: 1.6;
  color: #94a3b8;
}

/* 状态块（完成 / 缺参） */
.consent-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 12px;
}

.state-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.state-icon-success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.state-icon-warn {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.state-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px;
}

.consent-viewport.dark .state-title {
  color: #f1f5f9;
}

.state-desc {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
  margin: 0;
}

/* 入场动画 */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-in {
    animation: none;
  }
}
</style>
