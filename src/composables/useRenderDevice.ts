/**
 * 「当前该渲染哪台设备」—— 页面分发器的设备事实源（薄 composable，零主题依赖）
 *
 * === 职责边界（2026-10-20 定妆）===
 * 判定逻辑全在 `utils/device-resolve.ts`（纯函数，URL 词汇 + 视口口径）。本文件只做
 * **接线**：把 `route.query` / `route.path` 与 `mobileViewport()` 响应式信号接进那个
 * 纯函数，包成一个 computed —— 视口跨断点翻转 / 路由变化即重判。
 *
 * 页面分发器（`view/web/login/index.vue` 等）的用法：
 * ```ts
 * const device = useRenderDevice();           // Readonly<Ref<string | null>>
 * const activeComponent = computed(() =>
 *   deviceComponents.get(device.value ?? fallbackDevice()) ??
 *   deviceComponents.get(fallbackDevice())!
 * );
 * ```
 * 🔴 分发器**不碰主题**：不 import store、不 `setActiveDevice`。设备身份由被选中
 *    容器内的 `<ThemeView page="login" device="mini">` props 告知主题 store ——
 *    「选容器」与「告知主题」因此不会分家（同一个 props，同帧生效）。
 *
 * @author yijiu2025
 * @since 2026-10-19（分发器设备判定从设备域 currentDevice() 收回宿主）
 * @since 2026-10-20（改薄封装：判定逻辑下沉 utils/device-resolve.ts 纯函数，本文件零 import 主题库）
 */
import { computed } from 'vue';
import type { Ref } from 'vue';
import { useRoute } from 'vue-router';
import { mobileViewport } from '@/utils/device';
import { resolveRenderDevice } from '@/utils/device-resolve';

/**
 * 当前该渲染的设备 id（`null` = 无显式倾向，调用方落设备清单末条）
 *
 * computed 同步求值：`resolveRenderDevice` 里读的 `mobileViewport()` ref 与
 * `route.query` / `route.path` 都会被自动收集 —— 视口跨 768/1024 断点翻转、
 * 路由变化（如 `/mini/login` → `/login`）即重判，无需任何显式订阅。
 */
export function useRenderDevice(): Readonly<Ref<string | null>> {
  const route = useRoute();
  return computed(() => resolveRenderDevice(route.query, route.path, mobileViewport().value));
}
