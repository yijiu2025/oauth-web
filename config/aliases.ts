/**
 * 路径别名**单一来源**（vite.config 消费；关卡锚点；tsconfig 手抄对照）
 *
 * === 消费方现状（2026-10-24 起）===
 * - `vite.config.ts` import 本文件（唯一的 config 消费方）
 * - `vitest.config.ts` 经 mergeConfig 继承 vite.config，**不再直接 import**
 *   —— 此前「两个 config 各 import 一份防漂移」的形态已退役（`config/plugins.ts`
 *   同因删除）；build/test 的 alias 一致性由继承结构保证
 * - `tsconfig.app.json` 的 paths 仍是手抄（静态 JSON 无法求值 TS 模块），
 *   由关卡 `e2e/verify-alias-single-source.mjs` 比对
 * - 关卡同时把本文件当**锚点**（动态 import 取数据 / 存在性检查 / 双形态
 *   物理条件同源）—— 消除本文件需连动改 2-3 个关卡，收益只是少一个文件，
 *   不划算；真实逻辑（双形态探测）无论放哪都得存在
 *
 * === 历史与不变量 ===
 * 本地包（`skinsuite` / `stable-deviceid`）在 monorepo 里**必须指到包内
 * `src/index.ts`（源码直供）**，刻意不指向包目录 —— 那样解析要靠 npm 建的
 * `node_modules/<pkg>` 符号链接，首次克隆还没装依赖时就解析不了。npm 侧在
 * package.json 里声明版本号只是为了
 * 让 lockfile / 供应链审计说得通，**运行期真伪以本文件为准**。
 *
 * === 为什么是 `.ts` 而不是 `.js` ===
 * 被 `vite.config.ts`（TS）import，且自身需要 `import.meta.dirname` 与类型标注
 * （关卡也以动态 import 读它）。
 *
 * === tsconfig paths 为什么不直接 import 本文件 ===
 * `compilerOptions.paths` 是 JSON 静态配置，无法求值 TS 模块。因此 `tsconfig.app.json`
 * 里那几条必须手写 —— 这是该约束下唯一无法消除的重复。为把风险降到最低：
 * 🔴 关卡 `e2e/verify-alias-single-source.mjs` 会**比对**（本文件 / tsconfig.app.json /
 *    vitest 实际解析）是否一致，任何一处漂移直接红。
 *
 * === 双形态：都用「源码直供」，只是源码根不同 ===
 *   - **monorepo 形态**（上级目录有 `packages/`）：指向 `packages/<包>/src`，改包源码即时生效。
 *   - **独立仓形态**（单仓 checkout / CI / 开源用户装完即用）：指向
 *     `node_modules/skinsuite/src`（该包 `files` 里带 `src`，源码随包发布）。
 *
 * 🔴 为什么独立仓形态**不能**「删键回落 npm 版」（2026-10-19 CI 实测）：
 * npm 版三个入口的运行时形态是**混的** —— `.` 与 `./vite` 指 `dist/*.js`（编译产物），
 * `./vue` 只能指 `src/vue/index.ts`（含 `.vue` 与组合式 API，tsc 编不出 SFC）。
 * 于是同一个构建里机制出现**两个模块实例**：`virtual:theme` 用 `skinsuite`（dist）写入
 * 注册表，而 `createThemeState`（`skinsuite/vue`，源码）读的是另一份空表 ——
 * 症状是配色静默落占位 id `default`（不是 `white`），**类型检查 / lint / 构建全绿**，
 * 只有「按设备/页面取配色」的运行时行为错，极难归因。
 *
 * 所以两种形态统一「源码直供」：同一个文件 → 一个模块实例。
 * 代价是消费方要能编译 TS（Vite / Vitest 都能，这也是本仓唯一的使用场景）。
 *
 * 🔴 仍然不能"指向不存在的路径"（2026-10-15 踩坑）：alias 键在、文件不存在 =
 *   `Failed to resolve import`，**不会自动回落 node_modules**。所以这里的每一步都
 *   先 `existsSync` 探路径，探不到就不注册。
 *
 * ⚠️ `skinsuite/vite` 在独立仓形态下**两种解析并存且都成立**：`vite.config.ts` /
 *   `vitest.config.ts` 由 Node 在**配置加载阶段**用包 exports 解析到 `dist/vite/index.js`
 *   （Node 拒绝在 node_modules 里剥类型，必须走编译产物）；alias 只作用于 Vite 处理的
 *   应用模块，那里的 `skinsuite/vite` 指向源码。构建插件只用纯常量，无共享状态，两种
 *   解析互不影响。
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
 * 本地包的入口声明（`说明符 → 包内相对路径`）。
 * 键顺序即 aliases 注册顺序（`@` 恒在最前）。
 *
 * 🔴 **子路径必须排在父路径之前**：Vite 的 `resolve.alias` 对字符串 `find`
 * 用的是**前缀匹配**（`importee === find || importee.startsWith(find + '/')`），
 * 不是精确匹配。若 `skinsuite` 在前，`skinsuite/vue` 会被改写成
 * `…/src/index.ts/vue`，报 `系统找不到指定的路径`（本仓 2026-10-17 实测）。
 */
