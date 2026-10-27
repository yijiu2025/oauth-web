/**
 * 重定向目标白名单校验（防开放重定向）
 *
 * 用途：?redirect= 回跳（守卫送登录页后把用户送回原页面）、OAuth 回跳前校验等。
 *
 * 规则：只放行站内相对路径
 * - 必须以 / 开头
 * - 排除 //evil.com（协议相对 URL）与 /\evil.com（浏览器会归一化）
 * - 排除含 :// 的绝对 URL（http://... / javascript:... 等）
 *
 * @author yijiu2025
 * @since 2026-09-20
 */

/** 校验通过返回原路径，不通过返回 null（调用方自行决定兜底目标） */
export function sanitizeLocalRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (raw.includes('://')) return null;
  return raw;
}

/**
 * 外域重定向白名单校验（OAuth 授权完成后的 `redirect_url`）
 *
 * 与 `sanitizeLocalRedirect` 互补：这里只放行**绝对 http(s) URL**（授权回调必须落到
 * 客户端注册的回调域）。后端已按注册值校验过 redirect_uri，但前端这层是纵深防御 ——
 * 若后端因配置错误 / 被入侵返回 `javascript:` / `data:` 等 scheme，直接
 * `window.location.href = url` 会执行它们。取不到或非法一律返回 null，由调用方报错。
 */
export function sanitizeExternalRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return raw;
}
