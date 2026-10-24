/**
 * 设备模块纯工具 —— 零主题知识、零状态的通用函数（库级别）
 *
 * 与 skinsuite 的同名导出**同口径维护**（改一处查另一处）：设备层与主题库分家后，
 * 这几件宿主拷贝住在这里 —— 它们本就是通用工具，不构成「库持有设备」。
 *
 * @author yijiu2025
 * @since 2026-10-24（从 wiring/useDevicePage 内联实现转正为模块级工具）
 */
import type { DeviceContainerLoader } from './types';

/** 目录名 / id 白名单（与 skinsuite 的 THEME_ID_RE 同一规则，改一处查另一处） */
export const ID_RE = /^[a-z0-9-]+$/;

/**
 * glob 结果 →「页面 → 加载器」表（skinsuite/vue 同名纯函数的宿主拷贝）
 * 位置约定：页面名 = 容器文件的**上一级目录名**；目录名不过白名单静默跳过
 */
export function pageContainers(
  mods: Record<string, DeviceContainerLoader>,
  fileRe: RegExp
): ReadonlyMap<string, DeviceContainerLoader> {
  const map = new Map<string, DeviceContainerLoader>();
  for (const [key, loader] of Object.entries(mods)) {
    const parts = key.split('/');
    const file = parts[parts.length - 1];
    const page = parts[parts.length - 2];
    if (!page || !file || !fileRe.test(file) || !ID_RE.test(page)) continue;
    if (!map.has(page)) map.set(page, loader);
  }
  return map;
}

/** 容器解析：精确命中 → 末条设备兜底 → 都没有则返回拒绝的加载器（响亮失败） */
export function lookupContainer(
  defs: readonly { id: string; containers: ReadonlyMap<string, DeviceContainerLoader> }[],
  id: string,
  page: string
): DeviceContainerLoader {
  const byId = (deviceId: string) => defs.find(d => d.id === deviceId)?.containers.get(page);
  const fallbackId = defs[defs.length - 1]?.id;
  return (
    byId(id) ??
    (fallbackId === undefined ? undefined : byId(fallbackId)) ??
    (() => Promise.reject(new Error(`[devices] 设备「${id}」在页面「${page}」没有容器，也没有兜底设备`)))
  );
}