const LOCAL_PKG_ENTRIES: ReadonlyArray<{ readonly spec: string; readonly dir: string; readonly rel: string }> = [
  // Vue 绑定层的**独立面板入口**：宿主用 `defineAsyncComponent` 加载它，
  // 单独一条子路径才能让打包器切出独立 chunk（否则面板会并回主包）。
  { spec: 'skinsuite/vue/panel', dir: 'theme-core', rel: 'src/vue/debug/panel.ts' },
  // Vue 绑定层的**同步入口**（composable / 类型）：与纯内核分开，
  // 这样"只要机制不要 Vue"的消费者不会被迫装 UI 层。
  { spec: 'skinsuite/vue', dir: 'theme-core', rel: 'src/vue/index.ts' },
  // 构建期适配器（Vite 扫描插件 + 目录解析）：宿主在 vite/vitest config 里挂它。
  { spec: 'skinsuite/vite', dir: 'theme-core', rel: 'src/vite/index.ts' },
  { spec: 'skinsuite', dir: 'theme-core', rel: 'src/index.ts' },
  { spec: 'stable-deviceid', dir: 'shared-device', rel: 'src/index.ts' }
];

/** 独立仓形态的源码根候选：hoist 到根或落在本仓 node_modules 都认 */
const INSTALLED_ROOTS = [
  path.resolve(MONOREPO_ROOT, 'node_modules'),
  path.resolve(OAUTH21_ROOT, 'node_modules')
];

/**
 * 取某包在「已安装形态」下的源码入口（独立仓形态用）。
 *
 * 只有 `skinsuite` 能这样直供 —— 它 `files` 里带 `src`；`stable-deviceid` 只发 dist，
 * 探不到就自然不注册（回落 node_modules 的正常解析）。
 */
function installedSource(rel: string): string | undefined {
  for (const root of INSTALLED_ROOTS) {
    const candidate = path.resolve(root, 'skinsuite', rel);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * 别名表：键 = import 说明符，值 = 绝对路径。
 *
 * ⚠️ 前缀匹配的后果（见上）：注册顺序有意义，**更具体的键必须排在前面**。
 *
 * `@` 恒注册（src/ 是本仓自有目录，两种形态都在）；本地包**先找 monorepo 源码，
 * 找不到再找 `node_modules/skinsuite/src`** —— 两种形态都是源码直供，见文件头。
 */
export const aliases: Record<string, string> = {
  '@': path.resolve(OAUTH21_ROOT, 'src')
};

for (const { spec, dir, rel } of LOCAL_PKG_ENTRIES) {
  const monorepo = path.resolve(MONOREPO_ROOT, 'packages', dir, rel);
  if (existsSync(monorepo) && !process.env.VITEST_FORCE_STANDALONE) {
    aliases[spec] = monorepo;
    continue;
  }
  if (dir === 'theme-core') {
    const installed = installedSource(rel);
    if (installed) aliases[spec] = installed;
  }
}

/**
 * tsconfig `paths` 形态（值必须是**相对 tsconfig 文件**的路径，且用 `/` 分隔）。
 * 供关卡与本文件比对；运行时不被 vite/vitest 读取。
 *
 * 注意这是 **monorepo 形态的静态描述**：独立仓形态下这些 `../packages/...` 不存在，
 * TypeScript 会回落 node_modules 解析 —— 而 `skinsuite` 的 `types` 本来就指向包内
 * `src/index.ts` / `src/vue/index.ts`（见其 exports），所以两种形态对 TS 而言是
 * **同一份源码**，与上面 aliases 的口径一致。关卡按形态分流比对，见关卡脚本。
 */
export const tsconfigPaths: Record<string, string[]> = {
  '@/*': ['./src/*'],
  'stable-deviceid': ['../packages/shared-device/src/index.ts'],
  'stable-deviceid/*': ['../packages/shared-device/src/*'],
  skinsuite: ['../packages/theme-core/src/index.ts'],
  'skinsuite/vue': ['../packages/theme-core/src/vue/index.ts'],
  'skinsuite/vue/panel': ['../packages/theme-core/src/vue/debug/panel.ts'],
  'skinsuite/vite': ['../packages/theme-core/src/vite/index.ts']
};

export default aliases;
