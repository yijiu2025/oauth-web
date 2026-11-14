<script setup lang="ts">
/**
 * OAuth 授权页（`/authorize`）—— **业务容器**
 *
 * === 分层 ===
 * 本文件只负责「授权这件事」：OAuth 参数校验、`checkAuthorize` 请求、consent 提交、
 * 跳转 `redirect_uri` / 退回上一页、未登录时转登录页。
 * **页面长什么样不在这里**，而在**当前主题包**里的版式组件里：
 *
 *    本容器 ──传 ctx──▶ theme/themes/<包>/<设备>/authorize/index.vue
 *                 ▲
 *                 └── 契约定在 theme/views/authorize.ts（版式只读它）
 *
 * 于是「换一套 UI」= 在包里加一个版式目录，本文件零改动。
 *
 * === 为什么这里也有 device ===
 * 授权页是**路由直挂**（不经 `view/web/<page>/index.vue` 分发器），没有「文件位置即设备身份」
 * 那条线索，所以按视口算一个：窄屏 → `mobile`，其余 → `standard`。
 * 只这两个值（不存在 tablet/mini 的授权形态），主题包里也只需这两个设备目录 +
 * 另外两个转发目录。
 *
 * @author yijiu2025
 * @since 2026-09-20 重写；2026-11-15 版式下沉主题包（本文件退化为薄容器）
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ThemeView } from 'skinsuite/vue';
import { authorizeApi } from '@/api';
import { useDeviceDetect } from '@/device';
import { pickRedirectUrl } from '@/types/external';
import { sanitizeExternalRedirect } from '@/utils/redirect';
import MessageToast from '@/components/common/MessageToast.vue';
import { useMessage } from '@/composables/useMessage';
import { useThemeStore } from '@/stores/theme';
import { makeTranslate, assertContract } from '@/utils/contract-utils';
import type { AuthorizeViewContext, AuthTranslate } from '@/theme/views/authorize';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { error: showError } = useMessage();
const themeStore = useThemeStore();
const { isMobileDevice } = useDeviceDetect();

const loading = ref(true);
const errorMsg = ref('');
/** 缺少必要 OAuth 参数：不属于"出错"，而是访问方式不对，给友好引导 */
const paramsMissing = ref(false);
const appInfo = ref({
  name: '',
  icon: '',
  description: ''
});

// scope 详情由后端返回（resolveScopeDetails 合并系统 registry + client scope_metadata 覆盖）
// 前端不维护 scope→描述映射，避免与后端口径不一致
const scopes = ref<Array<{ id: string; name: string; desc: string; required: boolean; sensitive?: boolean }>>([]);
const sessionId = ref('');
const userId = ref('');
/** 提交中：防双击导致重复签发 code */
const submitting = ref(false);

/** OAuth 标准参数是否齐全（缺 client_id / redirect_uri 无法开展授权） */
const hasOAuthParams = () =>
  typeof route.query.client_id === 'string' && !!route.query.client_id;

/**
 * 后端授权校验结果
 *
 * ⚠️ 内层 `data` 必须与顶层**同构**：下面用 `res?.data || res` 兼容"拦截器解包层级不一"的两种情况，
 * 若把内层写成缩水的窄类型，TS 会把 `data` 推断成联合类型，于是只在某一支上存在的字段
 * （`scopeDetails` / `sessionId` / `user_id`）一律被判为"属性不存在"——运行时代码没错，类型却在报警。
 */
interface AuthorizeCheckResult {
  action?: 'login' | 'consent' | string;
  client_name?: string;
  scope?: string;
  /**
   * 后端 `resolveScopeDetails()` 的返回：`id` 用于列表 key，`fields` 是签发 token 时裁剪用户字段的依据。
   * ⚠️ 别照抄成 `{ name, desc, required }` —— 漏掉 `id` 会让赋值给 `scopes` 时整片报错。
   */
  scopeDetails?: Array<{
    id: string;
    name: string;
    desc: string;
    fields?: string[];
    required: boolean;
    sensitive?: boolean;
  }>;
  /** 授权会话标识：后端 consent 分支才返回（`action === 'login'` 时已提前 return），提交 consent 时原样带回 */
  sessionId?: string;
  user_id?: string;
  data?: AuthorizeCheckResult;
}

