/**
 * theme store 行为守卫（P1-1 拆分前的**安全网**）
 *
 * === 这个文件存在的理由 ===
 * `stores/theme.ts` 是「明暗 ≡ 配色系别」状态机的唯一实现，901 行、6 个 watch
 * 互相咬合。任何按"存储层 / 派生层 / 副作用层"的拆分都必须**证明行为不变** ——
 * 而在这之前，这个文件里除了注释没有任何可执行的契约。
 *
 * 因此本测试只锁**不变量**，不锁实现细节：
 *   • 不 assert "某函数被调用" —— 拆分会重命名/移动函数，那是允许的；
 *   • 只 assert 对外可观察的结果（`themeId` / `mode` / `activeTone` / `isDark`）。
 * 这样它是"重构的安全网"，而不是"重构的绊脚石"。
 *
 * === 为什么不 mock `@/theme` ===
 * 真实加载注册表才能验证"意图 → 可渲染配色"这条链本身（含跨设备回落、
 * 同系别回落）。mock 掉它 = 测试的是我手写的常量，不是被测代码。
 *
 * ⚠️ 每个用例都要**重置模块**：store 在 `defineStore(...)()` 当场读
 *    `window.location.search` 与 `localStorage`，是"创建即快照"的语义。
 *    复用 pinia 会让上个用例的 URL/落盘污染下个用例。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';

/** 默认包 / 设备 / 页面（与 skinsuite 的 constants 同口径） */
const DEFAULT_PKG = 'default';
const MOBILE = 'mobile';

/**
 * 在指定 URL 下新建一个 store
 *
 * `vi.resetModules()` 让每次 `import('@/stores/theme')` 都拿到一份新的 store 定义，
 * 从而重新执行"读 URL / 读 localStorage / 建 watch"的初始化。
 */
async function freshStore(search = '') {
  vi.resetModules();
  window.history.replaceState({}, '', search || '/');
  const { useThemeStore } = await import('@/stores/theme');
  const store = useThemeStore();
  // 0.9.0 起配色解析严格按「包 × 设备 × 页面」作用域：页面上下文由 <ThemeView>
  // 挂载告知，无页面时一切走空兜底（themeId 停在占位 'default'）。装置模拟
  // ThemeView 挂载后的状态，并冲刷一轮让 intent 的首屏对齐把占位 id 校正到位。
  store.setActivePageView('login', 'default');
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  return store;
}

/**
 * 装一个**假 router** 再建 store（版式意图 store 化后的读取入口是设备域
 * `currentQuery()`，不再是 `location.search`）
 *
 * 🔴 顺序：`vi.resetModules()` → import store 定义（拿到**新**的 skinsuite/vue
 *    模块实例）→ `installThemeDomain` → `useThemeStore()`。装早了作用在旧实例上，
 *    store 创建时 `currentQuery()` 仍返回 `{}`。
 * 🔴 `query` 是 reactive 的：用例通过 `lastFakeRoute.query = {...}` 改它来模拟
 *    "跨页带不同 th"（会触发编排层的 watch currentQuery）。
 */
let lastFakeRoute: { query: Record<string, string> } | null = null;

async function freshStoreWithRouter(
  search = '',
  query: Record<string, string> = {}
): Promise<Awaited<ReturnType<typeof freshStore>>> {
  vi.resetModules();
  window.history.replaceState({}, '', search || '/');
  const { useThemeStore } = await import('@/stores/theme');
  const { installThemeDomain } = await import('skinsuite/vue');
  const route = reactive({ query: { ...query }, path: '/login', fullPath: '/login' });
  lastFakeRoute = route;
  installThemeDomain({
    router: { currentRoute: reactive({ value: route }) } as never
  });
  const store = useThemeStore();
  // 同 freshStore：模拟 ThemeView 挂载告知页面 + 冲刷首屏对齐（0.9.0 作用域语义）
  store.setActivePageView('login', 'default');
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  return store;
}

