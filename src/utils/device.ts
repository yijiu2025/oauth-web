/**
 * 设备形态判定 —— 转发库 `skinsuite/vue` 的视口判定（**单一来源**）
 *
 * 判定口径（宽视口优先 + 窄视口 + UA 兜底）已下沉到库 `skinsuite/vue` 的 viewport 模块，
 * 本文件只做 re-export，让 guard / request / Authorize 等沿用 `@/utils/device` 的导入面
 * 而不必改调用点。设备域（`device-domain`）也复用同一份口径 —— 三方同源，不再漂移。
 *
 * @author yijiu2025
 * @since 2026-10-19（下沉 skinsuite/vue，本文件退化为转发壳）
 */
export {
  DESKTOP_MIN_WIDTH,
  MOBILE_BREAKPOINT,
  detectMobileUA,
  isDesktopViewport,
  isMobileViewport
} from 'skinsuite/vue';
