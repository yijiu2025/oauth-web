/**
 * 主题状态管理
 *
 * === 三个维度 + 一个作用域 ===
 *   mode（明暗意图）—— 用户可控：'system' | 'light' | 'dark'
 *   theme（配色）—— 一个**配色 id**，对应
 *                   `theme/themes/<包>/<设备>/<页面>/colors/<配色>/`;
 *                   每套配色自带 `tone`（白系/黑系）与完整底色。
 *   view（版式） —— 版式 id（`?view=` / 包声明 / 环境变量），在"包 × 设备"内查找。
 *                   🔴 版式 id ≡ 主题包名（一个主题包 = 一种版式，2026-09-26）。
 *   **设备**（'mobile' | 'standard' | 'mini'）—— 不是偏好，而是**页面身份**。
 *
 * === 来源与优先级（高 → 低）===
 *   用户显式操作（点色卡 / 切明暗）
 *     > theme：URL `?theme.<设备>` / `?theme=` / `?skin=`  >  后端下发 / 父应用  >  localStorage
 *     > mode ：URL `?mode=`  >  后端下发 / 父应用  >  localStorage  >  跟随系统
 *
 * === 架构（2026-10-17 拆成三个 composable）===
 *   scope  (theme-scope.ts)  设备/页面/版式作用域 + 配色解析入口
 *   intent (theme-intent.ts) 明暗意图 + 会话记忆槽 + 色系联动
 *   runtime(theme-runtime.ts)token 注入 + 附加样式 + 外部配置
 * 本文件 = 编排层：按依赖顺序创建 scope → intent → runtime，对外直通 28 项 API。
 *
 * @author yijiu2025
 */
import { defineStore } from 'pinia';
import { useThemeScope } from './theme-scope';
import { useThemeIntent } from './theme-intent';
import { useThemeRuntime } from './theme-runtime';
// 🔴 副作用 import：确保主题注册表（内核模块级单例）已安装
import '@/theme-manifest';

export const useThemeStore = defineStore('theme', () => {
  // ① 作用域（共享基础：activeDevice / activePage / activeView / themeRecordFor / isDark 等）
  const scope = useThemeScope();

  // ② 意图（明暗三态 + 记忆槽 + 色系联动 + 用户操作入口）
  const intent = useThemeIntent(scope);

  // ③ 运行时（token 注入 + 附加样式 + 明暗类 + 外部配置）；必须最后创建（内部 watch immediate 依赖前两步）
  const runtime = useThemeRuntime(scope, intent);

  // -------------------------------------------------------------------------
  // 调试探针（仅 dev + ?debug=theme）
  // -------------------------------------------------------------------------
  if (import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'theme') {
    (window as unknown as Record<string, unknown>).__MAUTH_STORE__ = {
      get themeId() { return scope.themeId.value; },
      get deviceTheme() { return { ...scope.deviceTheme.value }; },
      get mode() { return intent.mode.value; },
      get packageId() { return scope.packageId.value; },
      get activeDevice() { return scope.activeDevice.value; },
      get activePage() { return scope.activePage.value; },
      get activeView() { return scope.activeView.value; },
      get activeThemeId() { return scope.themeRecordFor().meta.id; },
      get activeTone() { return scope.themeRecordFor().tone; }
    };
  }

  return {
    // ---- 来自 scope ----
    mode: intent.mode,
    isDark: scope.isDark,
    themeId: scope.themeId,
    packageId: scope.packageId,
    device: scope.device,
    activeDevice: scope.activeDevice,
    activePage: scope.activePage,
    activeView: scope.activeView,
    activeTone: scope.activeTone,
    themes: scope.themes,
    systemDark: intent.systemDark,
    themeTokens: runtime.themeTokens,
    externalTokens: runtime.externalTokens,
    lightColor: intent.lightColor,
    darkColor: intent.darkColor,
    themeRecordFor: scope.themeRecordFor,
    setActiveDevice: scope.setActiveDevice,
    setActivePageView: scope.setActivePageView,
    // ---- 来自 intent ----
    setMode: intent.setMode,
    cycleMode: intent.cycleMode,
    toggleTheme: intent.toggleTheme,
    setTheme: intent.setTheme,
    viewFor: scope.viewFor,
    // ---- 来自 runtime ----
    applyThemeConfig: runtime.applyThemeConfig,
    applyTheme: intent.applyTheme,
    dispose: intent.dispose
  };
});