/** 让 store 内的 watch 冲刷一轮（Vue 的 watch 默认异步批处理） */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('theme store 行为守卫', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset.mauthTheme;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    document.getElementById('mauth-theme-css')?.remove();
  });

  describe('初始状态', () => {
    it('无任何 URL / 落盘时，mode 为 system、配色为默认色 white', async () => {
      const store = await freshStore();
      expect(store.mode).toBe('system');
      expect(store.themeId).toBe('white');
    });

    it('落盘的配色能恢复（theme-id 键）', async () => {
      localStorage.setItem('theme-id', 'blue');
      const store = await freshStore();
      expect(store.themeId).toBe('blue');
    });

    it('落盘的非法配色被忽略，回落到默认色', async () => {
      localStorage.setItem('theme-id', 'not-a-real-color');
      const store = await freshStore();
      expect(store.themeId).toBe('white');
    });

    it('0.6.x 的 theme-skin 键不再迁移（迁移键只有 theme / theme-id），回落默认色', async () => {
      // 0.7.0 起迁移链只认裸键 theme / theme-id（LEGACY_STORAGE_KEYS）；
      // theme-skin 是更早时代的键，库不再读它 —— 落盘值被忽略，走占位 + 首屏对齐回落 white。
      localStorage.setItem('theme-skin', 'cyan');
      const store = await freshStore();
      expect(store.themeId).toBe('white');
      // 负向对照：真正的迁移键 theme-id 依然生效（见上一个用例）
      expect(localStorage.getItem('theme-id')).toBeNull();
    });
  });

  describe('明暗 ≡ 配色系别（核心不变量）', () => {
    it('点黑卡（black）→ mode 变成 dark、isDark 为 true', async () => {
      const store = await freshStore();
      expect(store.setTheme('black')).toBe(true);
      expect(store.mode).toBe('dark');
      expect(store.isDark).toBe(true);
      expect(store.activeTone).toBe('dark');
    });

    it('点白卡（white）→ mode 变成 light、isDark 为 false', async () => {
      const store = await freshStore();
      store.setTheme('black');
      expect(store.setTheme('white')).toBe(true);
      expect(store.mode).toBe('light');
      expect(store.isDark).toBe(false);
    });

    it('蓝是白系 → 点蓝 mode 为 light', async () => {
      const store = await freshStore();
      store.setTheme('blue');
      expect(store.mode).toBe('light');
      expect(store.isDark).toBe(false);
    });

    it('未登记的配色 setTheme 返回 false 且不改现状', async () => {
      const store = await freshStore();
      const before = store.themeId;
      expect(store.setTheme('nope-not-registered')).toBe(false);
      expect(store.themeId).toBe(before);
    });
  });

  describe('会话级记忆槽（切走前记一套，不持久化）', () => {
    it('黑（默认）点「明」→ 落到标配 white，而不是字母序第一的 blue', async () => {
      const store = await freshStore();
      store.setTheme('black');
      // 桌面/移动端的白系标配是 white；若退化成"字母序第一套"就会落到 blue
      store.setMode('light');
      await flush();
      expect(store.themeId).toBe('white');
    });

    it('用 blue 时切黑再切回明 → 恢复 blue（槽记住切走前那套）', async () => {
      const store = await freshStore();
      store.setActiveDevice(MOBILE); // blue 只在 mobile 登记（standard 端只有黑白）
      store.setTheme('blue');
      expect(store.themeId).toBe('blue');
      store.setMode('dark');
      await flush();
      expect(store.isDark).toBe(true);
      store.setMode('light');
      await flush();
      expect(store.themeId).toBe('blue');
    });

    it('点色卡会打断记忆链：白系下点黑卡后切明不再恢复历史色', async () => {
      const store = await freshStore();
      store.setTheme('blue'); // 白系 + 记住 blue 是"当前用的"
      store.setTheme('black'); // 显式点黑卡 → 清空对侧(白系)槽
      store.setMode('light'); // 切明：没有白系槽 → 落标配
      await flush();
      expect(store.themeId).toBe('white');
    });
  });

  describe('URL 意图（按设备锁定）', () => {
    it('?th_color=blue 通用键锁定所有设备（含兜底设备 standard）', async () => {
      const store = await freshStore('?th_color=blue');
      expect(store.themeId).toBe('blue');
    });

    it('?th_color_mobile=blue 锁定 mobile 那一条（按设备解析出该端配色）', async () => {
      const store = await freshStore('?th_color_mobile=blue');
      store.setActiveDevice(MOBILE);
      await flush();
      expect(store.themeRecordFor(undefined, MOBILE, 'login').meta.id).toBe('blue');
    });

    it('?skin 别名已删（不再作为 theme 的兼容别名）', async () => {
      const store = await freshStore('?skin.mobile=cyan');
      store.setActiveDevice(MOBILE);
      await flush();
      expect(store.themeRecordFor(undefined, MOBILE, 'login').meta.id).not.toBe('cyan');
    });

    it('空串 = 未指定：?th_color_mobile= 不吞掉通用键 ?th_color=blue', async () => {
      // 这是 2026-09-26 修过的真实缺陷：'' ?? anyScope 仍是 ''，会让通用键一起失效
      const store = await freshStore('?th_color_mobile=&th_color=blue');
      store.setActiveDevice(MOBILE);
      await flush();
      expect(store.themeRecordFor(undefined, MOBILE, 'login').meta.id).toBe('blue');
    });

    it('?mode=dark 已删（明暗不再从 URL 来）', async () => {
      const store = await freshStore('?mode=dark');
      expect(store.mode).toBe('system');
    });

    it('用户显式 setTheme 会清掉当前设备的 URL 覆盖（显式操作压过链接）', async () => {
      const store = await freshStore('?th_color_mobile=blue');
      store.setActiveDevice(MOBILE);
      await flush();
      expect(store.themeRecordFor(undefined, MOBILE, 'login').meta.id).toBe('blue');
      // 显式操作后 URL 覆盖被清 → 生效配色改为刚设的 cyan（cyan 在 mobile/login 有登记）
      store.setTheme('cyan');
      await flush();
      expect(store.themeRecordFor(undefined, MOBILE, 'login').meta.id).toBe('cyan');
    });
  });

  describe('切版式 → 重置配色到新包默认色', () => {
    it('从 default 包切到 compact 包，配色重置（视图换包）', async () => {
      const store = await freshStore();
      store.setActiveDevice(MOBILE);
      store.setActivePageView('register', DEFAULT_PKG);
      store.setTheme('cyan');
      expect(store.themeId).toBe('cyan');
      store.setActivePageView('register', 'compact');
      await flush();
      expect(store.themeId).toBe('white');
    });

    it('切版式重置**不落盘**（重置产物只进内存，落盘仍是用户上次自选色）', async () => {
      const store = await freshStore();
      store.setActiveDevice(MOBILE);
      store.setActivePageView('register', DEFAULT_PKG);
      store.setTheme('cyan');
      // 0.9.0 起写入只落新键 mauth:theme（旧键 theme-id 保留给迁移读，不再写）
      expect(localStorage.getItem('mauth:theme')).toBe('cyan');
      store.setActivePageView('register', 'compact');
      await flush();
      // 重置到 compact/mobile/register 的默认色（white）只改内存；落盘键保持用户自选
      expect(store.themeId).toBe('white');
      expect(localStorage.getItem('mauth:theme')).toBe('cyan');
    });
  });

  describe('外部覆写（后端下发 / 父应用）', () => {
    it('applyThemeConfig 能改配色但不写 localStorage', async () => {
      const store = await freshStore();
      localStorage.clear();
      store.applyThemeConfig({ theme: 'cyan' });
      expect(store.themeId).toBe('cyan');
      expect(localStorage.getItem('theme-id')).toBeNull();
    });

    it('URL 锁定配色时，后端下发不覆盖该设备', async () => {
      const store = await freshStore('?th_color_mobile=blue');
      store.setActiveDevice(MOBILE);
      store.applyThemeConfig({ theme: 'cyan' });
      // mobile 被 URL 锁 → 该端生效配色仍是 blue，不被后端下发的 cyan 覆盖
      expect(store.themeRecordFor(undefined, MOBILE, 'login').meta.id).toBe('blue');
    });

    it('外部 tokens 可撤销（传 null 回到主题包 tokens）', async () => {
      const store = await freshStore();
      store.applyThemeConfig({ tokens: { '--mauth-primary': '#123456' } });
      expect(store.externalTokens).toMatchObject({ '--mauth-primary': '#123456' });
      store.applyThemeConfig(null);
      expect(store.externalTokens).toBeNull();
    });

    it('applyTheme(dark) 等价于 setMode("dark")', async () => {
      const store = await freshStore();
      store.applyTheme(true);
      expect(store.mode).toBe('dark');
      store.applyTheme(false);
      expect(store.mode).toBe('light');
    });
  });

  describe('版式意图 store 化（2026-10-20：URL 一次读入，debug 只写 store）', () => {
    it('?th_std=compact 只进 standard 那条；其它设备无显式意图', async () => {
      const store = await freshStoreWithRouter('?th_std=compact', { th_std: 'compact' });
      expect(store.deviceViewOf('standard')).toBe('compact');
      expect(store.deviceViewOf('mobile')).toBeNull();
    });

    it('?th=base 通用键：所有设备都拿到它（viewIntent 承载，不下发副本）', async () => {
      const store = await freshStoreWithRouter('?th=base', { th: 'base' });
      expect(store.deviceViewOf('standard')).toBe('base');
      expect(store.deviceViewOf('mobile')).toBe('base');
      expect(store.viewIntent).toBe('base');
    });

    it('设备专属优先于通用：?th_std=compact&th=base', async () => {
      const store = await freshStoreWithRouter('?th_std=compact&th=base', {
        th_std: 'compact',
        th: 'base'
      });
      expect(store.deviceViewOf('standard')).toBe('compact');
      expect(store.deviceViewOf('mobile')).toBe('base');
    });

    it('空串 = 未指定：?th_std= 不吞掉通用键 ?th=base', async () => {
      const store = await freshStoreWithRouter('?th_std=&th=base', { th_std: '', th: 'base' });
      expect(store.deviceViewOf('standard')).toBe('base');
    });

    it('锁定边界（Spec ⑧）：mobile 锁定时只用自己那条意图，th_std 不影响它', async () => {
      // 注意：这里是"设备身份 = mobile"，而 th_std 是 standard 的专属键 ——
      // mobile 无显式意图 → 落声明档/当前包（与 ThemeView 的 pick 链一致）。
      const store = await freshStoreWithRouter('?th_std=compact', { th_std: 'compact' });
      store.setActiveDevice(MOBILE);
      expect(store.deviceViewOf(MOBILE)).toBeNull();
      expect(store.deviceViewOf('standard')).toBe('compact');
    });

    it('setDeviceView 只写 store、不改 URL（debug 换版式零路由变化）', async () => {
      const store = await freshStoreWithRouter();
      const before = window.location.search;
      store.setDeviceView('standard', 'compact');
      expect(window.location.search).toBe(before);
      expect(store.deviceViewOf('standard')).toBe('compact');
    });

    it('clearDeviceViewOverride 清掉显式意图，回到无意图态', async () => {
      const store = await freshStoreWithRouter('?th_std=compact', { th_std: 'compact' });
      expect(store.deviceViewOf('standard')).toBe('compact');
      store.clearDeviceViewOverride('standard');
      expect(store.deviceViewOf('standard')).toBeNull();
    });

    it('URL 上 th* 原始值变化 → 同步进 store（watch currentQuery，跨页带不同 th）', async () => {
      const store = await freshStoreWithRouter('?th=base', { th: 'base' });
      expect(store.deviceViewOf('standard')).toBe('base');
      // 模拟 /login → /register：fake router 的 query 变了（th 消失、th_std 出现）
      lastFakeRoute!.query = { th_std: 'compact' };
      await flush();
      expect(store.deviceViewOf('standard')).toBe('compact');
      expect(store.deviceViewOf('mobile')).toBeNull(); // 通用键没了，不再三端共用
    });

    it('非 th* 键变化不触发同步：debug 写进 store 的值不会被冲掉', async () => {
      const store = await freshStoreWithRouter('', {});
      store.setDeviceView('standard', 'compact');
      // 链接里加了别的参数（如 appName）—— th* 快照没变，不应重新读入
      lastFakeRoute!.query = { appName: 'x' };
      await flush();
      expect(store.deviceViewOf('standard')).toBe('compact');
    });

    it('?theme=dark 被忽略（明暗 URL 入口已废弃失效，见 skinsuite 文档站「明暗与色系」）', async () => {
      const store = await freshStore('?theme=dark');
      expect(store.mode).toBe('system');
      expect(store.isDark).toBe(false);
    });
  });

  describe('导出面完整（拆分不得缩水公开 API）', () => {
    it('对外方法/状态一个不少', async () => {
      const store = await freshStore();
      const api = [
        'mode', 'isDark', 'themeId', 'packageId', 'device', 'activeDevice',
        'activePage', 'activeView', 'activeTone', 'themes', 'systemDark',
        'themeTokens', 'externalTokens', 'lightColor', 'darkColor',
        'themeRecordFor', 'setActiveDevice', 'setActivePageView', 'setMode',
        'cycleMode', 'toggleTheme', 'setTheme', 'viewFor', 'applyThemeConfig',
        'applyTheme', 'dispose',
        // 版式意图 store 化（2026-10-20）
        'viewIntent', 'deviceViewOf', 'setDeviceView', 'clearDeviceViewOverride'
      ];
      for (const key of api) {
        expect(store, `store 缺少导出：${key}`).toHaveProperty(key);
      }
    });
  });

  describe('DOM 副作用（token 注入与属性写入）', () => {
    it('生效配色会写到 html 的 data-mauth-theme', async () => {
      const store = await freshStore();
      store.setActiveDevice(MOBILE);
      store.setActivePageView('login', DEFAULT_PKG);
      store.setTheme('blue');
      await flush();
      expect(document.documentElement.dataset.mauthTheme).toBe('blue');
    });

    it('深色时给 html 挂 dark 类', async () => {
      const store = await freshStore();
      store.setTheme('black');
      await flush();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('dispose 摘除系统偏好监听（不再响应 change）', async () => {
      // happy-dom 的 matchMedia 每次返回**新实例**，spy 打不到 store 内部那一个。
      // 改成：在 store 创建前把 window.matchMedia 换成返回**同一个稳定 mock**，
      // 这样 add/removeEventListener 都落在我们手里这一个对象上。
      const realMatchMedia = window.matchMedia.bind(window);
      const listeners = new Set<(e: MediaQueryListEvent) => void>();
      const mockMq = {
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb)
      } as unknown as MediaQueryList;

      const addSpy = vi.spyOn(mockMq, 'addEventListener');
      const removeSpy = vi.spyOn(mockMq, 'removeEventListener');
      window.matchMedia = (() => mockMq) as typeof window.matchMedia;

      try {
        const store = await freshStore();
        expect(addSpy).toHaveBeenCalled();
        expect(listeners.size).toBe(1);

        store.dispose();
        await flush();

        expect(removeSpy).toHaveBeenCalled();
        expect(listeners.size).toBe(0);
      } finally {
        window.matchMedia = realMatchMedia;
      }
    });
  });
});
