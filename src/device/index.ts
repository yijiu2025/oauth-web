/**
 * `src/device/` —— 设备模块（**库级别**：纯机制，零宿主事实、零 skinsuite 依赖）
 *
 * 结构：
 *   · `types.ts`    契约形状（HostDeviceVocab / HostDeviceDef / DeviceContainerLoader）
 *   · `tools.ts`    纯工具（ID_RE / pageContainers / lookupContainer，与 skinsuite 同口径）
 *   · `runtime.ts`  装配工厂 `createDeviceModule({ devices, wiring })` —— 宿主事实
 *                   （词汇数据 + 容器布线）全部注入进来，实例持有 useRenderDevice /
 *                   useDevicePage；词汇校验收口（输出 ⊆ 词汇表）也在这里
 *   · `resolve/`    判定纯函数（viewport.ts 视口三态口径 + render-device.ts 组合判定）
 *   · `useDeviceDetect.ts` 组件用响应式形态（只依赖 resolve）
 *
 * 与主题库唯一相遇点：stores/theme.ts 的 `createThemeState({ devices })`。
 * 宿主事实住 `view/devices.ts`（DEVICES + 布线 + 模块实例装配）；消费方经
 * 该文件拿实例、经本桶拿机制。
 */
export { createDeviceModule } from './runtime';
export type { DeviceModule, DeviceModuleOptions } from './runtime';
export { resolveRenderDevice } from './resolve/render-device';
export {
  MOBILE_BREAKPOINT,
  DESKTOP_MIN_WIDTH,
  isMobileViewport,
  isTabletViewport,
  isDesktopViewport,
  resolveViewportDevice,
  watchViewport,
  viewportDevice,
  screenOrientation
} from './resolve/viewport';
export type { ViewportDevice, ScreenOrientationType } from './resolve/viewport';
export { ID_RE, pageContainers, lookupContainer } from './tools';
export type { DeviceContainerLoader, HostDeviceVocab, HostDeviceInput, HostDeviceDef } from './types';
export { useDeviceDetect } from './useDeviceDetect';
