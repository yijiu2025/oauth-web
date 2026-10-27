/**
 * 验证码域 —— 图形验证码 + 短信/邮箱验证码的发送与校验。
 *
 * 安全边界：
 *   · `verifyCaptcha` 的 `captchaKey` 是后端签发、一次性消费的凭证；通过后后端才会
 *     顺带发邮箱码（sendEmail 场景），前端不在本地缓存码值。
 *   · 下方 `sendCode` / `sendEmailCode` / `verifyCode` 为**预留**（当前前端未接入）：
 *     发邮箱码实际走 `verify-captcha`（图形码 + 发码二合一），短信码与通用验码暂无调用方。
 */
import request from '@/utils/request';

export const captchaApi = {
  /**
   * 获取图形验证码 (后端协同)
   */
  async getCaptcha() {
    return request.get('/verify/v1/generate-captcha');
  },

  /**
   * 预验证图形验证码 (如提供 email，后台可同步发送邮件)
   */
  async verifyCaptcha(captchaKey: string, captchaValue: string, email?: string, type?: string) {
    return request.post('/verify/v1/verify-captcha', { captchaKey, captchaValue, email, type });
  },

  // ────────────────────────────────────────────────────────────────
  // 以下三个为「预留」端点：当前前端零调用，先保留待接入，勿当活跃接口依赖。
  // ────────────────────────────────────────────────────────────────

  /**
   * 【预留】发送短信验证码
   * @param phone 手机号
   */
  async sendCode(phone: string) {
    return request.post('/send-code', { phone });
  },

  /**
   * 【预留】发送邮箱验证码 (支持图形验证码校验)
   */
  async sendEmailCode(email: string, captchaKey?: string) {
    return request.post('/user/v1/send-email-code', { email, captchaKey });
  },

  /**
   * 【预留】校验验证码 (通用)
   * @param account 手机或邮箱
   * @param code 验证码
   */
  async verifyCode(account: string, code: string) {
    return request.post('/verify-code', { account, code });
  }
};
