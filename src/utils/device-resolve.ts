/**
 * 「本次访问渲染哪台设备」—— **宿主自己的判定模块**（词汇全在宿主，零主题依赖）
 *
 * === 形态（2026-10-20 重构）===
 * 一个**纯函数** `resolveRenderDevice(query, path, mobile)`：输入全是事实（路由 query /
 * path + 视口是否移动），输出设备 id 或 `null`（无显式倾向）。不 import 主题库、不建
 * 响应式、不碰 store —— 页面分发器经 `composables/useRenderDevice.ts` 薄封装调用
 * （那里负责把 route / 视口信号接进来）。
 *
 * === 为什么放 utils、不放 `theme/views/` ===
 * `src/theme/` 是**主题域**：`themes/`（主题包）+ `views/`（纯声明：`defineThemePage` /
 * `defineThemeDevice`）+ `theme.config.ts`。整包可以搬到另一个前端，所以那里只能放
 * **声明与契约**，不能放运行时判断 —— 否则 `virtual:theme` 会把判定代码跟着主题域
 * 一起拉进包，「主题域可整体迁移」这条不再成立。判定词汇（`?device=` / `?from=` …）
 * 是宿主业务，住在本文件 + `utils/device.ts`（视口口径与信号）。
 *
 * === 优先级（高 → 低）===
 * 1. `?device=<id>` 一次性锁定（压过一切，视口缩放不切换；原样返回，合法性交给
 *    分发器的设备 Map —— 未命中即落清单末条，与库 `resolveContainerOf` 同口径）
 * 2. `?isMobile=true` 显式手机意图，压过下面的来源标记（窗口里点「用手机端打开」）
 * 3. 来源标记：`?from=mini` / `?fromLogin=mini` / 路径含 `mini` → 紧凑版；
 *    `?from=tablet` → 平板（iframe 弹窗 / 平板落地页各自的来源约定）
 * 4. 视口（调用方传 `mobile`，口径见 `utils/device.ts`：宽视口优先于 UA）
 * 5. 兜底：返回 `null` = 由调用方（分发器）落设备清单末条
 *
 * @author yijiu2025
 * @since 2026-10-19（判定从主题库收回，落在宿主 utils 层；`theme/views/devices.ts` 回到纯声明）
 * @since 2026-10-20（改纯函数：调用方从「库注入 / 分发器 composable」改为宿主的
 *                   `useRenderDevice`，本文件零 import 零状态）
 */

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
 * 判定「本次访问渲染哪台设备」—— 宿主 URL 词汇 + 视口口径
 *
 * 纯函数：所有输入显式传入（query / path / mobile），无闭包状态、无 import。
 * 返回 `null` 表示「没有显式倾向」，调用方落设备清单末条（兜底设备）。
 *
 * @param query 当前路由 query（`route.query`）
 * @param path 当前路由 path（`route.path`，来源标记判定用）
 * @param mobile 视口是否该按移动端处理（`mobileViewport().value`，响应式信号）
 */
export function resolveRenderDevice(
  query: Record<string, unknown>,
  path: string,
  mobile: boolean
): string | null {
  // 1) 一次性锁定（宿主 URL 词汇）：原样返回，未知 id 由分发器 Map 兜底
  const locked = text(query, 'device');
  if (locked) return locked;

  // 2) 显式手机意图：来源标记一律让位
  if (text(query, 'isMobile') === 'true') return 'mobile';

  // 3) 来源标记
  const from = text(query, 'from');
  const fromLogin = text(query, 'fromLogin');
  if (from === 'mini' || fromLogin === 'mini' || pathHasSegment(path, 'mini')) return 'mini';
  if (from === 'tablet') return 'tablet';

  // 4) 视口（mobileViewport 信号已含 UA 兜底，口径见 utils/device.ts）
  if (mobile) return 'mobile';

  // 5) 兜底：没有显式倾向 → 调用方落清单末条
  return null;
}
