/**
 * 版式契约组装的共享工具（各设备容器共用，消除跨容器复制的样板）
 *
 * 登录 / 注册 / 忘记密码 / 404 四类容器的「契约组装」部分高度雷同：
 *   - `FieldSource` / `bindField`：把 vee-validate 的 field 绑定成版式可写的 shape
 *   - `translate`：把「key + 参数」的翻译调用收敛成版式拿到的单参数函数
 *   - `assertContract`：编译期契约自检（运行时零开销的恒等函数）
 *
 * 这些样板一旦在各容器里各写一份，就会像 bindField 的 get/set、translate 的
 * 参数分支一样逐行复制、逐行漂移。收口到一处，改一处全仓生效。
 *
 * @author yijiu2025
 */
import { computed, type Ref } from 'vue';
import type { ComposerTranslation } from 'vue-i18n';

/** 契约里字段绑定的内部构造形态 */
export interface FieldSource {
  value: Ref<string>;
  attrs: Ref<Record<string, unknown>>;
  invalid: Ref<boolean>;
  error: Ref<string | undefined>;
}

/**
 * 把 vee-validate 的 field（value / attrs）与校验态（invalid / error）绑成版式可写的字段源。
 * value 的 get 里做 `?? ''`：vee-validate 初始值为 undefined，版式要的是空串。
 */
export function bindField(
  value: Ref<string | undefined>,
  attrs: Ref<Record<string, unknown>>,
  invalid: Ref<boolean>,
  error: Ref<string | undefined>
): FieldSource {
  return {
    value: computed({
      get: () => value.value ?? '',
      set: next => {
        value.value = next;
      }
    }),
    attrs,
    invalid,
    error
  };
}

/**
 * 构造版式契约里的翻译函数：只把「key + （命名参数 | 兜底文案）」这一子集交给版式。
 * 版式不直接拿 vue-i18n 的 t（避免把整个 Composer 塞进契约、也避免版式乱调 key）。
 */
export function makeTranslate(
  t: ComposerTranslation
): (key: string, params?: string | Record<string, unknown>) => string {
  return (key, params) => {
    if (params === undefined) return t(key);
    return typeof params === 'string' ? t(key, params) : t(key, params as never);
  };
}

/** 编译期契约自检：恒等函数，让容器组装的 ctx 接受 `XxxViewContext` 的类型约束 */
export function assertContract<T>(ctx: T): T {
  return ctx;
}
