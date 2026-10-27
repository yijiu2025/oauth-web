<script setup lang="ts">
/**
 * 桌面端标准注册 —— **业务容器**
 *
 * === 分层（2026-09-25 起，与移动端 `app/register/index.vue` 对齐）===
 * 本文件只负责「注册这件事」：状态、表单校验、接口调用、验证码流程、倒计时、路由跳转。
 * **页面长什么样不在这里**，而在**当前主题包**里的版式组件里：
 *
 *    本容器 ──传 ctx──▶ theme/themes/<包>/standard/register/index.vue
 *                 ▲
 *                 └── 契约定在 theme/views/register.ts（各包共用这一份，版式只读它）
 *
 * 于是「换一套 UI」= 在包里加一个版式目录，本文件零改动。
 * **内置包**（`default`）的 base 由本文件**静态引入**：正常访问不产生额外请求，首帧即正确；
 * 其它包 / 其它版式都是惰性 chunk，由路由守卫提前预热。
 *
 * 与 MiniRegister（紧凑版）的区别：两者是 dispatcher 的**两种设备形态分支**，
 * 业务逻辑 95% 相同，但 UI 差异大（标准版是左右双栏卡片，紧凑版是单栏卡片）。
 * 二者各自成为独立容器，各自加载自己的版式。
 *
 * === 分步 ===
 * web 端注册是**两步**（1 用户名+邮箱+验证码 → 2 密码+协议），与移动端三步不同。
 * 契约里的 `nextStep(2)` 即「进到第 2 步提交」，`totalSteps = 2` 由本容器自定。
 *
 * @author yijiu2025
 */
import { authApi } from '@/api/auth';
import { useForm } from 'vee-validate';
import { z } from 'zod';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { computed, inject, onMounted, onUnmounted, reactive, ref } from 'vue';
import GraphicCaptcha from '@/components/common/GraphicCaptcha.vue';
import AgreementModals from '@/components/common/AgreementModals.vue';
import MessageToast from '@/components/common/MessageToast.vue';
import { useMessage } from '@/composables/useMessage';
import { useCountdown } from '@/composables/useCountdown';
import { useCaptchaFlow } from '@/composables/useCaptchaFlow';
import { useButtonLock } from '@/composables/useButtonLock';
import { useCaptcha } from '@/composables/useCaptcha';
import { useAgreementVersion, captureAgreementVersion } from '@/composables/useAgreementVersion';
import { rsaEncrypt, getCachedKid } from '@/utils/crypto';
import { withTimeout } from '@/utils/with-timeout';
import { sanitizeLocalRedirect } from '@/utils/redirect';
import { ThemeView } from 'skinsuite/vue';
import type { RegisterDirection, RegisterTranslate, RegisterViewContext } from '@/theme/views/register';
import { bindField, makeTranslate, assertContract, type FieldSource } from '@/utils/contract-utils';

/** 步骤总数：web 端两步（账号+验证码 → 密码+协议） */
const TOTAL_STEPS = 2;

// ================================
// 常量定义
// ================================
const COUNTDOWN_SECONDS = 60; // 验证码倒计时秒数
const RECAPTCHA_TIMEOUT = 30_000; // 获取验证码超时时间（毫秒）
const RSA_ENCRYPT_TIMEOUT = 30_000; // RSA 加密超时时间（毫秒）

// ================================
// 路由和上下文
// ================================
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

// 父组件透传的注册上下文（dispatcher provide）
interface RegisterContext {
  appName: string;
  clientId: string;
  redirectUri: string;
  redirect: string;
  scope: string;
  state: string;
  invite: string;
  lang: string;
}

const registerContext = inject<RegisterContext>('registerContext', {
  appName: 'Enterprise SSO',
  clientId: '',
  redirectUri: '',
  redirect: '',
  scope: '',
  state: '',
  invite: '',
  lang: 'zh_cn'
});

// 跟随父组件透传的 lang 切换 locale
if (registerContext.lang) locale.value = registerContext.lang;

// ================================
// 分步状态管理
// ================================
const step = ref<1 | 2>(1);
const direction = ref<RegisterDirection>('next');

// 分步副标题（显式映射，避免动态拼 key 漏键时把 key 名显示给用户）
const stepSub = computed(() => {
  if (step.value === 1) return t('register.sub_step1');
  return t('register.sub_step2');
});

// ================================
// 表单验证
// ================================
const registerSchema = z
  .object({
    username: z
      .string({ required_error: t('register.username_min') })
      .min(5, t('register.username_min'))
      .regex(/^[A-Za-z0-9_]+$/, t('register.username_pattern')),
    email: z.string({ required_error: t('register.email') }).email(t('register.email_invalid')),
    code: z
      .string({ required_error: t('register.code') })
      .regex(/^\d{6}$/, t('register.code_min')),
    password: z
      .string({ required_error: t('register.password_min') })
      .min(8, t('register.password_min'))
      .max(128, t('register.password_max'))
      .regex(/^(?=.*[a-z])/, t('register.password_lowercase'))
      .regex(/^(?=.*[A-Z])/, t('register.password_uppercase'))
      .regex(/^(?=.*\d)/, t('register.password_digit')),
    confirmPassword: z.string({ required_error: t('register.confirm_required') }).min(1, t('register.confirm_required'))
  })
  .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
    message: t('register.password_mismatch'),
    path: ['confirmPassword']
  });

