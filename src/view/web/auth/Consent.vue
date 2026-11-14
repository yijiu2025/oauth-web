<script setup lang="ts">
/**
 * 独立授权确认页（全屏可直达：/consent?...）—— **业务容器**
 *
 * 覆盖两种授权来源：
 *  1. authorize 流：守卫/api 授权时带 session_id + user_id
 *     → POST /oauth2.1/authorize/consent（同 Authorize.vue），后端返回校验过的 redirect_url
 *  2. login 流：登录响应 action=consent 时带 consent_key
 *     → POST /oauth2.1/login/consent/confirm，成功后按登录成功处理（父窗口 or 回跳）
 *
 * iframe 内不自行跳转（交给父窗口），全屏直连时按 ?redirect= 原路返回。
 *
 * === 分层 ===
 * 本文件只负责「授权确认这件事」：凭据解析、提交、iframe 通知、回跳。
 * **页面长什么样不在这里**：
 *
 *    本容器 ──传 ctx──▶ theme/themes/<包>/<设备>/consent/index.vue
 *                 ▲
 *                 └── 契约定在 theme/views/consent.ts（版式只读它）
 *
 * 版式只做外壳（头部 + 完成/缺参两态），权限清单与批准/拒绝按钮来自
 * `components/auth/ConsentPanel.vue` —— 与登录页内嵌面板共用同一份。
 *
 * @author yijiu2025
 * @since 2026-09-20 重写：修重复声明 / 只读 computed 赋值 / 未定义 startCountdown，并支持移动端
 * @since 2026-11-15 版式下沉主题包（本文件退化为薄容器）
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ThemeView } from 'skinsuite/vue';
import { authorizeApi, loginApi } from '@/api';
import { postToParent } from '@/utils/parent';
import { sanitizeLocalRedirect, sanitizeExternalRedirect } from '@/utils/redirect';
import { useDeviceDetect } from '@/device';
import { useMessage } from '@/composables/useMessage';
import { pickRedirectUrl } from '@/types/external';
import MessageToast from '@/components/common/MessageToast.vue';
import { useThemeStore } from '@/stores/theme';
import { makeTranslate, assertContract } from '@/utils/contract-utils';
import type { ConsentViewContext, ConsentTranslate } from '@/theme/views/consent';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { error: showError } = useMessage();
const themeStore = useThemeStore();
const { isMobileDevice } = useDeviceDetect();

const submitting = ref(false);
const done = ref(false);
const errorMsg = ref('');

/** iframe 嵌入检测：嵌入时由父窗口接管跳转与通知 */
const inIframe = computed(() => !!window.parent && window.parent !== window);
const notLoadSsoView = computed(() => route.query.notLoadSsoView === 'true');
const shouldSendSSOMessage = computed(() => !notLoadSsoView.value && inIframe.value);

// 应用展示名
const clientName = computed(
  () =>
    (route.query.client_name as string) ||
    (route.query.appName as string) ||
    (route.query.client_id as string) ||
    t('login.third_party')
);

// 两种授权来源的凭据
const consentKey = computed(() => (route.query.consent_key as string) || (route.query.consentKey as string) || '');
const sessionId = computed(() => (route.query.session_id as string) || (route.query.sessionId as string) || '');
const userId = computed(() => (route.query.user_id as string) || '');
/** authorize 流优先：带 session_id 才算授权流 */
const isAuthorizeFlow = computed(() => !!sessionId.value);
/** 凭据是否齐全（全屏直接打开 /consent 而不带凭据时给出友好提示） */
const paramsMissing = computed(() => !isAuthorizeFlow.value && !consentKey.value);

/**
 * 权限明细：优先取 query 里父应用透传的 scope_details(JSON)，
 * 否则退化为按 scope 字符串（空格/逗号分隔）只显示权限名，不编造描述。
 */
const scopeDetails = computed<Array<{ id: string; name: string; desc: string; required?: boolean }>>(() => {
  const raw = route.query.scope_details;
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((s: Record<string, unknown>, i: number) => ({
          id: String(s?.id ?? s?.name ?? i),
          name: String(s?.name ?? s?.id ?? ''),
          desc: String(s?.desc ?? ''),
          required: !!s?.required
        }));
      }
    } catch {
      // 解析失败按无描述处理，不阻塞授权
    }
  }
  const scopeStr = (route.query.scope as string) || '';
  return scopeStr
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(name => ({ id: name, name, desc: '' }));
});

