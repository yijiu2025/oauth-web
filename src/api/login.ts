/**
 * 登录认证域 —— 用户名/密码/邮箱码登录 + 登录过程中的二次验证。
 *
 * 安全边界（与后端契约，勿改）：
 *   · `login` 的明文负载由 `@/utils/crypto` 做 RSA-OAEP 加密后提交，`nonce`/`timestamp`/
 *     `kid` 也在那里组装（防 replay + 密钥轮换）；本层只做「解构 + 转发 + 解密失败重试」。
 *   · scope 不由前端携带（后端从 client 注册的 scope 兜底 + 边界校验），前端写死既冗余又不安全。
 *   · 二次验证 / 人机验证走 `verifyToken`（后端环境异常 / 风险拦截时下发的临时令牌），
 *     不把凭据拼进 URL。
 */
import request from '@/utils/request';
import { getStableDeviceId } from 'stable-deviceid';
import { rsaEncrypt, clearPublicKeyCache, buildEncryptedLoginPayload } from '@/utils/crypto';
import type { LoginPayload } from './types';

export const loginApi = {
  /**
   * 安全登录
   * @param payload 登录信息（不含 scope/nonce/timestamp，这些由 crypto 层组装）
   * 解密失败时自动清除公钥缓存并重试一次（应对服务器重启密钥轮换）
   */
  async login(payload: Record<string, unknown> & Partial<LoginPayload>) {
    // 入参同时接受强类型 LoginPayload 与流程组装的宽松对象（Record）。
    // captchaKey / client_id 不进密文，拆出来单独透传（client_id 后端需明文查 client）。
    const { captchaKey, client_id, ...rest } = payload as Record<string, unknown>;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const encrypted = await rsaEncrypt(JSON.stringify(rest));
        return await request.post('/oauth2.1/login', {
          ...buildEncryptedLoginPayload(),
          encrypted,
          captchaKey,
          client_id
        });
      } catch (err: unknown) {
        // 解密失败重试：只在首次尝试时判断（err.message 含"解密失败"）
        const message = err instanceof Error ? err.message : '';
        if (attempt === 0 && message.includes('解密失败')) {
          // 公钥可能已过期（服务器重启），清除缓存重试
          clearPublicKeyCache();
          continue;
        }
        throw err;
      }
    }
  },

  /**
   * 快捷登录确认授权
   */
  async confirmConsent(consentKey: string) {
    return request.post('/oauth2.1/login/consent/confirm', { consentKey });
  },

  /**
   * 邮箱二次验证登录（环境异常后二次确认）
   * @param verifyToken directLogin 环境异常时返回的临时令牌
   * @param code 用户输入的邮箱验证码
   */
  async verifyEmailLogin(verifyToken: string, code: string) {
    return request.post('/oauth2.1/login/verify-email', { verifyToken, code });
  },

  /**
   * 风险人机验证（请求被 __risk__ 拦截后调用）
   * 带上风险响应返回的 verifyToken，通过后 30 分钟免验。
   * @param verifyToken 风险响应 __risk__.verifyToken
   * @param captchaKey 图形验证码 key（可选，叠加图形码更严格）
   */
  async verifyChallenge(verifyToken: string, captchaKey?: string) {
    return request.post('/auth/v1/verify-challenge', { captchaKey }, {
      // 显式带 x-device-id：与 verified:${userId}:${deviceId} 标记一致，防拦截器跳过
      headers: { 'x-verify-token': verifyToken, 'x-device-id': getStableDeviceId() }
    });
  },

  /**
   * 重发登录二次验证邮箱码（不需图形码，凭 verifyToken）
   */
  async sendLoginVerifyCode(verifyToken: string) {
    return request.post('/verify/v1/send-login-verify-code', { verifyToken });
  }
};
