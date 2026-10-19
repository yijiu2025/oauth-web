/**
 * 404 页面文案（namespace = `not_found`）
 *
 * 文件组织规则见 `login.ts` 头注释（或 docs/standards/frontend-standards.md §10）。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 i18n/index.ts 拆分）
 */

const zh = {
  title: '页面未找到',
  desc: '抱歉，您访问的地址不存在。',
  back: '返回上页',
  home: '返回登录',
  brand_desc: '您访问的页面不存在或已被移除。'
};

const en: Record<keyof typeof zh, string> = {
  title: 'Page Not Found',
  desc: 'Sorry, the address you visited does not exist.',
  back: 'Go Back',
  home: 'Back to Login',
  brand_desc: 'The page you visited does not exist or has been removed.'
};

export default { zh_cn: zh, en };
