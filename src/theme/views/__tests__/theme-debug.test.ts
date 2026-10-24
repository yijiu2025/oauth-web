/**
 * 库侧主题调试句柄的行为守卫（2026-10-21 第二批 #5）
 *
 * === 这个文件测什么 ===
 * `skinsuite/vue` 的 `installThemeDebug`（由 `createThemeState` 自动接线）——
 * 判定逻辑本身在内核 `param-audit`（库 test/ 目录有 15 例覆盖），这里只测
 * **装配行为**（真实 store + 假 router 域，不 mock）：
 *   A. dev **无门控也警告**（静默失败不靠「记得开开关」防）—— 核心设计属性；
 *   B. `?debug=theme` 才挂 `window.__MAUTH_STORE__`：既有 11 键原样保留
 *      （e2e 三个关卡的依赖面）+ url / effectiveView / warnings 三个链路键；
 *   C. console 去重（同一问题只喊一次）；角标随警告计数红/绿。
 *
 * === 为什么不 mock ===
 * 与 theme-view.test.ts 同口径：真实加载 `@/stores/theme`（真实 pinia + 真实
 * createThemeState + virtual:theme 同源注册表）。mock 掉等于测试手写常量。
 *
 * @author yijiu2025
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

/**
 * 装一个**假 router 域**再建 store，并拿回同一批 fresh 模块 + route
 *
 * 顺序与 theme-view.test.ts 同：`vi.resetModules()` → import store 定义（触发
 * `import 'virtual:theme'` 副作用装配）→ `installThemeDomain` → `useThemeStore()`
 * —— 装早了作用在旧实例上，store 创建时 `currentQuery()` 仍返回 `{}`。
 */
async function freshWorld(query: Record<string, string> = {}, url = '/login') {
  vi.resetModules();
  window.history.replaceState({}, '', url);
  const { useThemeStore } = await import('@/stores/theme');
  const skinsuite = await import('skinsuite/vue');
  const route = reactive({ query: { ...query }, path: '/login', fullPath: url });
  skinsuite.installThemeDomain({
    router: { currentRoute: reactive({ value: route }) } as never
  });
  const store = useThemeStore();
  // 0.9.0 起页面上下文由 <ThemeView> 挂载告知（无页面时页面域为空、URL 审计的
  // pageRegistered=false）。装置模拟 ThemeView 挂载：告知页 + 冲刷一轮，让调试
  // 句柄的 store 六值 watch 跑一遍 refresh（探针挂载 / 警告判定都在那之后）。
  store.setActivePageView('login', 'default');
  await flush();
  return { store, route };
}

/** 让 store / 调试句柄里的 watch 冲刷一轮（Vue 的 watch 默认异步批处理） */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** 右下角角标（库侧挂的；宿主无同名元素） */
function badge(): HTMLElement | null {
  return document.querySelector('[data-theme-debug-badge]');
}

describe('库侧主题调试句柄（installThemeDebug，dev-only）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // 探针 / 角标挂在 window / body 上，跨用例会串味 —— 逐个拆
    delete (window as unknown as Record<string, unknown>).__MAUTH_STORE__;
    badge()?.remove();
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------
   * A. dev 无门控也警告（核心设计属性）
   * ---------------------------------------------------------------------- */
  it('A1. URL 非法版式值：dev 无 ?debug=theme 也喊 console，且**不挂**探针', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await freshWorld({ th: 'compat' }); // 拼错：少一个 p
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('[theme] URL 版式值「compat」');
    expect(String(warn.mock.calls[0][0])).toContain('可用版式'); // 机检要说缺什么
    expect((window as unknown as Record<string, unknown>).__MAUTH_STORE__).toBeUndefined();
  });

  it('A2. ?device= 未知 id：无门控也喊（分发器静默落兜底设备的那类）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await freshWorld({ device: 'phon' });
    expect(
      warn.mock.calls.some(c => String(c[0]).includes('「phon」不是已注册设备'))
    ).toBe(true);
  });

  /* -------------------------------------------------------------------------
   * B. ?debug=theme 门控下的探针（既有 11 键 + 3 个链路键）
   * ---------------------------------------------------------------------- */
  it('B1. 门控挂 __MAUTH_STORE__：既有 11 键原样 + url/effectiveView/warnings', async () => {
    await freshWorld({ th: 'default', debug: 'theme' }, '/login?debug=theme');
    const s = (window as unknown as Record<string, unknown>).__MAUTH_STORE__ as Record<
      string,
      unknown
    >;
    expect(s).toBeDefined();
    // 既有 11 键（e2e verify-panel-v3 / view-priority / first-paint 的依赖面）
    for (const key of [
      'themeId',
      'deviceTheme',
      'viewIntent',
      'deviceView',
      'mode',
      'packageId',
      'activeDevice',
      'activePage',
      'activeView',
      'activeThemeId',
      'activeTone'
    ]) {
      expect(s, `缺少既有键 ${key}`).toHaveProperty(key);
    }
    expect(s.activeDevice).toBe('standard'); // 兜底设备 = 清单末条
    expect(s.activePage).toBe('login');
    expect(s.packageId).toBe('default');
    // #5 新增：链路三键
    expect((s.url as Record<string, unknown>).th).toBe('default');
    expect(s.effectiveView).toEqual({ raw: 'default', legal: true });
    expect(s.warnings).toEqual([]);
  });

  it('B2. 非法值 + 门控：effectiveView.legal=false、warnings 非空、角标红字计数', async () => {
    await freshWorld({ th: 'compat', debug: 'theme' }, '/login?debug=theme');
    const s = (window as unknown as Record<string, unknown>).__MAUTH_STORE__ as Record<
      string,
      unknown
    >;
    expect(s.effectiveView).toEqual({ raw: 'compat', legal: false });
    expect((s.warnings as string[]).length).toBe(1);
    const el = badge();
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('⚠1');
    // jsdom 行内样式原样保留 hex（真实浏览器 getComputedStyle 才归一成 rgb(248,113,113)）
    expect(el!.style.color).toBe('#f87171');
  });

  it('B3. 全合法 + 门控：warnings 空、角标绿字无 ⚠', async () => {
    await freshWorld({ th: 'default', debug: 'theme' }, '/login?debug=theme');
    const s = (window as unknown as Record<string, unknown>).__MAUTH_STORE__ as Record<
      string,
      unknown
    >;
    expect(s.warnings).toEqual([]);
    const el = badge();
    expect(el!.textContent).not.toContain('⚠');
    expect(el!.style.color).toBe('#34d399'); // 绿（hex 口径同 B2 注释）
  });

  /* -------------------------------------------------------------------------
   * C. 去重（同一问题只喊一次 —— 刷新每轮都跑，不去重就是刷屏）
   * ---------------------------------------------------------------------- */
  it('C1. console 去重：同一问题只喊一次；换错值再喊；改回旧错值不重复', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { route } = await freshWorld({ th: 'compat' });
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);

    route.query.th = 'compat2'; // 新错值 → 新问题，喊
    await flush();
    expect(warn).toHaveBeenCalledTimes(2);

    route.query.th = 'compat'; // 旧错值回来 → 已喊过，不重复
    await flush();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
