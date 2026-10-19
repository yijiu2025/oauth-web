/**
 * 设备形态判定 —— **宿主自己的业务口径**（2026-10-19 从 skinsuite 收回）
 *
 * === 为什么归宿主 ===
 * 「手机还是电脑」是产品决定，不是通用机制：阈值取 768 / 1024 还是别的、UA 命中算不算、
 * 中间段怎么处理，换个产品就变。这些一旦下沉，主题库就得认识宿主的口径，别的项目复用
 * 机制时被迫沿用同一套约定。所以库只留「设备域 + 注入点 `resolveDevice`」，
 * 判定实现留在宿主（本文件），由 `theme/views/devices.ts` 组合成解析函数。
 *
 * === 判定口径（三级，宽视口优先于 UA）===
 *   1. 视口 ≥ 1024px（DESKTOP_MIN_WIDTH）→ 电脑版（UA 说什么都不例外）
 *   2. 视口 < 768px（MOBILE_BREAKPOINT）→ 移动端
 *   3. 中间段（768–1023）→ UA 命中真机才算移动端（该区间可能是被缩放的桌面浏览器）
 *
 * === 为什么宽视口优先于 UA（2026-09-21 线上问题）===
 * 平板横屏 / 折叠屏展开 / 手机开「桌面版网站」时 UA 仍报手机、视口却有 1024px+，
 * 恒定按 UA 判移动端会把移动端版式铺满整屏。宽度比 UA 更贴近「这块屏放不放得下
 * 桌面布局」这个真问题。
 *
 * === 同一份口径的三类消费方 ===
 *   · 设备域 `resolveDevice`（决定渲染哪台设备）—— 一次性同步判定 `isMobileViewport()`
 *   · 路由守卫 / 请求拦截 / Authorize（决定跳哪个登录页）—— 同一个 `isMobileViewport()`
 *   · 组件里的响应式形态（`composables/useDeviceDetect`）—— 用 `watchViewport()` 订阅
 *
 * @author yijiu2025
 * @since 2026-09-21
 * @since 2026-10-19（从 skinsuite/vue 收回：判定属于宿主，不再下沉）
 */

/** 移动端判定阈值（px）：窄于它说明视口放不下桌面双栏布局 */
export const MOBILE_BREAKPOINT = 768;

/** 桌面端判定阈值（px）：宽于等于它说明屏幕放得下完整桌面布局（对齐 Tailwind lg 断点） */
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * UA 兜底检测：视口宽度会被窗口缩放 / 分屏 / DevTools 模拟影响，
 * UA 能识别「真手机/平板」（新版 iPad UA 已不含 iPad，走 maxTouchPoints 兜底）。
 */
export function detectMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua);
  const iPadLike =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1);
  return uaMobile || iPadLike;
}

/** 视口是否已宽到该用电脑版（只看宽度，不看 UA） */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= DESKTOP_MIN_WIDTH;
}

/** 当前是否应按移动端处理（一次性判定；SSR / 无 window 环境返回 false = 桌面默认） */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDesktopViewport()) return false;
  if (detectMobileUA()) return true;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * 订阅「视口形态可能变了」，返回解绑函数
 *
 * 挂在两个阈值断点上（跨断点才回调，无需 scroll/resize 节流）；不支持
 * `matchMedia` 的老 WebView / SSR 降级为 `resize` 监听。
 *
 * 用途：设备域要重判时由宿主调 `refreshDevice()`；`useDeviceDetect` 用它刷新响应式值。
 * ——库不订阅任何视口事件，因为「什么算变了」是宿主的口径。
 */
export function watchViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const mqs: MediaQueryList[] = [];
  if (typeof window.matchMedia === 'function') {
    mqs.push(window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`));
    mqs.push(window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`));
  }

  if (mqs.length === 0) {
    window.addEventListener('resize', onChange);
    return () => window.removeEventListener('resize', onChange);
  }

  for (const mq of mqs) {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    // Safari < 14 旧 API 兜底
    else (mq as unknown as { addListener: (cb: () => void) => void }).addListener(onChange);
  }
  return () => {
    for (const mq of mqs) {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
      else (mq as unknown as { removeListener: (cb: () => void) => void }).removeListener(onChange);
    }
  };
}
