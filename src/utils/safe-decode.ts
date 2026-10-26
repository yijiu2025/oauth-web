/**
 * 安全解码 URI 组件：解码失败时回退到原始串，不抛 URIError。
 *
 * 404 兜底页展示 `route.fullPath` 时用它：用户访问 `/%`、`/%E0%A4%A` 这类畸形 URL，
 * 裸 `decodeURIComponent` 会抛 `URIError` 把 404 页本身搞崩（404 恰恰最不该崩）。
 * 这里解码只是「尽量还原给用户看」，失败就退回原文，无副作用。
 */
export function safeDecodeURIComponent(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
