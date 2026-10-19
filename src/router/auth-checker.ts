/**
 * 认证状态检查
 *
 * 当前用 sid cookie 的简单检查（后端 Session 体系在 sid 上），
 * 未来若改成 Pinia store，只需替换本函数实现，调用方不变。
 */
export function isAuthenticated(): boolean {
  // 精确匹配名为 `sid` 的 cookie（而不是 `includes('sid=')`——那会误判 `osid=`/`mysid=` 这类名）
  return document.cookie.split(';').some(c => c.trim().startsWith('sid='));
}