const { values, errors, defineField, handleSubmit, validateField } = useForm({
  validationSchema: toTypedSchema(registerSchema)
});

const [username, usernameProps] = defineField('username');
const [email, emailProps] = defineField('email');
const [code, codeProps] = defineField('code');
const [password, passwordProps] = defineField('password');
const [confirmPassword, confirmPasswordProps] = defineField('confirmPassword');

// ================================
// 验证码和状态管理
// ================================
const agreed = ref(false);
const isEmailDuplicate = ref(false);
const isEmailChecking = ref(false); // 邮箱去重检查中：防 blur 后未返回就点下一步的竞态
const codeSent = ref(false); // 验证码是否已成功发送（前端拦截：未发码前 input 和下一步按钮都禁用）
const docType = ref<'service' | 'privacy' | null>(null);

const { active: isCountingDown, remaining: countdown, start: startCountdown } = useCountdown(COUNTDOWN_SECONDS);
const submitLock = useButtonLock();
const agreementVersion = useAgreementVersion();
const submitting = computed(() => submitLock.locked.value);

// 人机验证（reCAPTCHA）
const { isEnabled: recaptchaEnabled, load: loadCaptcha, getToken: getCaptchaToken, dispose } = useCaptcha('register');
const { error: showError, success: showSuccess } = useMessage();

// 图形验证码流程：弹窗 → 通过 → 拿 captchaKey + 标记已发码 + 启动倒计时
const { captchaKey, showCaptcha, openCaptcha: openRegCaptcha, onCaptchaSuccess } = useCaptchaFlow<'register'>(() => {
  codeSent.value = true;
  startCountdown(COUNTDOWN_SECONDS);
});

// ================================
// 工具函数
// ================================
/**
 * 注册后回跳（OAuth 同源白名单，防开放重定向）
 * 复用 utils/redirect.ts 的 sanitizeLocalRedirect（此前这里内联抄了一份，
 * 且漏了 `/\evil.com` 归一化分支 —— 白名单只该有一份实现）。
 */
function safeRedirect(): string {
  return sanitizeLocalRedirect(registerContext.redirectUri || registerContext.redirect) || '/login';
}

// ================================
// 业务逻辑函数
// ================================

/**
 * 检查邮箱是否已被注册
 */
const checkEmail = async () => {
  if (!values.email || errors.value.email) {
    isEmailDuplicate.value = false;
    return;
  }
  // 请求前快照：响应回来时若邮箱已被改，丢弃旧响应，避免竞态污染新邮箱的重复标记
  const queriedEmail = values.email;
  isEmailChecking.value = true;
  try {
    const res = (await authApi.checkEmail(queriedEmail)) as unknown as { isDuplicate?: boolean };
    if (values.email !== queriedEmail) return; // 邮箱已变，本次结果作废
    isEmailDuplicate.value = !!res?.isDuplicate;
  } catch (err) {
    console.warn('[StandardRegister] checkEmail failed', err);
    isEmailDuplicate.value = false;
  } finally {
    isEmailChecking.value = false;
  }
};

/**
 * 发送验证码：先查重（已注册拦截），再走图形验证码弹窗
 */
const sendCode = async () => {
  if (!values.email || errors.value.email) return;
  await checkEmail();
  if (isEmailDuplicate.value) {
    showError(t('register.email_duplicate'));
    return;
  }
  openRegCaptcha('register');
};

/**
 * 前进到第 2 步（先校验第 1 步字段，不通过就停在原地）
 */
const handleNextStep = async (target: 2) => {
  if (isEmailChecking.value) return; // 查重未返回，先不放行
  const r1 = await validateField('username');
  const r2 = await validateField('email');
  const r3 = await validateField('code');
  const ok = r1.valid && r2.valid && r3.valid && !isEmailDuplicate.value;
  if (ok) {
    direction.value = 'next';
    step.value = target;
  }
};

/**
 * 后退到第 1 步
 */
const handleBack = () => {
  direction.value = 'prev';
  step.value = 1;
};

/**
 * 去登录页（透传 OAuth 上下文）
 */
const goLogin = () => {
  const query: Record<string, string> = {};
  for (const key of ['appName', 'client_id', 'scope', 'state', 'redirect_uri', 'lang', 'redirect']) {
    const v = route.query[key];
    if (typeof v === 'string') query[key] = v;
  }
  void import('@/view/web/login/index.vue').catch(() => {});
  router.push({ path: '/login', query });
};

