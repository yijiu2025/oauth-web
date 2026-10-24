/**
 * oauth21 前端单元测试配置（vitest）
 *
 * === 为什么用 vitest 而非根 Jest ===
 * 根 jest.config.js 的 testMatch 是 `<root>/src/__tests__/` 下的 `.test.js`，且
 * `testEnvironment: 'node'` —— 匹配不到 `oauth21/__tests__`，也渲染不了 Vue 组件。
 * 前端组件测试需要 happy-dom（DOM）+ @vue/test-utils，vitest 与 Vite 同构，
 * 是 Vue 3 生态的标准选择。
 *
 * === 配置继承（mergeConfig，2026-10-24 起）===
 * vitest 一旦存在本文件就**完全不加载** vite.config.ts（vitest 的配置解析优先级）。
 * 此前靠 `config/aliases.ts` + `config/plugins.ts` 两个共享模块在两边各 import 一份
 * 防漂移；现改为 vitest 官方推荐的 mergeConfig 继承 —— 插件（themeAssets / vue /
 * AutoImport / Components / svg 图标）与 alias 只在 vite.config.ts 声明一次，
 * 本文件只写纯测试配置。build/test 一致性从「共享模块纪律」升级为「继承结构」，
 * `config/plugins.ts` 因此退役删除。
 *
 * ⚠️ 继承会把 AutoImport / Components / svg 图标三个构建期插件也带进测试
 *    （此前测试侧只有 themeAssets + vue）：`src/auto-import.d.ts` / `src/components.d.ts`
 *    会在跑测试时重新生成（内容与提交一致则无感）、启动略慢。测试环境更贴近 dev
 *    本是 vitest 的设计意图，先接受；真有副作用再在 merge 前按插件 name 过滤。
 * ⚠️ `skinsuite*` / `stable-deviceid` alias 是**条件注册**的（monorepo 源码直供 /
 *    独立 checkout 回落 npm 版，双形态设计见 `config/aliases.ts` 文件头），随继承生效。
 * ⚠️ vite.config 导出的是 UserConfigFn（`defineConfig(() => ({…}))`），mergeConfig
 *    只收 UserConfig —— 必须先按 ConfigEnv 调用取回对象再喂给它。
 */
import { defineConfig, mergeConfig } from 'vitest/config';
// 带 .js 后缀：Vite 未来默认 configLoader:'native' 需显式扩展名，否则打警告
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
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
  })
);
