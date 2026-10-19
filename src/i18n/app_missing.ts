/**
 * 应用标识缺失文案（namespace = `app_missing`）
 *
 * 文件组织规则见 `login.ts` 头注释（或 docs/standards/frontend-standards.md §10）。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 i18n/index.ts 拆分）
 */

const zh = {
  title: '应用标识缺失',
  desc: '缺少 appName 参数，无法提供登录授权服务。'
};

const en: Record<keyof typeof zh, string> = {
  title: 'Application Identifier Missing',
  desc: 'The appName parameter is required to provide login authorization service.'
};

export default { zh_cn: zh, en };
