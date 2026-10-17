/**
 * 后端下发的主题配置 —— **宿主接线壳**（取数骨架已下沉到 `skinsuite/vue`）
 *
 * === 机制已下沉（2026-10-17）===
 * 「fetch + 超时 + 失败静默 + 归一形状」的骨架收进内核 `skinsuite/vue` 的
 * `fetchRemoteThemeConfig(clientId, options)`；本文件只注入**宿主事实**：
 *   · 端点 `VITE_THEME_ENDPOINT`（env）
 *   · 超时上限 3000ms
 *   · 不带 cookie（免鉴权公开端点）
 *
 * 形状契约（「哪些字段算数、`skin` 是不是旧名字」）在 `skinsuite` 的
 * `normalizeRemoteThemeConfig` —— 与取数无关的纯契约，已收进纯内核。
 *
 * @author yijiu2025
 * @since 2026-10-17（退化为接线壳）
 */
import { fetchRemoteThemeConfig as coreFetchRemoteThemeConfig } from 'skinsuite/vue';
import type { RemoteThemeConfig } from 'skinsuite';

export type { RemoteThemeConfig } from 'skinsuite';

/** 配置在 .env 里；未配置则整个机制不生效 */
const ENDPOINT = import.meta.env.VITE_THEME_ENDPOINT as string | undefined;

/** 超时上限：超过就放弃，不能让主题请求拖慢登录首屏 */
const TIMEOUT_MS = 3000;

export function isRemoteThemeEnabled(): boolean {
  return typeof ENDPOINT === 'string' && ENDPOINT.trim().length > 0;
}

export function fetchRemoteThemeConfig(clientId?: string): Promise<RemoteThemeConfig | null> {
  return coreFetchRemoteThemeConfig(clientId, {
    endpoint: ENDPOINT ?? '',
    timeoutMs: TIMEOUT_MS,
    omitCredentials: true
  });
}
