/**
 * 设备形态判定 —— **宿主自己的业务口径**（2026-10-19 从 skinsuite 收回）
 *
 * === 为什么归宿主 ===
 * 「手机还是电脑」是产品决定，不是通用机制：阈值取 768 / 1024 还是别的、UA 命中算不算、
 * 中间段怎么处理，换个产品就变。这些一旦下沉，主题库就得认识宿主的口径，别的项目复用
 * 机制时被迫沿用同一套约定。所以库里**没有任何判定**（2026-10-20：库只经
 * `<ThemeView>` 的 device prop 接收判定结果），判定实现留在宿主（本文件 +
 * `device-resolve.ts`），由**页面分发器**经 `useRenderDevice` 调用选容器；
 * 设备身份由被选中容器内的 `<ThemeView>` props 告知主题 store。
 *
 * === 判定口径（三态，宽视口优先于 UA）===
 *   1. 视口 ≥ 1024px（DESKTOP_MIN_WIDTH）→ 电脑版（UA 说什么都不例外）
 *   2. 视口 < 768px（MOBILE_BREAKPOINT）→ 移动端
 *   3. 中间段（768–1023）→ 平板 UA / 触屏（maxTouchPoints > 1）算平板，其余按 UA 兜底
 *
 * === 为什么宽视口优先于 UA（2026-09-21 线上问题）===
 * 平板横屏 / 折叠屏展开 / 手机开「桌面版网站」时 UA 仍报手机、视口却有 1024px+，
 * 恒定按 UA 判移动端会把移动端版式铺满整屏。宽度比 UA 更贴近「这块屏放不放得下
 * 桌面布局」这个真问题。
 *
 * === 同一份口径的消费方 ===
 *   · 页面分发器（决定渲染哪台设备）—— `viewportDevice()` 响应式设备代码信号 +
 *     `device-resolve.ts` 的组合判定（`composables/useRenderDevice`）
 *   · 路由守卫 / 请求拦截 / Authorize（决定跳哪个登录页）—— 同一个 `isMobileViewport()`
 *   · 组件里的响应式形态（`composables/useDeviceDetect`）—— 用 `watchViewport()` 订阅
 *
 * @author yijiu2025
 * @since 2026-09-21
 * @since 2026-10-19（从 skinsuite/vue 收回：判定属于宿主，不再下沉）
 * @since 2026-10-20（判定消费者改为页面分发器：新增响应式 `mobileViewport()` 信号）
 * @since 2026-10-24（升级三态：中间段拆出平板 `tablet`，布尔信号换成设备代码信号
 *                   `viewportDevice()`，并新增屏幕方向 `screenOrientation()`）
 */
import { ref } from 'vue';
import type { Ref } from 'vue';

/** 移动端判定阈值（px）：窄于它说明视口放不下桌面双栏布局 */
export const MOBILE_BREAKPOINT = 768;

/** 桌面端判定阈值（px）：宽于等于它说明屏幕放得下完整桌面布局（对齐 Tailwind lg 断点） */
export const DESKTOP_MIN_WIDTH = 1024;

/** 视口底层能算出的设备代码（不含 `mini`——那是 URL 来源词汇，不是视口形态） */
export type ViewportDevice = 'standard' | 'tablet' | 'mobile';

/** 屏幕方向（用于需要区分横竖屏的版式） */
export type ScreenOrientationType = 'portrait' | 'landscape';

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

/** 平板 UA 判定：iPad（旧 UA 直报 / 新 UA 走 Macintosh + 触屏）或 Android 平板（无 Mobile 标记） */
export function detectTabletUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iPadLike =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1);
  const androidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  return iPadLike || androidTablet;
}

/** 视口是否已宽到该用电脑版（只看宽度，不看 UA） */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= DESKTOP_MIN_WIDTH;
}

/** 中间段（768–1023）是否该算平板：平板 UA，或触屏（maxTouchPoints > 1） */
export function isTabletViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDesktopViewport()) return false;
  const width = window.innerWidth;
  const inMiddleRange = width >= MOBILE_BREAKPOINT && width < DESKTOP_MIN_WIDTH;
  return (inMiddleRange && detectTabletUA()) || (inMiddleRange && navigator.maxTouchPoints > 1);
}

