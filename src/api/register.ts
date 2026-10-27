/**
 * 注册域 —— 账户注册 + 邮箱查重。
 *
 * 安全边界：
 *   · `register` 的 `password` 已是 RSA 密文（`kid` 标明公钥版本），本层原样透传、不做任何密码处理。
 *   · 邮箱查重只用于「输入框失焦时提示已注册」，是 UX 反馈，**不是**安全校验 ——
 *     真正防重由后端在注册提交时兜底。
 */
import request from '@/utils/request';
import type { RegisterPayload } from './types';

export const registerApi = {
  /**
   * 注册请求
   * @param data 注册信息（密码已 RSA 加密，字段契约见 RegisterPayload）
   */
  async register(data: RegisterPayload) {
    return request.post('/user/v1/register', data);
  },

  /**
   * 校验邮箱是否重复
   * @param email 邮箱
   */
  async checkEmail(email: string) {
    return request.get('/user/v1/check-email', { params: { email } });
  }
};
