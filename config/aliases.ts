/**
 * 路径别名**单一来源**（vite / vitest / tsconfig 三处共用）
 *
 * === 为什么要有这个文件 ===
 * 此前 `@` / `skinsuite` / `stable-deviceid` 三个别名被**手抄三份**：
 *   - `vite.config.js` 的 `resolve.alias`（构建 + dev server）
 *   - `vitest.config.ts` 的 `resolve.alias`（单测）
 *   - `tsconfig.app.json` 的 `compilerOptions.paths`（类型检查）
 * 三份里任意一份漏改，症状都不是报错而是**静默解析失败或解析到另一份实现**：
 *   - vite / vitest 漏改 → 组件 import 时 `Cannot find module`
 *   - tsconfig 漏改 → `vue-tsc -b` 报找不到声明（或退化成 any 而静默放过）
 * 两个本地包（`skinsuite` / `stable-deviceid`）在 monorepo 里**必须指到包内
 * `src/index.ts`（源码直供）**，刻意不指向包目录 —— 那样解析要靠 npm 建的
 * `node_modules/<pkg>` 符号链接，首次克隆还没装依赖时就解析不了。npm 侧在
 * package.json 里声明版本号只是为了
 * 让 lockfile / 供应链审计说得通，**运行期真伪以本文件为准**。
 *
 * === 为什么是 `.ts` 而不是 `.js` ===
 * 本文件被 `vite.config.ts`（TS）与 `vitest.config.ts`（TS）共同 import，且自身
 * 需要 `import.meta.dirname` 与类型标注。统一成 TS 后，两处 config 的**语言也统一为 TS**
 * （此前 vite.config 是 .js、vitest.config 是 .ts，同一份 alias 却跨语言抄）。
 *
 * === tsconfig paths 为什么不直接 import 本文件 ===
 * `compilerOptions.paths` 是 JSON 静态配置，无法求值 TS 模块。因此 `tsconfig.app.json`
 * 里那几条必须手写 —— 这是该约束下唯一无法消除的重复。为把风险降到最低：
 * 🔴 关卡 `e2e/verify-alias-single-source.mjs` 会**比对**（本文件 / tsconfig.app.json /
 *    vitest 实际解析）是否一致，任何一处漂移直接红。
 *
 * === 双形态：monorepo 源码直供 ↔ 独立仓 npm 版 ===
 * 本仓有两种运行形态，两个本地包的 alias **按源码是否存在条件注册**：
 *   - **monorepo 形态**（上级目录有 `packages/`）：源码直供，开发期改包源码即时生效。
 *   - **独立仓形态**（单仓 checkout / CI / 开源用户装完即用）：上级没有 `packages/`，
 *     这两个 alias 键**不注册**，裸说明符 `skinsuite` / `stable-deviceid` 自然解析到
 *     `node_modules` 里的 npm 版（package.json 声明的 `^0.1.0`）。
 *
 * 🔴 为什么是"删键"而不是别的办法（2026-10-15 CI 实测踩坑）：
 *   - vite / vitest 的 alias 是**精确匹配且优先于 node_modules**：键在、但指向的
 *     源码文件不存在（独立仓没有 packages/）= `Failed to resolve import "skinsuite"`，
 *     vitest 两个 suite 27 例全红。**它不会自动回落 node_modules。**
 *   - 删键后 vite/vitest 走标准 node 解析命中 npm 版；TypeScript 的 paths 同理——
 *     paths 未命中会继续 node_modules 解析（CI type-check 在删键前就已实证：tsconfig
 *     的 paths 指向不存在的 `../packages/...` 时 vue-tsc 不报错，回落 npm 版声明）。
 *   - 也不"指向 node_modules 绝对路径"：那条路径依赖安装布局（hoist / pnpm 符号链接），
 *     比删键脆弱。
 *
 * 🔴 npm 版与源码版的一致性靠两道闸：① 发包前导出集合对比（0.1.0 实测零缺口）；
 *   ② 关卡在两种形态下分别验证 —— monorepo 比源码路径，standalone 探 node_modules
 *   dist 真实存在且可解析。
 *
 * @see oauth21/e2e/verify-alias-single-source.mjs
 */
import path from 'node:path';
import { existsSync } from 'node:fs';

/** 本文件所在目录（= oauth21/config）。用 import.meta.dirname 避免 CJS 的 __dirname。 */
const HERE = import.meta.dirname;

/** oauth21 工程根（config/ 的上一级）。 */
export const OAUTH21_ROOT = path.resolve(HERE, '..');

/** monorepo 根（packages/ 的所在处，即 oauth21 的上一级）。 */
export const MONOREPO_ROOT = path.resolve(OAUTH21_ROOT, '..');

/**
 * 两个本地包的 monorepo 源码入口（源码直供目标）。
 * 键顺序即 aliases 注册顺序（`@` 恒在最前）。
 */
const LOCAL_PKG_SOURCES: Record<string, string> = {
  'skinsuite': path.resolve(MONOREPO_ROOT, 'packages/theme-core/src/index.ts'),
  'stable-deviceid': path.resolve(MONOREPO_ROOT, 'packages/shared-device/src/index.ts')
};

/**
 * 别名表：键 = import 说明符，值 = 绝对路径。
 *
 * 注：Vite 的 `resolve.alias` 做的是**精确键匹配**（不做前缀通配），
 * 所以 `skinsuite` 只解析裸说明符 `skinsuite` 本身，不会吞掉 `skinsuite/xxx` 子路径。
 * 两个本地包目前也只从入口 import（无子路径用法），故不需要通配键。
 *
 * `@` 恒注册（src/ 是本仓自有目录，两种形态都在）；两个本地包仅当
 * monorepo 源码存在时注册（见文件头「双形态」）。
 */
export const aliases: Record<string, string> = {
  '@': path.resolve(OAUTH21_ROOT, 'src')
};

for (const [spec, src] of Object.entries(LOCAL_PKG_SOURCES)) {
  if (existsSync(src)) {
    aliases[spec] = src;
  }
}

/**
 * tsconfig `paths` 形态（值必须是**相对 tsconfig 文件**的路径，且用 `/` 分隔）。
 * 供关卡与本文件比对；运行时不被 vite/vitest 读取。
 *
 * 注意这是 **monorepo 形态的静态描述**：独立仓形态下这两条指向的
 * `../packages/...` 不存在，TypeScript 会回落 node_modules 解析 npm 版
 * （paths 未命中不报错）。关卡按形态分流比对，见关卡脚本。
 */
export const tsconfigPaths: Record<string, string[]> = {
  '@/*': ['./src/*'],
  'stable-deviceid': ['../packages/shared-device/src/index.ts'],
  'stable-deviceid/*': ['../packages/shared-device/src/*'],
  skinsuite: ['../packages/theme-core/src/index.ts']
};

export default aliases;
