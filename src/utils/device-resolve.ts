/**
 * 「本次访问属于哪台设备」—— **宿主的设备判定口径**
 *
 * === 为什么放在 utils、不放 `theme/views/` ===
 * `src/theme/` 是**主题域**：`themes/`（主题包）+ `views/`（纯声明：`defineThemePage` /
 * `defineThemeDevice`）+ `theme.config.ts`。整包可以搬到另一个前端，所以那里只能放
 * **声明与契约**，不能放运行时判断 —— 否则：
 *   · `virtual:theme` 会把 `views/*.ts` 当声明副作用 import，判定代码跟着主题域一起被拉进包；
 *   · 「主题域可整体迁移」这条不再成立（搬过去就得连带搬 URL 词汇 / 视口阈值）。
 *
 * 判定依赖三样**宿主事实**：`?device=` / `?isMobile` / `?from=` 这些本产品的 URL 词汇、
 * 视口与 UA（`utils/device.ts`）、以及设备域已注册的清单（`skinsuite/vue`）。
 * 三者都是宿主的，所以它住在宿主的 utils 层。
 *
 * === 库为什么不判 ===
 * 主题库只提供「设备域 + 注入点 `resolveDevice`」：把 router 的 `query / path / fullPath`
 * 原样递进来。库一旦认识 768 / `?isMobile` / `?device=`，别的项目复用它就被绑死。
 *
 * === 优先级（高 → 低）===
 * 1. `?device=<id>` 一次性锁定（压过一切；非法值**不静默换设备**，继续走自动判定，
 *    免得链接写错就看不到默认形态）
 * 2. `?isMobile=true` 显式手机意图，压过下面的来源标记（窗口里点「用手机端打开」）
 * 3. 来源标记：`?from=mini` / `?fromLogin=mini` / 路径含 `mini` → 紧凑版；
 *    `?from=tablet` → 平板（iframe 弹窗 / 平板落地页各自的来源约定）
 * 4. 视口 + UA（`isMobileViewport()`，宽视口优先于 UA，口径见 `utils/device.ts`）
 * 5. 兜底：`fallbackDevice()`（= 清单末条，`standard`）
 *
 * @author yijiu2025
 * @since 2026-10-19（判定从主题库收回，落在宿主 utils 层；`theme/views/devices.ts` 回到纯声明）
 */
import { fallbackDevice, isKnownDevice } from 'skinsuite/vue';
import type { DeviceDomainContext } from 'skinsuite/vue';
import { isMobileViewport } from './device';

/** 从 query 取字符串值；非字符串（数组 / 数字 / 缺失）一律当空串 */
function text(query: Record<string, unknown>, key: string): string {
  const value = query[key];
  return typeof value === 'string' ? value : '';
}

/** 路径是否含某整段/前缀（`mini` 匹配 `/mini/login` 或旧 `mini-login`） */
function pathHasSegment(path: string, prefix: string): boolean {
  return path
    .split('/')
    .filter(Boolean)
    .some(seg => seg === prefix || seg.startsWith(`${prefix}-`));
}

/**
 * 判定「本次访问属于哪台设备」
 *
 * 返回 `null` 表示「交回兜底」（库会落到清单末条设备）。
 */
export function resolveCurrentDevice(ctx: DeviceDomainContext): string | null {
  const { query, path } = ctx;

  // 1) 一次性锁定（宿主 URL 词汇）
  const locked = text(query, 'device');
  if (isKnownDevice(locked)) return locked;

  // 2) 显式手机意图：来源标记一律让位
  if (text(query, 'isMobile') === 'true') return 'mobile';

  // 3) 来源标记
  const from = text(query, 'from');
  const fromLogin = text(query, 'fromLogin');
  if (from === 'mini' || fromLogin === 'mini' || pathHasSegment(path, 'mini')) return 'mini';
  if (from === 'tablet') return 'tablet';

  // 4) 视口 / UA
  if (isMobileViewport()) return 'mobile';

  // 5) 兜底（末条设备）
  return fallbackDevice() || null;
}