const consentState = computed(() => ({
  consentKey: consentKey.value,
  client_name: clientName.value,
  scopeDetails: scopeDetails.value
}));

/** 登录流授权成功后收尾：iframe 通知父窗口；全屏按 ?redirect= 回跳或返回 */
function finishLoginConsent(res: unknown) {
  if (inIframe.value) {
    postToParent({ type: 'LOGIN_SUCCESS', data: res });
    return;
  }
  const target = sanitizeLocalRedirect(route.query.redirect);
  if (target) {
    // 站内路径白名单校验后的回跳。用 vue-router 的内部导航（router.replace）而非
    // window.location.replace：语义等价（替换当前历史记录、返回键不退回登录页），
    // 且 vue-router 对字符串路径只做站内解析，不给 CodeQL「客户端 URL 重定向」告警留口子。
    router.replace(target);
  } else {
    done.value = true;
  }
}

/** 同意授权 */
const approve = async () => {
  if (submitting.value || paramsMissing.value) return;
  submitting.value = true;
  try {
    if (isAuthorizeFlow.value) {
      const res: unknown = await authorizeApi.authorizeConsent({
        sessionId: sessionId.value,
        user_id: userId.value,
        action: 'approve'
      });
      const redirectUrl = sanitizeExternalRedirect(pickRedirectUrl(res));
      if (redirectUrl) window.location.href = redirectUrl;
      else showError(t('auth.redirect_missing'));
    } else {
      const res = await loginApi.confirmConsent(consentKey.value);
      finishLoginConsent(res);
    }
  } catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : t('login.consent_failed');
    showError(errorMsg.value);
  } finally {
    submitting.value = false;
  }
};

/** 拒绝授权 */
const deny = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    if (isAuthorizeFlow.value) {
      const res: unknown = await authorizeApi.authorizeConsent({
        sessionId: sessionId.value,
        user_id: userId.value,
        action: 'deny'
      });
      const redirectUrl = sanitizeExternalRedirect(pickRedirectUrl(res));
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
    }
    // 登录流 / 拿不到跳转地址：iframe 通知父窗口拒绝，全屏退回上一页
    if (shouldSendSSOMessage.value) {
      postToParent({ type: 'SSO_DENIED', error: 'user_denied', description: t('login.consent_denied') });
    }
    if (window.history.length > 1) router.back();
    else router.replace('/login');
  } catch (err: unknown) {
    showError(err instanceof Error ? err.message : t('login.consent_failed'));
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  // 语言跟随父应用透传。明暗入口 `?theme=dark|light` 已废弃失效（2026-10-20，
  // 见 skinsuite 文档站「明暗与色系」）：明暗归主题状态机，URL 不再覆写。
  const lang = route.query.lang as string;
  if (lang) locale.value = lang;
  if (shouldSendSSOMessage.value) {
    postToParent({ type: 'SSO_READY' });
  }
});

/* ============================================================================
   版式（UI）加载 + 契约组装
   ========================================================================== */

const translate: ConsentTranslate = makeTranslate(t);

/** 设备身份：路由直挂，按视口算（只产出 standard / mobile，主题包也只建这两个 + 转发目录） */
const device = computed(() => (isMobileDevice.value ? 'mobile' : 'standard'));

const ctx = assertContract<ConsentViewContext>(
  reactive({
    t: translate,

    done,
    paramsMissing,
    submitting,

    clientName: computed(() => clientName.value),
    consentState: computed(() => consentState.value),
    isDark: computed(() => themeStore.isDark),

    actions: {
      approve,
      deny
    }
  })
);
</script>

<template>
  <!-- 业务容器只做一件事：把 ctx 交给当前版式（加载与回退由 <ThemeView> 负责） -->
  <ThemeView page="consent" :device="device" :ctx="ctx" scope="inherit" />

  <!-- 全局 Toast：宿主级设施，留在容器 -->
  <MessageToast />
</template>