// 确认授权：调后端 /oauth2.1/authorize/consent，后端签发 code 并 302 到 redirect_uri
const handleApprove = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    // request.ts 拦截器已解包 AxiosResponse.data，交给 pickRedirectUrl 取 redirect_url
    const res: unknown = await authorizeApi.authorizeConsent({
      sessionId: sessionId.value,
      user_id: userId.value,
      action: 'approve'
    });
    const redirectUrl = sanitizeExternalRedirect(pickRedirectUrl(res));
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      errorMsg.value = t('auth.redirect_missing');
      showError(t('auth.redirect_missing'));
    }
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : t('auth.approve_failed');
  } finally {
    submitting.value = false;
  }
};

// 拒绝授权：调后端记录拒绝，跳回 redirect_uri 带 error=access_denied
const handleDeny = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    // 从服务端响应取校验过的 redirect_url（不直接用 route.query.redirect_uri，防开放重定向）
    const res = (await authorizeApi.authorizeConsent({
      sessionId: sessionId.value,
      user_id: userId.value,
      action: 'deny'
    })) as unknown as { redirect_url?: string; data?: { redirect_url?: string } };
    const redirectUrl = sanitizeExternalRedirect(pickRedirectUrl(res));
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      router.back();
    }
  } catch {
    router.back();
  } finally {
    submitting.value = false;
  }
};

/** 未登录 → 去登录页，带回参。按设备选移动端全屏页或桌面标准页 */
function goLogin() {
  const query = new URLSearchParams(
    Object.entries(route.query).map(([k, v]) => [k, String(v ?? '')])
  );
  query.set('from', 'authorize');
  // 登录后回跳目标：当前授权页完整地址（登录页读 ?redirect= 完成回跳）
  const current = route.fullPath;
  query.set('redirect', current);
  const loginPath = isMobileDevice.value ? '/m/login' : '/login';
  router.replace(`${loginPath}?${query.toString()}`);
}

onMounted(async () => {
  // 全屏直接访问但没带 OAuth 参数：给友好引导而不是把后端 raw error 抛给用户
  if (!hasOAuthParams()) {
    paramsMissing.value = true;
    loading.value = false;
    return;
  }

  try {
    // request.ts 拦截器已解包 AxiosResponse.data，类型断言拿后端字段
    const res = (await authorizeApi.checkAuthorize({
      client_id: route.query.client_id,
      redirect_uri: route.query.redirect_uri,
      response_type: route.query.response_type || 'code',
      scope: route.query.scope,
      state: route.query.state,
      code_challenge: route.query.code_challenge,
      code_challenge_method: route.query.code_challenge_method,
      nonce: route.query.nonce
    })) as unknown as AuthorizeCheckResult;

    const data = res?.data || res;
    if (data.action === 'login') {
      goLogin();
      return;
    }

    appInfo.value.name = data.client_name || t('login.third_party');
    appInfo.value.description = t('auth.app_desc', { app: appInfo.value.name });
    // 优先用后端返回的 scopeDetails（带人话描述）；无则空数组
    scopes.value = Array.isArray(data.scopeDetails) ? data.scopeDetails : [];
    // 归一化成空串：`ref('')` 的既有语义就是"空串 = 无"，而这两个字段后端只有 consent 分支返回
    // （走到这里时通常是 consent，但 action 可能是别的值）—— 不归一化会把 undefined 写进 ref、
    // 与初始值语义不一致，也会把 undefined 传给 consent 提交接口
    sessionId.value = data.sessionId ?? '';
    userId.value = data.user_id ?? '';
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : t('auth.load_failed');
  } finally {
    loading.value = false;
  }
});

/* ============================================================================
   版式（UI）加载 + 契约组装
   ========================================================================== */

const translate: AuthTranslate = makeTranslate(t);

/**
 * 设备身份：授权页是路由直挂，没有「文件位置即身份」这条线索，按视口算。
 * 只产出 `standard` / `mobile` 两个值 —— 主题包里也只建这两个（+ 两个转发目录），
 * 产出第三个值就是白屏。
 */
const device = computed(() => (isMobileDevice.value ? 'mobile' : 'standard'));

const ctx = assertContract<AuthorizeViewContext>(
  reactive({
    t: translate,

    loading,
    paramsMissing,
    errorMessage: computed(() => errorMsg.value),

    appName: computed(() => appInfo.value.name),
    appDescription: computed(() => appInfo.value.description),
    scopes,
    submitting,
    isDark: computed(() => themeStore.isDark),

    actions: {
      approve: handleApprove,
      deny: handleDeny
    }
  })
);
</script>

<template>
  <!-- 业务容器只做一件事：把 ctx 交给当前版式（加载与回退由 <ThemeView> 负责） -->
  <ThemeView page="authorize" :device="device" :ctx="ctx" />

  <!-- 全局 Toast：版式只管长什么样，弹窗这类宿主级设施留在容器 -->
  <MessageToast />
</template>
