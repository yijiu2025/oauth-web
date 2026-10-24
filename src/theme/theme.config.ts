/**
 * 主题域清单 —— **主题机制自己的配置**
 *
 * 住在主题**根目录**下（`VITE_THEME_DIR` 指向的目录），与 `themes/`（主题包）、
 * `views/`（版式契约）平级。把这一个目录整包搬到另一个前端，机制与配置都跟着过去，
 * 宿主要改的只有 env。
 *
 * === 本文件只回答一件事 ===
 * 调试面板**什么时候出现**（`debug`）
 *
 * 其余全部由机制推导：
 *   · 主题根目录在哪 → `.env` 的 `VITE_THEME_DIR`（根目录下 `themes/` 固定为主题包目录）
 *   · 有哪些设备     → `src/view/devices.ts`（宿主清单：词汇经 `createThemeState({ devices })`
 *                      装配期注入 store，布线由分发器直接读 —— 库不自持注册表）
 *   · 有哪些页面     → `src/theme/views/<page>.ts`（`defineThemePage` 声明，自动注册页面域）
 *   · 有哪些配色     → 主题包目录结构（扫出来的，不在这里声明）
 *
 * === 为什么没有「路径 → 页面」投影 ===
 * 「哪条路径算哪个页面」是 **router 的职责**：路由表由宿主固定声明（`/<page>`、`/m/<page>`），
 * 页面名就编码在 path 里。页面身份由 `<ThemeView page="...">`
 * 显式传入（容器文件位置即身份），不再从路径反推 —— 清单再声明一份就是第二个真相，
 * 两处不一致时只有「面板认不出页面」这种无从归因的症状。
 *
 * @author yijiu2025
 * @since 2026-10-17（2026-10-18 移除 routes：页面身份由 ThemeView 显式传入）
 */
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  /**
   * 调试面板：`?debug=theme` 才出现（生产缺省档）
   *
   * 选 `url` 而不是 `off`：真机没有 DevTools，线上排查"这个租户颜色不对"
   * 时能直接切主题看效果是刚需；又不像 `always` 那样给每个访客多下一块面板。
   *
   * 三档对「产物」的影响（面板已拆「门卫 + 主体」异步加载）：
   *   · `off`    面板主体是独立 chunk，**完全不下载、不执行**（门卫 `v-if` 恒 false）
   *   · `url`    不带 `?debug=theme` 时同样不下载；带了才异步拉 chunk
   *   · `always` 首屏就异步拉 chunk
   */
  debug: { enabled: 'url', query: 'debug', value: 'theme' }
});
