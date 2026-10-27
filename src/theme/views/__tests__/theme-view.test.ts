/**
 * `<ThemeView>` 行为守卫（2026-10-21 新增）
 *
 * === 这个文件补的是什么空 ===
 * ThemeView 的两条核心行为此前**只有源码文本断言**（verify-theme-dirs 的 F 段）与
 * **端到端 e2e**（浏览器组）覆盖，缺行为级保护：
 *   A. 版式 `pick` 四档优先级 —— 文本断言只能证「源码里出现了这些词」，证不了
 *      「URL 非法值时落包名而不是降档」这类口径；改一个字符文本断言可能照样绿；
 *   B. `device` prop → `setActiveDevice` 告知链 —— 这是 0.5.0 架构的承重墙
 *      （分发器不碰主题，设备身份全靠这一根 watch 带进 store），坏一个 prop 要等
 *      浏览器组才知道，而它的正确性值得最快的反馈。
 *
 * === 为什么不 mock ===
 * 真实加载 `@/stores/theme`（真实 pinia + 真实 createThemeState）+ 真实注册表
 * （virtual:theme 由 vitest 的 themeAssets 插件同源产出）—— mock 掉等于测试手写的
 * 常量，不是被测代码。模块隔离用 `vi.resetModules()`（store 创建即快照 URL /
 * localStorage，与 theme.test.ts 同口径）。
 *
 * === 版式 pick 的真实语义（读 createViewPicker 得出，与旧文档「四档」表述有出入）===
 *   第 1 档 URL `?th[_<设备缩写>]`：命中已登记 id 用它；**非法 / 未登记值落当前包名，
 *     不回退第 2 档**（view-registry.ts 文件头原话：「第 1 档命中后不再回退」）；
 *   第 2 档 主题包/配色声明 `views.<page>`（store.viewFor）；
 *   第 3 档 当前包名（版式 id ≡ 包名）；
 *   builtin(device) 不是 pick 的一档，是 ThemeView 的首帧初始值（渲染层）。
 *
 * === 为什么 pick 用例用 register 页而不是 login ===
 * 主题包实际布局（2026-10-21 实测）：`default` 有四设备 × 四页面共 16 套版式；
 * `compact` **只有 mobile/register 一套**。login 页在 compact 里没有版式，
 * 「URL 命中」与「落包名」两条路径会塌缩成同一结果，用例失去区分度。
 * register 页两边都有 mobile 端版式，四档路径才两两可辨。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, reactive, ref } from 'vue';
import type { App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import i18n from '@/i18n';
import type { LoginViewContext } from '@/theme/views/login';

/** 与 skinsuite constants 同口径：内置包名 + 四设备 */
const DEFAULT_PKG = 'default';
const MINI = 'mini';
const MOBILE = 'mobile';
const STANDARD = 'standard';
const TABLET = 'tablet';

/**
 * 装一个**假 router** 再建 store，并拿回同一批 fresh 模块
 *
 * 🔴 顺序（与 theme.test.ts 同）：`vi.resetModules()` → import store 定义（触发
 *    `import 'virtual:theme'` 副作用装配：版式表 + 注册表 + views/*.ts 声明）→
 *    `installThemeDomain` → `useThemeStore()`。装早了作用在旧实例上，store 创建时
 *    `currentQuery()` 仍返回 `{}`。
 * 🔴 `query` 是 reactive 的：用例通过改它模拟「跨页带不同 th」。
 */
async function freshThemeWorld(query: Record<string, string> = {}) {
  vi.resetModules();
  window.history.replaceState({}, '', '/login');
  const { useThemeStore } = await import('@/stores/theme');
  const skinsuite = await import('skinsuite/vue');
  const route = reactive({ query: { ...query }, path: '/login', fullPath: '/login' });
  skinsuite.installThemeDomain({
    router: { currentRoute: reactive({ value: route }) } as never
  });
  return { store: useThemeStore(), skinsuite };
}

/** 让 store / 组件内的 watch 冲刷一轮（Vue 的 watch 默认异步批处理） */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** 版式渲染所需的最小 ctx（LoginViewContext 全量；actions 全是 no-op 探针） */
function stubCtx(): LoginViewContext {
  const field = { value: '', attrs: {}, invalid: false, error: undefined };
  return {
    t: key => key,
    appName: 'test-app',
    hasAppName: true,
    panel: 'form',
    title: 'title',
    subtitle: 'subtitle',
    mode: 'pwd',
    direction: 'next',
    fields: { email: { ...field }, code: { ...field }, username: { ...field }, password: { ...field } },
    keepLogin: false,
    agreed: false,
    countingDown: false,
    countdown: 0,
    submitting: false,
    socialProviders: [],
    socialLastProvider: null,
    consentState: null,
    consentSubmitting: false,
    emailVerifyState: null,
    emailVerifyCode: '',
    emailVerifyCountingDown: false,
    emailVerifyCountdown: 0,
    qrDataUrl: '',
    qrStatus: 'pending',
    showQr: false,
    isEmbedded: false,
    isDark: false,
    actions: {
      switchMode: () => {},
      submit: () => {},
      sendCode: () => {},
      goRegister: () => {},
      goForgot: () => {},
      back: () => {},
      openAgreement: () => {},
      selectSocial: () => {},
      approveConsent: () => {},
      denyConsent: () => {},
      sendEmailVerifyCode: () => {},
      submitEmailVerify: () => {},
      generateQr: () => {},
      resetQr: () => {},
      toggleQr: () => {},
      toggleTheme: () => {}
    }
  };
}

