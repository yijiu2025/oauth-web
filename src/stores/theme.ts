/**
 * 主题状态管理（**宿主壳**：Pinia store 定义 + 状态机下沉）
 *
 * === 状态机已下沉（2026-10-19）===
 * 「明暗 ≡ 配色系别」状态机的三块 composable（scope / intent / runtime）+ 持久化层
 * 已全部下沉进 `skinsuite/vue` 的 `createThemeState`。本文件只剩：
 *   · 一行 `defineStore('theme', () => createThemeState())` 把状态机包成 store；
 *   · `import 'virtual:theme'` 副作用装配（版式加载表 + 注册表 + 清单 + views/*.ts 声明）。
 *
 * === 三个维度 + 一个作用域（语义不变）===
 *   mode（明暗意图）'system' | 'light' | 'dark'
 *   theme（配色 id）对应 `themes/<包>/<设备>/<页面>/colors/<配色>/`，自带 tone 与完整底色
 *   view（版式 id）≡ 主题包名
 *   设备 —— 不是偏好，而是页面身份
 *
 * === 为什么 pinia 不跟着下沉 ===
 * 状态机全程只用 ref/computed/watch，零 pinia API —— 下沉它不需要 pinia。pinia 只是把
 * composable 注册成 store 实例的一层壳，留在宿主，避免给库加一个 peer 依赖。
 *
 * @author yijiu2025
 * @since 2026-10-19（状态机下沉 skinsuite/vue，本文件退化为壳）
 */
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
// 🔴 副作用 import：import 虚拟模块即自动完成三件装配 —— 装版式加载表（installThemeViews）、
//    装配色注册表、解析清单单例，并以副作用 import 拉齐 `views/*.ts`（设备声明 devices.ts +
//    页面契约 login/register/forgot-password 的 defineThemeDevice / defineThemePage 注册）。
//    宿主不再手动 import 任何 `@/theme/views/*`（bootstrap 也不），机制全由内核构建插件拉齐。
import 'virtual:theme';

export const useThemeStore = defineStore('theme', () => createThemeState());
