/**
 * API 契约类型 —— 请求负载的形状，按「依赖先后」集中收口在此。
 *
 * 设计原则：
 *   · 只放「前端发起请求时要组装的结构」，不放响应类型 —— 响应类型（后端可能改字段）
 *     一律走 `@/types/external` 的 zod 判别联合，避免这里用类型断言读字段。
 *   · 用精确字段而非 `Record<string, any>`：把「某个端点接受哪些参数」的契约固定在
 *     这一处，而不是散落在调用方手写的对象里。
 */
import type { LocationQueryValue } from 'vue-router';

/**
 * 登录请求负载类型
 */
export interface LoginPayload {
  phone?: string;
  email?: string;
  code?: string;
  username?: string;
  password?: string;
  type: 'sms' | 'pwd' | 'email';
}

/**
 * OAuth 授权查询参数（`GET /oauth2.1/authorize`）
 *
 * 字段类型 = vue-router 的 `LocationQueryValue`（即 `string | null` 与 `string[]` 的联合），
 * 与 `route.query` 产出类型一致：直接透传、零转换。
 * 用精确字段而非 `Record<string, any>`：把「授权端点接受哪些参数」的契约固定在
 * 这一处，而非散落在调用方手写的对象里，也不逃逸成 any。
 */
export interface OAuthAuthorizeParams {
  client_id?: LocationQueryValue | LocationQueryValue[];
  redirect_uri?: LocationQueryValue | LocationQueryValue[];
  response_type?: string | LocationQueryValue[];
  scope?: LocationQueryValue | LocationQueryValue[];
  state?: LocationQueryValue | LocationQueryValue[];
  code_challenge?: LocationQueryValue | LocationQueryValue[];
  code_challenge_method?: LocationQueryValue | LocationQueryValue[];
  nonce?: LocationQueryValue | LocationQueryValue[];
}

/**
 * 注册请求负载类型
 *
 * 字段对齐后端 `POST /user/v1/register`（`src/api/user/v1/open.js`）：
 * - `username` / `email` / `code`（邮箱验证码）是表单必填；
 * - `password` 是 RSA 加密后的密文（`kid` 标明用哪把公钥，后端据此解密）；
 * - `captchaKey` 为图形验证码 key（先过图形码才发邮箱码）；
 * - `agreementVersion` / `invite` / `appName` 仅 Mini/Standard 版式透传，
 *   app 容器不传 —— 故标为可选；`recaptchaToken` 仅在启用 reCAPTCHA 时存在。
 */
export interface RegisterPayload {
  username: string;
  email: string;
  /** 邮箱验证码（6 位数字） */
  code: string;
  /** RSA 加密后的密码密文 */
  password: string;
  /** 加密所用公钥的 kid（后端据此选私钥解密） */
  kid: string | null;
  captchaKey: string;
  /**
   * 协议版本快照（`useAgreementVersion` 的 `AgreementVersionSnapshot` 结构）。
   * 这里内联字段而非 import 该类型：api 层不应反向依赖 composable 层
   * （composable 会 import 本文件），避免循环依赖。
   */
  agreementVersion?: { serviceVersion: string; privacyVersion: string; acceptedAt: number };
  invite?: string;
  appName?: string;
  recaptchaToken?: string;
}
