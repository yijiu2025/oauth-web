/**
 * 密码重置域 —— 验证码重置 / 邮件链接重置。
 *
 * 安全边界：
 *   · 新密码一律以 RSA 密文提交（`encryptedPassword` + `kid`），明文密码绝不出现在请求里。
 *   · 邮件链接重置的 `token` 是「可当密码用」的一次性凭证：调用方用完后要立刻从 URL 抹掉
 *     （见 `@/utils/clear-url-query`），本层只负责透传、不落日志。
 */
import request from '@/utils/request';

export const passwordApi = {
  /**
   * 验证码方式重置密码
   * 校验邮箱码（绑 sessionId=captchaKey + 指纹）后改密码
   * newPassword 为 RSA 加密密文，后端用 kid 解密
   */
  async resetPassword(email: string, code: string, encryptedPassword: string, captchaKey?: string, kid?: string | null) {
    return request.post('/user/v1/reset-password', { email, code, password: encryptedPassword, captchaKey, kid: kid || undefined });
  },

  /**
   * 发送密码重置链接到邮箱
   * 需先通过图形验证码（captchaKey 由前端 GraphicCaptcha 校验后获得）
   * 后端校验 captchaKey 已 verified + 一次性消费 + 绑指纹 + 发邮件
   */
  async sendResetLink(email: string, captchaKey: string) {
    return request.post('/user/v1/send-reset-link', { email, captchaKey });
  },

  /**
   * 通过链接 token 重置密码
   * newPassword 为 RSA 加密密文，后端用 kid 解密
   */
  async resetPasswordByLink(token: string, encryptedPassword: string, kid?: string | null) {
    return request.post('/user/v1/reset-password-by-link', { token, password: encryptedPassword, kid: kid || undefined });
  }
};
