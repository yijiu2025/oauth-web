/**
 * 路由表 —— 宿主固定声明（「路由 → 页面」是前端事实，不来自主题）
 *
 * === router 与主题分层 ===
 * router 只负责「固定几个主路由入口 + 标题」，主题只负责「给定页面名渲染哪套版式」
 * （容器里 `<ThemeView page="...">`）。两者只通过「页面名字面量」对齐，互不驱动。
 *
 * === 加一个页面 = 改三处 ===
 *   ① 下面 `PAGE_DEFS` 加一条（path / name / title / mobileTitle）
 *   ② `theme/views/<page>.ts` 写契约（`defineThemePage({ page })`）
 *   ③ `view/web/<page>/index.vue` 写分发器（窄/宽屏自适应）
 *
 * `/m/*` 与 `/<page>` 共用同一套分发器：窄视口渲染手机端容器、宽视口渲染桌面卡片，
 * URL 不被视口改写。
 *
 * @author yijiu2025
 * @since 2026-10-19（清理：去 mobileRoutes 别名、删 guestOnly 死字段）
 */
import type { RouteRecordRaw } from 'vue-router';
import { reportError } from '@/composables/useErrorReporter';
import { stripSensitiveQuery } from '@/utils/clear-url-query';

/** 分发器（`view/web/<page>/index.vue`）：页面名 → 惰性加载器（glob 是字面量，键与 PAGE_DEFS 的 path 一致） */
const dispatchers = import.meta.glob('/src/view/web/*/index.vue');

/**
 * 固定主路由清单（顺序即定义顺序）。
 * `name` 与 `path` 一致（小写不转大写）：`index.ts` 的 `redirect: { name: 'login' }` 依赖它。
 */
const PAGE_DEFS = [
  { path: 'login', name: 'login', title: '安全登录', mobileTitle: '移动端登录' },
  { path: 'register', name: 'register', title: '账户注册', mobileTitle: '移动端注册' },
  { path: 'forgot-password', name: 'forgot-password', title: '忘记密码', mobileTitle: '移动端重置密码' }
] as const;

/** 桌面页面路由（`/<page>`） */
const pageRoutes: RouteRecordRaw[] = PAGE_DEFS.map(d => ({
  path: d.path,
  name: d.name,
  component: dispatchers[`/src/view/web/${d.path}/index.vue`],
  meta: { title: d.title }
}));

/** 移动端页面路由（`/m/<page>`）：与桌面共用分发器，标题取移动端文案 */
export const mobileRoutes: RouteRecordRaw[] = PAGE_DEFS.map(d => ({
  path: `m/${d.path}`,
  name: `Mobile-${d.name}`,
  component: dispatchers[`/src/view/web/${d.path}/index.vue`],
  meta: { title: d.mobileTitle }
}));

/** 认证页路由：登录 / 注册 / 忘记密码 + 兼容重定向 + mini-login */
export const authRoutes: RouteRecordRaw[] = [
  ...pageRoutes,
  {
    // 邮件里的重置链接指向 `/reset-password?token=…`（后端 send-reset-link 这么拼），
    // 而前端页面是 `/forgot-password`。做一次兼容重定向：不改后端（在途邮件旧链接继续有效），
    // query 原样透传（token 丢了整条流程就废了）。
    path: 'reset-password',
    redirect: to => ({ path: '/forgot-password', query: to.query, hash: to.hash })
  },
  {
    // mini-login 是 login 的「紧凑版」独立路由（mini 设备）。只有 login 有这条独立入口
    // （MiniLogin 内跳转用 `/mini-login`），register / forgot-password 的 mini 形态由
    // 分发器按 `?from=mini` 判定，不单开路由。
    path: 'mini-login',
    name: 'MiniLogin',
    component: dispatchers['/src/view/web/login/index.vue'],
    meta: { title: '快捷登录' }
  }
];

/** OAuth 授权流路由（需登录）：authorize / consent */
export const authFlowRoutes: RouteRecordRaw[] = [
  {
    path: 'authorize',
    name: 'Authorize',
    component: () => import('@/view/web/auth/Authorize.vue'),
    meta: { title: '应用授权', requiresAuth: true }
  },
  {
    // 独立授权确认页（全屏可达）：authorize 流带 session_id、login 流带 consent_key
    path: 'consent',
    name: 'Consent',
    component: () => import('@/view/web/auth/Consent.vue'),
    meta: { title: '授权确认', requiresAuth: true }
  }
];

/** 错误页路由（404 兜底） */
export const errorRoutes: RouteRecordRaw[] = [
  {
    path: ':pathMatch(.*)*',
    name: 'NotFound',
    // 404 也走「设备分发器 + 多主题」：分发器用宿主设备模块判设备，
    // 选 standard / mini / mobile / tablet 容器，容器再 <ThemeView>（device prop
    // 告知主题）落到各设备版式。
    component: () => import('@/view/web/not-found/index.vue'),
    meta: { title: '页面未找到' },
    beforeEnter: to => {
      // 上报 404，用于发现死链 / 扫描探测行为。
      // 🔴 必须走 reportError（生产 fetch 上报后端），不能用 console.warn：
      //    生产构建 dropConsole 会把 console 删掉，404 监控会静默失效。
      // 剥掉敏感 query（token/state 等），避免凭证进后端 404 日志
      void reportError(`[404] ${stripSensitiveQuery(to.fullPath)}`, `referrer=${document.referrer}`);
    }
  }
];