describe('ThemeView 行为守卫', () => {
  let app: App | null = null;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    document.body.innerHTML = '';
  });

  /* -------------------------------------------------------------------------
   * A. 版式 pick 优先级（pageObj.pick —— ThemeView 内部调用的同一个纯函数 seam）
   * ---------------------------------------------------------------------- */
  describe('A. 版式 pick 四档优先级', () => {
    it('第 1 档 URL：命中已登记 id（含大小写归一；compact 只有 mobile 端）', async () => {
      const { skinsuite } = await freshThemeWorld();
      const register = skinsuite.pageOf('register');
      expect(register).toBeDefined();
      expect(register!.pick({ url: 'compact', pkg: DEFAULT_PKG, device: MOBILE })).toBe('compact');
      expect(register!.pick({ url: 'Compact', pkg: DEFAULT_PKG, device: MOBILE })).toBe('compact');
    });

    it('第 1 档 URL：非法值落当前包名，且不回退第 2 档', async () => {
      const { skinsuite } = await freshThemeWorld();
      const register = skinsuite.pageOf('register')!;
      // 未登记的 id：theme 档本可命中 compact（mobile 端存在），但 URL 档命中后不再降档
      expect(register.pick({ url: 'nope', theme: 'compact', pkg: DEFAULT_PKG, device: MOBILE })).toBe(
        DEFAULT_PKG
      );
      // 已登记但该设备没有（compact 无 register/standard 端）：同样落包名
      expect(
        register.pick({ url: 'compact', theme: 'compact', pkg: DEFAULT_PKG, device: STANDARD })
      ).toBe(DEFAULT_PKG);
    });

    it('第 1 档 URL：空串 = 未指定，不进档（落到第 2 档）', async () => {
      const { skinsuite } = await freshThemeWorld();
      const register = skinsuite.pageOf('register')!;
      expect(register.pick({ url: '', theme: 'compact', pkg: DEFAULT_PKG, device: MOBILE })).toBe(
        'compact'
      );
    });

    it('第 2 档 theme：命中 / 该设备没有 → 落包名', async () => {
      const { skinsuite } = await freshThemeWorld();
      const register = skinsuite.pageOf('register')!;
      expect(register.pick({ theme: 'compact', pkg: DEFAULT_PKG, device: MOBILE })).toBe('compact');
      expect(register.pick({ theme: 'compact', pkg: DEFAULT_PKG, device: STANDARD })).toBe(DEFAULT_PKG);
    });

    it('第 3 档 pkg：无 url / theme 时版式 id ≡ 包名（不校验该设备是否真有这个包）', async () => {
      const { skinsuite } = await freshThemeWorld();
      const register = skinsuite.pageOf('register')!;
      expect(register.pick({ pkg: 'compact', device: STANDARD })).toBe('compact');
      // pkg 缺省 → 内置包 default
      expect(register.pick({})).toBe(DEFAULT_PKG);
    });

    it('未知设备：设备域命中不了 → 版式 id 回落包名（compact 只在 mobile 有 ⇒ 对照可证）', async () => {
      const { skinsuite } = await freshThemeWorld();
      const register = skinsuite.pageOf('register')!;
      // 同一个 url:compact：mobile 上命中，未知设备走末条（standard）域 ⇒ 落 default
      expect(register.pick({ url: 'compact', pkg: DEFAULT_PKG, device: MOBILE })).toBe('compact');
      expect(register.pick({ url: 'compact', pkg: DEFAULT_PKG, device: 'watch' })).toBe(DEFAULT_PKG);
    });
  });

  /* -------------------------------------------------------------------------
   * B. device prop → setActiveDevice 告知链（真实挂载 ThemeView）
   * ---------------------------------------------------------------------- */
  describe('B. ThemeView device prop 告知 store', () => {
    it('挂载即告知（immediate），prop 变化 store 跟随', async () => {
      const { store, skinsuite } = await freshThemeWorld();
      const { ThemeRoot, ThemeView } = skinsuite;
      const device = ref(MINI);

      const Harness = {
        setup() {
          return () =>
            h(
              ThemeRoot,
              { themeStore: store as never },
              { default: () => h(ThemeView, { page: 'login', device: device.value, ctx: stubCtx() }) }
            );
        }
      };
      app = createApp(Harness);
      // 版式里的共享组件（AuthContainer 等）用 useI18n —— 与 bootstrap 同口径装
      app.use(i18n);
      const el = document.createElement('div');
      document.body.appendChild(el);
      app.mount(el);

      // immediate：watch 的 immediate 回调在 setup 内同步跑，未 flush 就应已告知
      expect(store.activeDevice).toBe(MINI);
      expect(store.activePage).toBe('login');
      await flush();

      // prop 变 → store 跟随（同容器复用切换设备的那条路径）
      device.value = TABLET;
      await flush();
      expect(store.activeDevice).toBe(TABLET);
    });
  });
});
