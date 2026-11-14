/**
 * 独立授权确认页（`/consent`）「版式契约」—— 业务容器 ⇄ UI 之间的唯一接口（**纯类型，无运行时**）
 *
 * === 职责划分（改版式前必读）===
 * ```
 * view/web/auth/Consent.vue        业务容器：两种授权来源的凭据解析（session_id / consent_key）/
 *        │                         consent 提交 / iframe 通知父窗口 / 回跳
 *        │  传 ctx（= 本文件定义的 ConsentViewContext）
 *        ▼
 * theme/themes/<包>/<设备>/consent/index.vue
 *                                  版式：只渲染 ctx、只调 ctx.actions
 * ```
 *
 * **版式里禁止出现**：`@/api/*` 请求、`postToParent`、`router.replace/back`、
 * 凭据是否齐全的判断（容器已给 `paramsMissing` / `done`）。
 * 允许出现：布局、样式、静态装饰、图标。
 *
 * === 与 `<ConsentPanel>` 的关系 ===
 *   权限明细 + 批准/拒绝这对按钮由 `components/auth/ConsentPanel.vue` 提供，
 *   登录页内嵌面板与本独立页**共用同一份** —— 版式只负责外壳（头部与完成/缺参两态），
 *   不要把权限列表再抄一遍：抄了就等于第三份实现，改文案要改三处。
 *
 * @author yijiu2025
 * @since 2026-11-15（自 `view/web/auth/Consent.vue` 内联 template 抽出）
 */
import { defineThemePage } from 'skinsuite/vue';

/** 版式用的翻译函数（只给「key + 命名参数」这一子集） */
export type ConsentTranslate = (key: string, params?: Record<string, unknown> | string) => string;

/** 交给 `<ConsentPanel>` 的一条权限明细（与 `components/auth/ConsentPanel.vue` 的 props 同形） */
export interface ConsentScopeDetail {
  id: string;
  name: string;
  desc: string;
  required?: boolean;
}

/** 交给 `<ConsentPanel>` 的授权状态（同形，勿改字段名：组件直接读这些键） */
export interface ConsentPanelState {
  /** 登录流的授权凭据（authorize 流为空串） */
  consentKey: string;
  /** 应用展示名 */
  client_name: string;
  scopeDetails?: ConsentScopeDetail[];
}

/** 版式可触发的行为 */
export interface ConsentViewActions {
  /** 同意授权（容器按来源分支提交，并负责 iframe 通知 / 回跳） */
  approve(): void;
  /** 拒绝授权 */
  deny(): void;
}

/** 版式拿到的全部上下文 */
export interface ConsentViewContext {
  /** 翻译函数 */
  t: ConsentTranslate;

  // ---- 三种终态（容器已判定，版式按顺序取值）----
  /** 授权已完成但无回跳目标（登录流的收尾提示）；true 时只渲染成功态 */
  done: boolean;
  /** 凭据缺失（既无 `session_id` 也无 `consent_key`）—— 只渲染引导 */
  paramsMissing: boolean;
  /** 提交中（按钮禁用 + 加载态） */
  submitting: boolean;

  /** 应用展示名（容器已按 query 回退链算好） */
  clientName: string;
  /** 交给 `<ConsentPanel>` 的授权数据 */
  consentState: ConsentPanelState;

  /** 当前是否暗色（决定版式根节点的 `dark` class） */
  isDark: boolean;

  actions: ConsentViewActions;
}

/** 版式组件的 props（`<ThemeView>` 原样透传） */
export interface ConsentViewProps {
  ctx: ConsentViewContext;
}

/**
 * 版式机制：注册进页面域（`<ThemeView page="consent">` 据此查找主题包里的版式）。
 * 页面名 = 目录名 = 本文件名 = 主题包内的子目录名，四处字面一致。
 */
defineThemePage({ page: 'consent' });
