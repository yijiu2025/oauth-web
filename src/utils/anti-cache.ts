/**
 * 防缓存工具
 *
 * 用于生成随机数戳，防止浏览器缓存静态资源。
 * 主要用途：
 * 1. 防止 CSS/JS 文件被缓存
 * 2. 防止 API 请求被缓存
 * 3. 防止图片等静态资源被缓存
 *
 * ⚠️ 这里只用 `Math.random`：防缓存戳**不承载安全语义**（不是 nonce、不是 token），
 * 只要「每次不同」即可，无需 `crypto.getRandomValues`。需要密码学随机请用
 * `@/utils/crypto` 的 `generateNonce`。
 */

/**
 * 生成随机数（16 位小数）
 * @returns 随机数字符串，如 '0.7164508668310778'
 */
export function generateRandomTimestamp(): string {
  return '0.' + Math.random().toString().substring(2, 18);
}

/**
 * 为 URL 添加防缓存参数
 * @param baseUrl 基础 URL
 * @param params 额外的查询参数
 * @returns 添加了防缓存参数的完整 URL
 */
export function addAntiCacheParam(baseUrl: string, params?: Record<string, string>): string {
  const url = new URL(baseUrl, window.location.origin);
  const rnd = generateRandomTimestamp();

  // 添加防缓存参数
  url.searchParams.set('rnd', rnd);

  // 添加额外参数
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

/**
 * 检查 URL 是否包含防缓存参数
 * @param url URL 字符串
 * @returns 是否包含防缓存参数
 */
export function hasAntiCacheParam(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.searchParams.has('rnd');
  } catch {
    return false;
  }
}
