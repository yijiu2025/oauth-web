/**
 * 路由装配层 —— createRouter + 路由树 + 守卫 + 标题
 *
 * 只做「装配」，不做「声明」：路由表（各路由组的声明）在 `routes.ts`，
 * 认证守卫在 `guard.ts`，本文件把它们装进 Router 实例并挂载标题写入。
 *
 * @author yijiu2025
 * @since 2026-10-19（清理：RouteMeta 删 guestOnly/keepAlive/device 死字段）
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import BlankLayout from '@/layouts/BlankLayout.vue';
import { setupAuthGuard } from './guard';
import { authRoutes, mobileRoutes, authFlowRoutes, errorRoutes } from './routes';

// 扩展 RouteMeta 类型
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题（必填；afterEach 据此写 document.title） */
    title: string;
    /** 是否需要登录；true = 未登录跳登录页（见 guard.ts） */
    requiresAuth?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  // 根路径 → 登录页
  { path: '/', redirect: { name: 'login' } },
  // 所有页面挂在 BlankLayout（空布局）下，作为扁平子路由
  {
    path: '/',
    component: BlankLayout,
    children: [...authRoutes, ...mobileRoutes, ...authFlowRoutes, ...errorRoutes]
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition; // 浏览器前进/后退还原位置
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 }; // 新导航回顶部
  }
});

setupAuthGuard(router);

// 标题写入：导航失败（被守卫重定向）时不写
router.afterEach((to, failure) => {
  if (!failure && to.meta.title) {
    document.title = `${to.meta.title} | Enterprise SSO`;
  }
});

export default router;
