<script setup lang="ts">
/**
 * 授权页 · **standard 设备**基础版式（应用卡片 + 权限清单 + 批准/拒绝）
 *
 * 由容器 `view/web/auth/Authorize.vue` 经 `<ThemeView page="authorize">` 渲染。
 * 版式只读 `ctx`、只调 `ctx.actions`，禁止出现请求 / 跳转 / 参数判断（契约见 `theme/views/authorize.ts`）。
 *
 * mini / mobile / tablet 三个设备目录**转发本文件**（视口差异走 CSS 媒体查询，
 * 与登录页「每设备一份 DOM」不同：授权页四种形态的结构完全一致，拆四份只会漂移）。
 *
 * @author yijiu2025
 * @since 2026-11-15（自 `view/web/auth/Authorize.vue` 内联 template 搬出）
 */
import { toRef } from 'vue';
import type { AuthorizeViewProps } from '@/theme/views/authorize';

const props = defineProps<AuthorizeViewProps>();
const ctx = toRef(props, 'ctx');
</script>

<template>
  <div class="authorize-viewport" data-mauth-view="default" :class="{ dark: ctx.isDark }">
    <div class="authorize-card animate-slide-up">
      <!-- 加载中 -->
      <div v-if="ctx.loading" class="auth-state">
        <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p class="mt-4 text-sm text-slate-400">{{ ctx.t('auth.loading') }}</p>
      </div>

      <!-- 缺参数（全屏直接打开 /authorize 的常见情况） -->
      <div v-else-if="ctx.paramsMissing" class="auth-state">
        <div
          class="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" stroke-width="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <h2 class="text-lg font-bold dark:text-white mb-2">{{ ctx.t('auth.params_missing_title') }}</h2>
        <p class="text-slate-400 text-xs leading-relaxed">{{ ctx.t('auth.params_missing_desc') }}</p>
      </div>

      <!-- 出错 -->
      <div v-else-if="ctx.errorMessage" class="auth-state">
        <div
          class="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f43f5e" stroke-width="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h2 class="text-lg font-bold dark:text-white mb-2">{{ ctx.t('auth.failed_title') }}</h2>
        <p class="text-slate-400 text-xs leading-relaxed break-words">{{ ctx.errorMessage }}</p>
      </div>

      <!-- 授权确认 -->
      <div v-else class="auth-body">
        <!-- 应用 Header -->
        <div class="flex flex-col items-center text-center mb-6 sm:mb-10">
          <div
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 p-[2px] shadow-xl shadow-primary/20 mb-4 sm:mb-6"
          >
            <div
              class="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center text-2xl sm:text-3xl"
            >
              {{ ctx.appName.charAt(0).toUpperCase() }}
            </div>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold dark:text-white mb-2">
            {{ ctx.appName }} {{ ctx.t('auth.requests_auth') }}
          </h2>
          <p class="text-slate-400 text-xs px-2 sm:px-10">{{ ctx.appDescription }}</p>
        </div>

        <!-- 权限列表 -->
        <div
          class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-10 border border-slate-100 dark:border-slate-800"
        >
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            {{ ctx.t('auth.permissions_title') }}
          </p>
          <div class="space-y-4 sm:space-y-5">
            <div v-for="scope in ctx.scopes" :key="scope.id" class="flex items-start gap-3 sm:gap-4">
              <div
                class="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mt-0.5 shrink-0"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="4">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold dark:text-slate-200">
                  {{ scope.name }}
                  <span v-if="scope.required" class="ml-1 text-[10px] font-medium text-rose-500">
                    {{ ctx.t('auth.required') }}
                  </span>
                </p>
                <p class="text-[11px] text-slate-400 leading-tight mt-1 break-words">{{ scope.desc }}</p>
              </div>
            </div>
            <p v-if="!ctx.scopes.length" class="text-xs text-slate-400">{{ ctx.t('auth.no_scopes') }}</p>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-col gap-3">
          <button :disabled="ctx.submitting" class="auth-btn" type="button" @click="ctx.actions.approve()">
            <span
              v-if="ctx.submitting"
              class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 align-[-2px]"
            ></span>
            {{ ctx.submitting ? ctx.t('auth.processing') : ctx.t('auth.allow_continue') }}
          </button>
          <button :disabled="ctx.submitting" class="auth-btn-ghost" type="button" @click="ctx.actions.deny()">
            {{ ctx.t('auth.cancel') }}
          </button>
        </div>

        <p class="mt-6 sm:mt-8 text-center text-[10px] text-slate-400 leading-relaxed">
          {{ ctx.t('auth.footer_hint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.authorize-viewport {
  /* dvh：移动端浏览器地址栏收放时不会把内容顶出屏幕；100vh 作为老浏览器兜底 */
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  font-family: 'Outfit', sans-serif;
  /* 全屏直接访问时允许滚动（长权限列表 / 小屏），并按安全区留白 */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.authorize-viewport.dark {
  background: #0f172a;
}

.authorize-card {
  width: 100%;
  max-width: 440px;
  background: white;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
  margin: auto;
}

.authorize-viewport.dark .authorize-card {
  background: #1e293b;
  border: 1px solid #334155;
}

/* 桌面宽屏恢复大圆角，移动端用紧凑圆角 */
@media (min-width: 640px) {
  .authorize-card {
    border-radius: 32px;
  }
}

/* 内容区：移动端紧凑内边距，避免 375px 屏幕被 40px padding 挤扁 */
.auth-body {
  padding: 24px 20px;
}

@media (min-width: 640px) {
  .auth-body {
    padding: 40px;
  }
}

/* 加载 / 缺参 / 出错 状态块：不定高，内容自适应（原固定 h-400px 在小屏会溢出） */
.auth-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 56px 24px;
}

.auth-btn {
  height: 48px;
  width: 100%;
  border: none;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-btn:hover:not(:disabled) {
  opacity: 0.95;
  transform: translateY(-1px);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-btn-ghost {
  height: 44px;
  width: 100%;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}

.authorize-viewport.dark .auth-btn-ghost {
  color: #94a3b8;
  border-color: #334155;
}

.auth-btn-ghost:hover:not(:disabled) {
  background: #f8fafc;
}

.authorize-viewport.dark .auth-btn-ghost:hover:not(:disabled) {
  background: #0f172a;
}

.animate-slide-up {
  animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 尊重系统"减弱动效"设置 */
@media (prefers-reduced-motion: reduce) {
  .animate-slide-up {
    animation: none;
  }
}
</style>
