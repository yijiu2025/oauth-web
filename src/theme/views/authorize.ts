/**
 * 授权页（`/authorize`）「版式契约」—— 业务容器 ⇄ UI 之间的唯一接口（**纯类型，无运行时**）
 *
 * === 职责划分（改版式前必读）===
 * ```
 * view/web/auth/Authorize.vue     业务容器：OAuth 参数校验 / checkAuthorize 请求 /
 *        │                        consent 提交 / 跳转 redirect_uri / 未登录转登录页
 *        │  传 ctx（= 本文件定义的 AuthorizeViewContext）
 *        ▼
 * theme/themes/<包>/<设备>/authorize/index.vue
 *                                 版式：只渲染 ctx、只调 ctx.actions
 * ```
 *
 * **版式里禁止出现**（违反即等于把业务复制了一份，两份必然漂移）：
 *   • 任何 `@/api/*` 请求、`window.location` / `router.push` 跳转、`sanitizeExternalRedirect` 校验
 *   • 任何"能不能提交 / 该不该跳走"的判断（三项都在容器里；版式只读 `submitting`）
 *   • 应用名 / 描述 / 权限文案的拼装（容器已按 i18n 生成整句，版式直接用）
 * 允许出现：布局、样式、静态装饰、图标。
 *
 * === 与「主题包 / 配色」的关系 ===
 *   主题包（`theme/themes/<包>/`）= 一整套设计，版式与配色都在包里
 *   配色（包内 `colors/<配色>/`）= 只换颜色 / 圆角 / 背景，**同一套 DOM**（靠 CSS 变量）
 *
 * @author yijiu2025
 * @since 2026-11-15（自 `view/web/auth/Authorize.vue` 内联 template 抽出）
 */
import { defineThemePage } from 'skinsuite/vue';

/** 版式用的翻译函数（只给「key + 命名参数」这一子集，不让版式拿整个 Composer） */
export type AuthTranslate = (key: string, params?: Record<string, unknown> | string) => string;

/** 一条申请中的权限（后端 `resolveScopeDetails()` 的产物） */
export interface AuthScopeItem {
  /** 列表 key（`name` 可能重名，别拿它当 key） */
  id: string;
  /** 权限名（人话标题） */
  name: string;
  /** 权限说明（后端给的描述；可能为空串） */
  desc: string;
  /** 必需权限：被拒绝时整笔授权不成立，版式应加醒目标记 */
  required: boolean;
  /** 敏感权限（如读取通讯录）；后端未标记时为 undefined */
  sensitive?: boolean;
}

/** 版式可触发的行为。都是「通知容器去做」，版式自己不实现任何逻辑 */
export interface AuthorizeViewActions {
  /** 同意授权（容器提交 consent 并跳转 `redirect_uri`） */
  approve(): void;
  /** 拒绝授权（容器记录拒绝，跳回 `redirect_uri` 并带 `error=access_denied`） */
  deny(): void;
}

/** 版式拿到的全部上下文 */
export interface AuthorizeViewContext {
  /** 翻译函数 */
  t: AuthTranslate;

  // ---- 三种前置态（容器已判定，版式按顺序取值，别自己再判）----
  /** 正在向后端确认本次授权请求 */
  loading: boolean;
  /** 缺少必要 OAuth 参数（全屏直接打开 `/authorize` 的常见情况）—— 只渲染引导，不给提交按钮 */
  paramsMissing: boolean;
  /** 授权流程出错的文案；空串 = 无错误 */
  errorMessage: string;

  // ---- 授权主体 ----
  /** 发起授权的应用名（缺省时容器已回填「第三方应用」） */
  appName: string;
  /** 应用说明（容器按 i18n 生成的整句，版式直接用） */
  appDescription: string;
  /** 申请权限明细（可能为空数组，此时版式应显示「未声明权限」而不是留白） */
  scopes: readonly AuthScopeItem[];

  // ---- 提交与外观 ----
  /** 提交中（两个按钮都应禁用，主按钮显示加载态） */
  submitting: boolean;
  /** 当前是否暗色（决定版式根节点的 `dark` class） */
  isDark: boolean;

  actions: AuthorizeViewActions;
}

/** 版式组件的 props（`<ThemeView>` 原样透传） */
export interface AuthorizeViewProps {
  ctx: AuthorizeViewContext;
}

/**
 * 版式机制：`defineThemePage({ page })` 一次声明，即注册进页面域
 * （`<ThemeView page="authorize">` 据此查找主题包里的版式）。
 * 页面名 = 目录名 = 本文件名 = 主题包内的子目录名，四处字面一致。
 */
defineThemePage({ page: 'authorize' });
