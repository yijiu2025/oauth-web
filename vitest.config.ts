/**
 * oauth21 前端单元测试配置（vitest）
 *
 * === 为什么用 vitest 而非根 Jest ===
 * 根 jest.config.js 的 testMatch 是 `<root>/src/__tests__/` 下的 `.test.js`，且
 * `testEnvironment: 'node'` —— 匹配不到 `oauth21/__tests__`，也渲染不了 Vue 组件。
 * 前端组件测试需要 happy-dom（DOM）+ @vue/test-utils，vitest 与 Vite 同构、
 * 直接复用本仓的 alias 与 vue 插件，是 Vue 3 生态的标准选择。
 *
 * === alias 单一来源 ===
 * `@` / `skinsuite` / `skinsuite/vue` / `skinsuite/vue/panel` / `skinsuite/vite` / `stable-deviceid`
 * 来自 `config/aliases.ts`，与 `vite.config.ts` 共用同一份定义
 * （此前是两处手抄，漏改即静默解析失败）。
 * 同理，`themeAssets` + `vue` 两个插件来自 `config/plugins.ts` 的 `sharedPlugins()`，
 * 与构建侧同源 —— 单测里 `virtual:theme` 必须由同一插件产出，否则 27 个 store 用例
 * 的注册表为空、静默落默认值（`themeId` 恒 `default`，不报错只红断言）。
 * 注意 `skinsuite*` / `stable-deviceid` 是**条件注册**的：monorepo 里源码直供，
 * 单仓 checkout（CI / 开源用户）没有 packages/ 时不注册、解析回落 node_modules
 * 的 npm 版 —— 双形态设计见 `config/aliases.ts` 文件头。
 * `tsconfig.app.json` 的 `paths` 因是静态 JSON 无法 import，仍手写 ——
 * 由 `e2e/verify-alias-single-source.mjs` 守三处一致。
 */
import { defineConfig } from 'vitest/config';
// 带 .js 后缀：Vite 未来默认 configLoader:'native' 需显式扩展名，否则打警告
import { aliases } from './config/aliases.js';
import { sharedPlugins } from './config/plugins.js';

export default defineConfig(({ mode }) => ({
  // 主题域必须与构建同源：注册表要 `virtual:theme`、面板要清单路由，
  // 单测里也得由同一个插件产出（否则 27 个 store 用例全部解析失败）。
  // `resolveThemeDir` 与 vite.config 同源，避免"构建扫 A 目录、单测扫 B 目录"。
  plugins: [...sharedPlugins(mode)],
  resolve: {
    alias: aliases
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    // 只认 `__tests__/` 与 `src/**/__tests__/` 下的测试文件
    include: ['__tests__/**/*.{test,spec}.{ts,js}', 'src/**/__tests__/**/*.{test,spec}.{ts,js}'],
    // 🔴 `skinsuite/vue` 以**源码形态**发布（含 `.vue` 与组合式 API，tsc 编不出 SFC）。
    // monorepo 形态下 alias 指到 `packages/theme-core/src/`，不在 node_modules 里，Node 能直接剥类型；
    // 独立仓形态（CI / 开源用户）没有 packages/，解析落到 `node_modules/skinsuite/src/vue/index.ts`，
    // Node 会拒绝：
    //   Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently
    //   unsupported for files under node_modules
    // 强制让 vitest 用自己的转译链路处理这个包，而不是交给 Node 原生 import。
    server: { deps: { inline: ['skinsuite'] } }
  }
}));
