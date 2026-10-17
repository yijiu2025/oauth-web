/**
 * 主题域清单 —— **主题机制自己的配置**
 *
 * 住在主题**根目录**下（`VITE_THEME_DIR` 指向的目录），与 `themes/`（主题包）、
 * `views/`（版式契约）平级。把这一个目录整包搬到另一个前端，机制与配置都跟着过去，
 * 宿主要改的只有 env。
 *
 * === 本文件只回答两件事 ===
 *   1. 调试面板**什么时候出现**（`debug`）
 *   2. 这条路径属于**哪个页面**（`routes`）
 *
 * 其余全部由机制推导：
 *   · 主题根目录在哪 → `.env` 的 `VITE_THEME_DIR`（根目录下 `themes/` 固定为主题包目录）
 *   · 有哪些设备     → `src/theme/devices.ts`（随应用走，见该文件头）
 *   · 有哪些配色     → 主题包目录结构（扫出来的，不在这里声明）
 *
 * 🔴 **清单里没有「设备」**：设备由路由元信息基线 + 渲染形态分发器决定。
 *    在这里再声明一份就是第二个真相，两处不一致时只有"配色找错范围"这种
 *    无从归因的症状，没有任何报错。
 *
 * === `routes` 是投影，不是路由表 ===
 * 路由（守卫 / 懒加载 / 标题 / 重定向）仍在 `src/router/`。这里只声明
 * 「哪条路径算哪个页面」，因为配色与版式的查找范围是「包 × 设备 × 页面」。
 * 两边必须一致 —— `__tests__/theme-manifest.test.ts` 会逐页比对，漏登记即红。
 *
 * 新增页面时三处都要动（缺一即被关卡拦下）：
 *   ① `src/theme/views/<page>.ts`   页面契约（决定"这页有版式可换"）
 *   ② `src/view/web/<page>/`        分发器（决定"这页渲染什么"）
 *   ③ 本文件的 `routes`             页面投影（决定"主题机制认不认这页"）
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  /**
   * 调试面板：`?debug=theme` 才出现（生产缺省档）
   *
   * 选 `url` 而不是 `off`：真机没有 DevTools，线上排查"这个租户颜色不对"
   * 时能直接切主题看效果是刚需；又不像 `always` 那样给每个访客多下一块面板。
   * 面板本身是异步 chunk —— 不带参数时**既不下载也不执行**。
   */
  debug: { enabled: 'url', query: 'debug', value: 'theme' },

  routes: [
    // 主动 `/<page>` 与移动端 `/m/<page>`（`/m/*` 与 `/*` 共用同一套分发器，
    // 窄视口渲染手机端容器、宽视口渲染桌面卡片，URL 不被视口改写）
    { path: '/login', page: 'login' },
    { path: '/register', page: 'register' },
    { path: '/forgot-password', page: 'forgot-password' },
    // 参数段覆盖将来新增的页面：`/m/anything` → `anything`
    { path: '/m/:page', page: ':page' },
    // mini 设备的独立入口（只有 login 有，见 src/router/routes.ts 的 MiniLogin 段）
    { path: '/mini-login', page: 'login' }
  ]
});