/**
 * 处理注册表单提交
 */
// 用 handleSubmit 的回调参数 data 而非外部 values：data 是 vee-validate 校验后的
// 精确类型（字段非 undefined），外部 values 是宽松的 string | undefined —— 后者
// 展开进 RegisterPayload 会因「必填字段可空」而类型报错。
const handleRegister = handleSubmit(async data => {
  if (!agreed.value || isEmailDuplicate.value) return;
  if (submitLock.locked.value) return;
  submitLock.lock();

  // 解构排除 confirmPassword（`_` 前缀 = 有意不使用）：它只用于本地一致性校验，不发往后端
  const { confirmPassword: _confirmPassword, ...submitData } = data;

  try {
    const encryptedPassword = await withTimeout(rsaEncrypt(submitData.password!), RSA_ENCRYPT_TIMEOUT, 'rsaEncrypt');
    const recaptchaToken = recaptchaEnabled
      ? await withTimeout(getCaptchaToken(), RECAPTCHA_TIMEOUT, 'getCaptchaToken')
      : null;

    await authApi.register({
      ...submitData,
      password: encryptedPassword,
      kid: getCachedKid(),
      captchaKey: captchaKey.value,
      agreementVersion: captureAgreementVersion(agreementVersion),
      invite: registerContext.invite || undefined,
      appName: registerContext.appName,
      ...(recaptchaToken ? { recaptchaToken } : {})
    });

    showSuccess(t('register.success'));
    router.push(safeRedirect());
  } catch (err: unknown) {
    showError(err instanceof Error ? err.message : t('register.register_failed'));
  } finally {
    submitLock.unlock();
  }
});

// ================================
// 生命周期钩子
// ================================
onMounted(() => {
  if (recaptchaEnabled) loadCaptcha();
});

onUnmounted(() => dispose());

/* ============================================================================
   契约组装（版式渲染已收进 <ThemeView>，本容器只组装 ctx）
   ========================================================================== */

/**
 * 本容器的**设备身份**：默认 standard（文件位置即身份，`view/web/` 下都是电脑端）。
 * 其它设备（如 tablet）复用本容器的业务时通过 `device` prop 覆盖 —— 避免复制业务。
 */
const props = withDefaults(defineProps<{ device?: string }>(), { device: 'standard' });

// 契约组装样板（FieldSource/bindField/translate/assertContract）收口在
// src/utils/contract-utils.ts，各容器共用，不再逐文件复制。
const translate: RegisterTranslate = makeTranslate(t);

const ctx = assertContract<RegisterViewContext>(
  reactive({
    t: translate,
    appName: computed(() => registerContext.appName),

    step: computed(() => step.value),
    totalSteps: TOTAL_STEPS,
    direction: computed(() => direction.value),
    subtitle: computed(() => stepSub.value),
    progress: computed(() => (step.value / TOTAL_STEPS) * 100),

    fields: {
      username: bindField(
        username,
        usernameProps,
        computed(() => !!errors.value.username),
        computed(() => errors.value.username)
      ),
      email: bindField(
        email,
        emailProps,
        computed(() => !!errors.value.email || isEmailDuplicate.value),
        computed(() => (isEmailDuplicate.value ? t('register.email_duplicate') : errors.value.email))
      ),
      code: bindField(code, codeProps, computed(() => !!errors.value.code), computed(() => errors.value.code)),
      password: bindField(
        password,
        passwordProps,
        computed(() => !!errors.value.password),
        computed(() => errors.value.password)
      ),
      confirmPassword: bindField(
        confirmPassword,
        confirmPasswordProps,
        computed(() => !!errors.value.confirmPassword),
        computed(() => errors.value.confirmPassword)
      )
    } satisfies Record<string, FieldSource>,

    agreed,
    emailDuplicate: computed(() => isEmailDuplicate.value),
    codeSent: computed(() => codeSent.value),
    countingDown: computed(() => isCountingDown.value),
    countdown: computed(() => countdown.value),
    submitting: computed(() => submitting.value),
    canSubmit: computed(() => agreed.value && !submitting.value),

    actions: {
      nextStep: handleNextStep,
      back: handleBack,
      goLogin,
      sendCode,
      checkEmail,
      submit: handleRegister,
      openAgreement: (doc: 'service' | 'privacy') => {
        docType.value = doc;
      }
    }
  })
);
</script>

<template>
  <ThemeView page="register" :device="props.device" :ctx="ctx" />

  <!-- 图形验证码弹窗（注册 = 校验图形码 + 发邮箱码，必须带 send-email） -->
  <GraphicCaptcha :is-open="showCaptcha" :email="values.email" :send-email="true" type="register" @close="showCaptcha = false" @success="onCaptchaSuccess" />

  <!-- 服务协议 / 隐私政策 弹窗 -->
  <AgreementModals v-model:type="docType" />

  <!-- 错误/成功提示 toast -->
  <MessageToast />
</template>
