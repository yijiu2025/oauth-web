/**
 * 通用校验文案（namespace = `validation`）
 *
 * 文件组织规则见 `login.ts` 头注释（或 docs/standards/frontend-standards.md §10）。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 i18n/index.ts 拆分）
 */

const zh = {
  email_invalid: '请输入有效的邮箱',
  code_min: '请输入验证码',
  username_min: '请输入账号/邮箱',
  password_min: '密码过短'
};

const en: Record<keyof typeof zh, string> = {
  email_invalid: 'Please enter a valid email',
  code_min: 'Please enter the code',
  username_min: 'Please enter username/email',
  password_min: 'Password too short'
};

export default { zh_cn: zh, en };
