/**
 * OAuth 2.1 授权域 —— 授权状态检查 + 授权确认/拒绝。
 *
 * 安全边界：
 *   · 授权后跳转的目标地址**只信后端返回值**（后端按注册的 redirect_uri 校验并拼接 code），
 *     前端绝不直接采信 `query.redirect_uri` —— 那会被篡改成开放重定向。
 *   · 本层只做「查询参数透传 + 提交确认」，不做任何授权判定。
 */
import request from '@/utils/request';
import type { OAuthAuthorizeParams } from './types';

export const authorizeApi = {
  /**
   * 检查授权状态 (获取当前 Cookie 登录用户信息)
   * 返回 {action:'login'|'consent', client_name, scope, sessionId, user}
   */
  async checkAuthorize(params: OAuthAuthorizeParams) {
    return request.get('/oauth2.1/authorize', { params });
  },

  /**
   * 提交授权确认/拒绝 (针对已登录用户)
   * 后端签发 authorization_code 并 302 重定向到 redirect_uri
   */
  async authorizeConsent(data: { sessionId: string; user_id: string; action: 'approve' | 'deny' }) {
    return request.post('/oauth2.1/authorize/consent', data);
  }
};
