/**
 * 抹除 URL 中「一次性敏感凭证」类 query 参数（如重置密码 token）。
 *
 * 这类参数一旦留在地址栏，会进入浏览器历史 / 截图 / Referer / 日志，
 * 属于「可当密码用」的凭证，用完必须立即从 URL 抹掉 —— 只改地址栏，不触发路由跳转。
 *
 * @param keys 要抹掉的参数名（默认重置密码 token 与 OAuth state）
 */
export function clearUrlQuery(keys: string[] = ['token', 'state']): void {
  if (typeof window === 'undefined' || !window.history) return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of keys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/** 会携带一次性凭证 / 敏感信息的 query 参数名（上报、日志前应剥掉） */
const SENSITIVE_QUERY_KEYS = ['token', 'state', 'code', 'password', 'access_token', 'refresh_token', 'id_token', 'sid'];

/**
 * 净化 URL 字符串：剥掉敏感 query 参数，保留 path + 其余 query + hash。
 * 用于错误上报 / 日志等场景，避免把「可当密码用」的凭证（token/state/验证码）写进后端日志。
 * 纯函数，不改地址栏、不做跳转。
 */
export function stripSensitiveQuery(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl, typeof location !== 'undefined' ? location.origin : 'http://localhost');
    for (const key of SENSITIVE_QUERY_KEYS) {
      url.searchParams.delete(key);
    }
    return url.pathname + url.search + url.hash;
  } catch {
    // 畸形 URL 兜底：退化为只取 path（不解析 query）
    const idx = rawUrl.indexOf('?');
    return idx === -1 ? rawUrl : rawUrl.slice(0, idx);
  }
}
