import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue';
import { isMobileViewport, watchViewport } from '@/utils/device';

/**
 * 响应式设备形态（视口为主，UA 兜底）—— 组件里读「现在该不该用手机版」
 *
 * 用途：登录 / 注册 / 忘记密码分发器在 URL 未显式携带 isMobile 参数时，按屏幕宽度自动
 * 切到手机端页面（窄窗口 / 真机直接打开 `/register` 不再难看）。
 *
 * === 口径只有一份（2026-10-19 收口）===
 * 判定实现全在 `@/utils/device` 的 `isMobileViewport()`（宽视口 ≥1024 优先 → 窄视口
 * <768 → UA 兜底）。本 composable 只是把它包成响应式：
 *   · 初值：setup 期同步算一次（否则真机首帧先按桌面渲染再切换，闪一下）
 *   · 更新：`watchViewport()` 挂在 768 / 1024 两个断点上，跨断点才回调
 *
 * 🔴 这里**不再自己写阈值与 matchMedia**。以前它和 `utils/device` 各写一份同样的逻辑，
 *    改一处忘一处就是「设备域判手机、分发器判桌面」这类无从归因的错位。
 *
 * 注意：请在组件 setup 中调用（内部注册 onMounted / onUnmounted）。
 */
export function useDeviceDetect(): { isMobileDevice: Readonly<Ref<boolean>> } {
  // setup 期先算一次：真机首帧就是正确形态
  const isMobileDevice = ref(isMobileViewport());
  let stop: (() => void) | undefined;

  onMounted(() => {
    isMobileDevice.value = isMobileViewport();
    stop = watchViewport(() => {
      isMobileDevice.value = isMobileViewport();
    });
  });

  onUnmounted(() => {
    stop?.();
    stop = undefined;
  });

  return { isMobileDevice: readonly(isMobileDevice) };
}