/** 当前是否应按移动端处理（一次性判定；SSR / 无 window 环境返回 false = 桌面默认） */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  // 桌面或平板视口都不算移动端（平板是独立形态，不再并入移动）
  if (isDesktopViewport() || isTabletViewport()) return false;
  if (detectMobileUA()) return true;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * 核心视口判定：直接返回基础视口对应的设备代码（不含 URL 来源词汇 `mini`）
 *
 * 这是 `device-resolve.ts` 第 4 步「视口」的输入：分发器把 URL 词汇（?device= / ?from= 等）
 * 与这里的视口设备代码合成最终设备。返回 `'standard' | 'tablet' | 'mobile'`。
 */
export function resolveViewportDevice(): ViewportDevice {
  if (typeof window === 'undefined') return 'standard';
  if (isDesktopViewport()) return 'standard';
  if (isTabletViewport()) return 'tablet';
  if (isMobileViewport()) return 'mobile';
  return 'standard';
}

/** 屏幕方向：优先 `screen.orientation.type`，退化为宽高比（老 WebView / SSR） */
export function getScreenOrientation(): ScreenOrientationType {
  if (typeof window === 'undefined') return 'portrait';
  if (typeof window.screen?.orientation?.type === 'string') {
    return window.screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
  }
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

/**
 * 订阅「视口形态可能变了」，返回解绑函数
 *
 * 挂在三个断点上（跨断点才回调，无需 scroll/resize 节流）：≥1024 / ≤767 两个宽度断点
 * 管设备形态切换，`orientation` 管方向翻转。不支持 `matchMedia` 的老 WebView / SSR
 * 降级为 `resize` 监听。
 *
 * 用途：`useDeviceDetect` 等需要自行订阅的组件；页面分发器不直接用它 ——
 * 读下面的 `viewportDevice()` 响应式信号即可（内部就是它）。
 */
export function watchViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const mqs: MediaQueryList[] = [];
  if (typeof window.matchMedia === 'function') {
    mqs.push(window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`));
    mqs.push(window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`));
    mqs.push(window.matchMedia('(orientation: portrait)'));
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

/* ==========================================================================
 * 响应式视口信号（页面分发器的设备判定依赖它）
 *
 * 分发器判定设备的 computed 需要"视口变了就重判"：拉宽窗口从手机版切电脑版 /
 * 切平板。做成模块级 ref + 首次读取时惰性绑定 `watchViewport`（跨断点 / 翻转才更新，
 * 不产生 resize 级抖动）。读即绑定，用完不管 —— 应用级单例，随页面生命周期常驻。
 * ========================================================================== */
/** 当前视口判定的设备代码（模块级单例信号） */
const viewportDeviceRef = ref<ViewportDevice>('standard');

/** 当前屏幕方向（模块级单例信号） */
const orientationRef = ref<ScreenOrientationType>('portrait');

/** watchViewport 是否已绑定（只绑一次） */
let viewportWatchBound = false;

function ensureViewportWatch(): void {
  if (viewportWatchBound || typeof window === 'undefined') return;
  viewportWatchBound = true;

  const updateState = () => {
    viewportDeviceRef.value = resolveViewportDevice();
    orientationRef.value = getScreenOrientation();
  };

  updateState();
  watchViewport(updateState);
}

/**
 * 响应式「当前视口判定的设备代码」—— 页面分发器的设备判定 computed 依赖它
 *
 * ```ts
 * // utils/device-resolve.ts 的判定纯函数由 composables/useRenderDevice 喂它：
 * // resolveRenderDevice(query, path, viewportDevice().value)
 * ```
 * 拉宽 / 缩窄窗口跨断点时信号翻转（standard ↔ tablet ↔ mobile）→ 分发器 computed
 * 重算 → 换容器（设备身份由新容器内的 `<ThemeView>` props 告知主题 store）。
 */
export function viewportDevice(): Readonly<Ref<ViewportDevice>> {
  ensureViewportWatch();
  return viewportDeviceRef;
}

/** 响应式「当前屏幕方向」—— 需要按横竖屏切版式的地方订阅它 */
export function screenOrientation(): Readonly<Ref<ScreenOrientationType>> {
  ensureViewportWatch();
  return orientationRef;
}
