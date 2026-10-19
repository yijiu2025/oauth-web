/**
 * 授权确认页文案（namespace = `auth`）
 *
 * 文件组织规则见 `login.ts` 头注释（或 docs/standards/frontend-standards.md §10）。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 i18n/index.ts 拆分）
 */

const zh = {
  loading: '正在获取授权信息...',
  app_desc: '该应用申请访问您的基础资料及权限。',
  requests_auth: '申请授权',
  permissions_title: '该应用将获得以下权限',
  required: '必需',
  no_scopes: '该应用未申请额外权限',
  allow_continue: '允许授权并继续',
  processing: '处理中...',
  cancel: '取消',
  footer_hint: '授权后即代表您同意该应用访问您的部分公开数据。您可以随时在安全中心撤销授权。',
  load_failed: '获取授权信息失败',
  approve_failed: '授权失败',
  redirect_missing: '授权成功但未返回跳转地址',
  failed_title: '授权失败',
  params_missing_title: '缺少授权参数',
  params_missing_desc: '请从应用内发起授权，或返回应用重新进入授权页。',
  consent_done_desc: '授权已完成，您可以关闭本页面。',
  consent_missing_desc: '缺少 consent_key 或 session_id，无法确认授权内容。',
  consent_footer_hint: '您可以随时在安全中心撤销该应用的授权。'
};

const en: Record<keyof typeof zh, string> = {
  loading: 'Fetching authorization info...',
  app_desc: 'This app requests access to your basic profile and permissions.',
  requests_auth: 'requests authorization',
  permissions_title: 'This app will receive the following permissions',
  required: 'Required',
  no_scopes: 'This app requests no additional permissions',
  allow_continue: 'Allow and continue',
  processing: 'Processing...',
  cancel: 'Cancel',
  footer_hint: 'By authorizing, you agree to let this app access part of your public data. You can revoke it anytime in the security center.',
  load_failed: 'Failed to fetch authorization info',
  approve_failed: 'Authorization failed',
  redirect_missing: 'Authorized but no redirect URL returned',
  failed_title: 'Authorization Failed',
  params_missing_title: 'Missing Authorization Parameters',
  params_missing_desc: 'Please start authorization from the app, or return to the app and re-enter this page.',
  consent_done_desc: 'Authorization completed. You may close this page.',
  consent_missing_desc: 'Missing consent_key or session_id, unable to confirm the authorization.',
  consent_footer_hint: 'You can revoke this app authorization anytime in the security center.'
};

export default { zh_cn: zh, en };
