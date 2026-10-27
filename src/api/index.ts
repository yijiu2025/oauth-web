/**
 * API 层统一出口 —— 按业务域拆分的各 API 对象 + 契约类型。
 *
 * 导入方式（推荐按需取域，而不是引整个聚合）：
 *   import { loginApi } from '@/api';       // 登录 / 二次验证
 *   import { authorizeApi } from '@/api';   // OAuth 授权
 *   import { registerApi } from '@/api';    // 注册 / 查重
 *   import { captchaApi } from '@/api';     // 图形验证码
 *   import { passwordApi } from '@/api';    // 密码重置
 *   import { qrApi } from '@/api';          // 扫码登录
 *
 * 各域职责与安全边界见各自文件头注释。
 */
export { loginApi } from './login';
export { authorizeApi } from './authorize';
export { registerApi } from './register';
export { captchaApi } from './captcha';
export { passwordApi } from './password';
export { qrApi } from './qr';
export type { LoginPayload, OAuthAuthorizeParams, RegisterPayload } from './types';
