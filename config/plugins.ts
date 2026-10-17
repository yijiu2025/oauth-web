/**
 * 共享插件**单一来源**（vite / vitest 两处 config 共用）
 *
 * === 为什么要有这个文件 ===
 * 主题扫描插件 `themeAssets` 与 `vue` 插件必须在 **build 与 test 两侧完全一致**：
 *   - 构建侧（`vite.config.ts`）：扫主题目录 → 产出 `virtual:theme`，业务代码
 *     `registry.ts` 靠它拿到主题包与配色。
 *   - 测试侧（`vitest.config.ts`）：单测里的 `theme.test.ts`（27 例）同样要解析
 *     `virtual:theme`，否则注册表为空、全部用例静默落默认值（`themeId` 恒为
 *     `default`，不报错、只红断言，极难归因）。
 * 两边漏挂、或挂的目录解析口径不一致（构建扫 A 目录、单测扫 B 目录），症状都不是
 * 报错而是「单测和真机构建行为分叉」——这是比「手抄 alias」更隐蔽的一类漂移。
 *
 * 此前这两行是**手抄两份**，靠关卡 `verify-alias-single-source.mjs` 事后比对。
 * 现在与 `aliases` 同一手法：抽成一份，两边 import，漏改即编译期可见。
 *
 * === 为什么导出一个**函数**而不是静态数组 ===
 * `themeAssets` 的目录来自 `resolveThemeDir(mode)`，`mode` 是 `defineConfig(({ mode }) => …)`
 * 回调才拿得到的运行时值（development / production / test）。所以共享的必须是
 * 「接收 mode → 返回插件数组」的工厂，而不是在模块加载期就定死的数组。
 *
 * === 为什么只收这两件、不收 AutoImport / Components / svg 图标 ===
 * 那些是**构建/开发专用**的插件（自动导入生成 dts、图标雪碧图），单测里不需要、
 * 也不应该进测试的模块图。共享的边界是「构建与测试都必须一致」的最小集合：
 * 主题虚拟模块 + Vue SFC 编译。
 *
 * @see oauth21/vite.config.ts、oauth21/vitest.config.ts
 */
import vue from '@vitejs/plugin-vue';
import { themeAssets, resolveThemeDir } from 'skinsuite/vite';
import { OAUTH21_ROOT } from './aliases.js';

/**
 * 构建与测试两侧**共用**的插件集。
 *
 * @param mode Vite 的 mode（由 `defineConfig(({ mode }) => …)` 传入），
 *             决定 `resolveThemeDir` 读哪个 `.env.<mode>`。
 * @returns `themeAssets`（主题虚拟模块）+ `vue`（SFC 编译）两个插件，顺序与
 *          原两份 config 一致（主题插件在前、vue 在后）。
 *
 * ⚠️ 返回类型**不显式标注** `Plugin[]`：`themeAssets` 的 `Plugin` 类型来自
 *    `skinsuite/vite` → 上溯到**根仓 node_modules 的 vite（5.4）**，而 `vue()` 的
 *    `Plugin` 类型来自 **oauth21 本地 vite（8.2）**。两个 vite 版本的 `Plugin`
 *    结构不兼容（`resolveId` 的 `this` 类型不同），显式标注 `Plugin[]` 会触发
 *    TS2322。交给类型推断得到联合类型，`defineConfig` 的 `plugins: PluginOption[]`
 *    能接受它。这是「跨 monorepo 边界共享插件」的真实约束，不是能用标注绕过的。
 *
 * ⚠️ `resolveThemeDir` 显式传 `root: OAUTH21_ROOT`：它的缺省 `root = process.cwd()`，
 *    在「从别的 cwd 起 vite」（如关卡 `verify-all` 以 `oauth21/e2e/` 为 cwd 跑
 *    `verify-glob-device`）时会去错目录找 `.env` → `VITE_THEME_DIR` 读不到 → 扫空。
 *    工程根必须基于**本文件位置**推导，而不是进程 cwd。
 */
export function sharedPlugins(mode: string) {
  return [themeAssets({ dir: resolveThemeDir(mode, OAUTH21_ROOT) }), vue()];
}
