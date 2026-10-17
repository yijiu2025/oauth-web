/**
 * 主题作用域（scope）—— 设备 / 页面 / 版式三个查找维度 + 配色解析入口
 *
 * 从 `stores/theme.ts` 拆分（2026-10-17 架构收尾，四个优化之首）。
 * 本文件只负责「作用域」这件事：
 *   · 设备身份 `activeDevice`：路由基线 + 桌面分发器按实际渲染形态纠正；
 *   · 页面 / 版式 `activePage` / `activeView`：由容器在 setup 里告知；
 *   · `themeRecordFor`：把「配色意图（themeId / deviceTheme）+ 作用域」解析成可渲染配色；
 *   · 派生值：`isDark`（= 生效配色 tone）、`activeTone`、`packageId`、`device`。
 *
 * === 依赖方向（拆分的骨架）===
 *   scope ← intent（明暗意图，读 activeDevice/activePage/activeView/themeId）
 *   scope ← runtime（token 注入 / 附加样式，读 themeRecordFor/isDark/activeDevice/themeId/deviceTheme）
 * 本文件**不反向依赖** intent / runtime —— 它是唯一的共享基础。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 stores/theme.ts 拆出，行为保持不变）
 */
import { computed, ref } from 'vue';
import { DEFAULT_THEME_PACKAGE, DEFAULT_THEME_PAGE, getThemeRecord, listThemes } from 'skinsuite';
import { DEFAULT_THEME_DEVICE, type ThemeDevice } from '@/theme/views/devices';
import { readInitialTheme, readUrlIntent, type DeviceThemeIntent } from './theme-persistence';

export function useThemeScope() {
  const urlIntent = readUrlIntent();

  /**
   * URL 按设备指定的配色（**响应式**）
   * 做成 ref 而非普通常量，是**用户显式操作会清掉当前设备那一条**（见 `clearDeviceThemeOverride`）。
   */
  const deviceTheme = ref<DeviceThemeIntent>({ ...urlIntent.deviceTheme });

  /**
   * 某设备的配色是否被 URL **显式**指定 → 该设备"锁定"。
   * 锁定只挡**自动**改写，不挡用户显式操作；逐设备判定是必须的。
   */
  function urlLockedThemeOf(device: ThemeDevice): boolean {
    return deviceTheme.value[device] !== undefined;
  }

  /**
   * 清掉某设备被 URL 写下的配色 —— **只该由用户的显式操作调用**。
   */
  function clearDeviceThemeOverride(device: ThemeDevice = activeDevice.value): void {
    if (deviceTheme.value[device] === undefined) return;
    const next = { ...deviceTheme.value };
    delete next[device];
    deviceTheme.value = next;
  }

  /**
   * **全局**配色 —— 只被"URL 没有覆盖这台设备"的那些设备采用。
   * 设备专属 URL 值在 `themeRecordFor` 里优先于它。
   */
  const themeId = ref<string>(urlIntent.deviceTheme[DEFAULT_THEME_DEVICE] ?? readInitialTheme());

  /** 当前**生效设备** —— 决定把哪一套配色 token 注入 html；是"当前渲染视图属于哪种设备" */
  const activeDevice = ref<ThemeDevice>(DEFAULT_THEME_DEVICE);

  function setActiveDevice(device: ThemeDevice): void {
    if (activeDevice.value !== device) activeDevice.value = device;
  }

  /** 当前生效页面 / 版式（配色归属 = 包 × 设备 × 页面） */
  const activePage = ref<string>(DEFAULT_THEME_PAGE);
  const activeView = ref<string>(DEFAULT_THEME_PACKAGE);

  function setActivePageView(page: string, view: string): void {
    if (page && activePage.value !== page) activePage.value = page;
    const next = view || DEFAULT_THEME_PACKAGE;
    if (activeView.value !== next) activeView.value = next;
  }

  /**
   * 按设备 + 页面 + 版式解析出**实际生效**的配色记录。
   * 🔴 设备专属 URL 配色优先于全局 themeId：`deviceTheme[device] ?? themeId`。
   * 🔴 接收 pkg 参数：view ≡ pkg，配色查找必须按当前包。
   */
  function themeRecordFor(
    pkg: string = DEFAULT_THEME_PACKAGE,
    device: ThemeDevice = activeDevice.value,
    page: string = activePage.value
  ): ReturnType<typeof getThemeRecord> {
    const id = deviceTheme.value[device] ?? themeId.value;
    return getThemeRecord({ id, device, pkg, page });
  }

  /** 最终是否深色 = 当前**生效配色**的系别（明暗 ≡ 色系） */
  const isDark = computed(() => themeRecordFor().tone === 'dark');

  /** 当前生效配色的系别 */
  const activeTone = computed(() => themeRecordFor().tone ?? 'light');

  /** 当前生效主题包（做成 computed 让容器的 watch 能当响应源） */
  const packageId = computed(() => themeRecordFor().pkg);

  /** 当前生效设备（只读别名） */
  const device = computed(() => activeDevice.value);

  /** 可选主题列表（注册表静态，取一次） */
  const themes = listThemes();

  /** 取当前配色为某页面声明的版式 id（只取值不校验） */
  function viewFor(page: string, dev: ThemeDevice = activeDevice.value): string | undefined {
    return themeRecordFor(packageId.value, dev, page).views?.[page];
  }

  return {
    urlIntent,
    deviceTheme,
    themeId,
    activeDevice,
    activePage,
    activeView,
    isDark,
    activeTone,
    packageId,
    device,
    themes,
    urlLockedThemeOf,
    clearDeviceThemeOverride,
    setActiveDevice,
    setActivePageView,
    themeRecordFor,
    viewFor
  };
}

/** scope 的公开面（供 intent / runtime 引用；类型由 `useThemeScope` 返回处推断） */
export type ThemeScope = ReturnType<typeof useThemeScope>;
