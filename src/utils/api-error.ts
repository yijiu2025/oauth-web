/**
 * 后端领域错误码 → 给人看的文案
 *
 * 后端约定异常消息形如 `CODE:中文说明`（`SEND_CODE_FAILED:发送过于频繁，请在 35 秒后再试`、
 * `INVALID_PARAM:页码不合法` …）。`CODE` 是给程序分支用的，**不该出现在界面上** ——
 * 直接展示等于把内部实现漏给用户，日志里也难读。
 *
 * 剥离条件刻意收窄：必须是「全大写码 + 冒号 + 后面还有内容」。
 * 这样普通文案里的冒号（`https://…`、`12:30`、`原因：xxx`）不会被误伤：
 * 小写字母开头的 `https` 不匹配，中文全角冒号也不匹配。
 *
 * @example
 * humanizeApiMessage('SEND_CODE_FAILED:发送过于频繁，请在 35 秒后再试')
 * // => '发送过于频繁，请在 35 秒后再试'
 * humanizeApiMessage('https://example.com 不可达') // 原样返回
 *
 * @param message 原始消息（未知类型，来自 catch）
 * @param fallback `message` 为空时的兜底文案
 * @returns 去掉领域码的可展示文案
 */
const DOMAIN_CODE = /^[A-Z][A-Z0-9_]{2,}:(?=\S)/;

/** 只有码、没有说明（`SEND_CODE_FAILED:` / `SEND_CODE_FAILED: `）——这种情况没有可展示内容 */
const CODE_ONLY = /^[A-Z][A-Z0-9_]{2,}:\s*$/;

export function humanizeApiMessage(message: unknown, fallback = '请求失败'): string {
  const raw = typeof message === 'string' ? message.trim() : '';
  if (!raw) return fallback;
  if (CODE_ONLY.test(raw)) return fallback;
  const stripped = raw.replace(DOMAIN_CODE, '').trim();
  return stripped || fallback;
}
