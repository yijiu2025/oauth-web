/**
 * 认证状态检查（前端「门面」守卫，**不是安全边界**）
 *
 * 只做一件事：把「看起来没登录」的用户挡在 authorize / consent 等需登录页外，
 * 优化体验（避免白屏 + 后端 401 闪烁）。
 *
 * ⚠️ 定位边界（重要）：
 *   客户端伪造 `document.cookie = 'sid=1'` 即可骗过本函数 —— 这是**刻意接受**的：
 *   真正的授权安全边界在**后端**（authorize / consent 接口会校验 sid 对应的
 *   有效 Session，无 Session / Session 过期一律拒绝）。前端这里只是「门面」，
 *   不承载任何安全语义，**不要**试图在这里补「轻量探测」之类伪安全（多一次
 *   请求仍可被绕过，纯属徒增复杂度）。
 *
 * 当前用 sid cookie 的简单检查（后端 Session 体系在 sid 上），
 * 未来若改成 Pinia store，只需替换本函数实现，调用方不变。
 */
export function isAuthenticated(): boolean {
  // 精确匹配名为 `sid` 的 cookie（而不是 `includes('sid=')`——那会误判 `osid=`/`mysid=` 这类名）
  return document.cookie.split(';').some(c => c.trim().startsWith('sid='));
}
