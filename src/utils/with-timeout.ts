/**
 * 给异步操作加超时（Promise.race 实现）
 *
 * 弱网 / 第三方 SDK 卡死时，rsaEncrypt / getCaptchaToken 等操作不能无限挂起，
 * 否则「提交注册」会一直停在加载态。超时后 reject，调用方按普通错误处理。
 *
 * 注意：这只是「放弃等待」，并不会取消底层 Promise（fetch / SDK 内部仍可能继续），
 * 但对「用户可重试」的提交场景足够 —— 真正的取消需要 AbortSignal，见 crypto.ts
 * 的 fetchPublicKey（已用 AbortSignal.timeout 做真取消）。
 *
 * @param p 要限时的 Promise
 * @param ms 超时毫秒数
 * @param op 操作名（用于超时错误信息，方便定位是哪一步卡住）
 */
export function withTimeout<T>(p: Promise<T>, ms: number, op: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${op} timeout (${ms}ms)`)), ms))
  ]);
}
