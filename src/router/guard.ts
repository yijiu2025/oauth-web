/**
 * 路由守卫 —— 需要登录的路由统一在 `requiresAuth` 收口
 *
 * 语义只有一个字段：`meta.requiresAuth === true` 表示「未登录跳登录页」。
 * 其余路由（登录 / 注册 / 忘记密码 / 404 等）一律放行，由页面自身决定展示什么。
 *
 * @author yijiu2025
 * @since 2026-10-19（清理：删 guestOnly 死字段，只认 requiresAuth）
 */
import type { Router } from 'vue-router';
import { isAuthenticated } from './auth-checker';
import { sanitizeLocalRedirect } from '@/utils/redirect';
import { isMobileViewport } from '@/device';

/** 桌面端未登录跳转目标 */
const DESKTOP_LOGIN = '/login';
/** 移动端未登录跳转目标（全屏移动端页面，而不是把桌面页塞进手机屏幕） */
const MOBILE_LOGIN = '/m/login';

/**
 * 校验重定向目标，防开放重定向漏洞。
 * 白名单规则收敛在 `@/utils/redirect`（与 OAuth 回跳等场景共用一套）。
 */
export function sanitizeRedirect(raw: unknown): string {
  return sanitizeLocalRedirect(raw) || DESKTOP_LOGIN;
}

/** 设置路由守卫 */
export function setupAuthGuard(router: Router): void {
  router.beforeEach(to => {
    // 不需要登录的路由直接放行
    if (!to.meta.requiresAuth) return;

    // 需要登录但未登录：跳登录页
    if (!isAuthenticated()) {
      const redirect = sanitizeRedirect(to.fullPath);
      // 按设备形态选登录页：手机上直接进移动端全屏登录页。
      // 同时透传原 query（client_id / redirect_uri / scope / state ...）：
      // 只给 redirect 的话登录页拿不到应用上下文，会显示「应用标识缺失」而无法登录。
      return {
        path: isMobileViewport() ? MOBILE_LOGIN : DESKTOP_LOGIN,
        query: { ...to.query, redirect }
      };
    }
  });
}
