/**
 * 404 页「版式契约」—— 业务容器 ⇄ UI 之间的唯一接口（**纯类型，无运行时**）
 *
 * === 职责划分（改版式前必读）===
 * ```
 * view/web/not-found/{Standard,Mini}NotFound.vue + app/not-found/index.vue  业务容器
 *        │  传 ctx（= 本文件定义的 NotFoundViewContext）
 *        ▼
 * theme/themes/<包>/<设备>/not-found/index.vue
 *                                   版式：只渲染 ctx、只调 ctx.actions
 * ```
 *
 * **版式里禁止出现**（违反即等于把业务复制了一份，两份必然漂移）：
 *   • 任何 `@/api/*` 请求、`router.push`、pinia store 读写
 *   • 任何「该不该跳转」的判断 —— 那是容器的职责（容器决定「返回上页」还是「回登录」）
 * 允许出现：布局、样式、静态装饰、纯展示用局部状态。
 *
 * 404 页没有表单、没有校验、没有第三方登录，是**最简页面契约**：
 * 只有「展示信息 + 两个动作」。
 *
 * @author yijiu2025
 * @since 2026-10-19
 */
import { defineThemePage } from 'skinsuite/vue';

/* ---------------------------------------------------------------------------
 * 契约类型（纯类型）
 * ------------------------------------------------------------------------- */

/**
 * 翻译函数：只暴露「key + （命名参数 | 缺键兜底文案）」这一子集，
 * 版式因此不依赖 vue-i18n 的内部类型；文案键仍在 `src/i18n/not_found.ts` 统一维护。
 */
export type NotFoundTranslate = (key: string, params?: Record<string, unknown> | string) => string;

/** 版式可触发的行为。都是「通知容器去做」，版式自己不实现任何逻辑 */
export interface NotFoundViewActions {
  /** 返回上页（容器决定：有历史就 back，没有则回登录） */
  goBack(): void;
  /** 返回登录 / 首页（容器决定去 `/login` 还是 `/mini-login`） */
  goHome(): void;
}

/** 版式拿到的全部上下文 */
export interface NotFoundViewContext {
  /** 翻译函数 */
  t: NotFoundTranslate;

  // ---- 展示（只读，容器给好文案，版式不要自己拼 key）----
  /** 头部大标题（如「页面未找到」） */
  title: string;
  /** 描述文案（如「抱歉，您访问的地址不存在」） */
  desc: string;
  /** 用户尝试访问的原始路径（decode 后，用于展示与悬停提示） */
  path: string;
  /** 是否深色（驱动版式的明暗态图标 / 配色提示；实际底色由 token 决定） */
  isDark: boolean;

  /** 可触发的行为 */
  actions: NotFoundViewActions;
}

/** 版式组件的 props === 契约本身；各版式统一 `defineProps<NotFoundViewProps>()` */
export interface NotFoundViewProps {
  ctx: NotFoundViewContext;
}

/* ---------------------------------------------------------------------------
 * 版式机制：`defineThemePage({ page })` 一次声明，即注册进页面域（<ThemeView> 的
 * `pageOf` 依赖）。版式组件清单由内核从 `virtual:theme` 装好的单例**惰性解析**，
 * 本文件不再 import `virtual:theme`、也不自己 `import.meta.glob`。
 *
 * 选择优先级（高 → 低；实现收在 `skinsuite/vue` 的 `createViewPicker`）：
 *   `?th[_<设备缩写>]`  >  主题包声明 `views['not-found']`  >  当前包名（view ≡ pkg）
 * ------------------------------------------------------------------------- */
defineThemePage({ page: 'not-found' });
