/**
 * 图形验证码域 —— 获取 / 校验图形验证码。
 *
 * 安全边界：
 *   · `verifyCaptcha` 的 `captchaKey` 是后端签发、一次性消费的凭证；通过后后端才会
 *     顺带发邮箱码（sendEmail 场景），前端不在本地缓存码值。
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
  }
};
