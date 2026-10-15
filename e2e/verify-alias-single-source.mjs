/**
 * 别名单一来源关卡：`config/aliases.ts` ↔ `tsconfig.app.json` paths ↔ vitest 实解析
 *
 * 背景：`@` / `skinsuite` / `stable-deviceid` 三个路径别名同时被三处消费：
 *   - `vite.config.ts`（构建 + dev server）
 *   - `vitest.config.ts`（单测）
 *   - `tsconfig.app.json` 的 `compilerOptions.paths`（类型检查）
 * 前两处已收敛到 `config/aliases.ts`（import 同一份）；第三处因为是静态 JSON
 * 无法 import，只能手写副本。
 *
 * 🔴 为什么必须有关卡：这类漂移**全都不报错** ——
 *   - vite/vitest 漏改 → 构建期 `Cannot find module`（还算显式）
 *   - tsconfig 漏改 → `vue-tsc -b` 可能退化成 any / 或报"找不到声明"，
 *     也可能因为路径仍存在（只是指向别处）而**完全静默**
 *   - aliases.ts 与 tsconfig 各指不同实现 → 类型检查用 A、运行用 B，最阴险
 *
 * === 双形态分流（2026-10-15）===
 * `config/aliases.ts` 对两个本地包做**存在性回落**（详见其文件头「双形态」）：
 *   - **monorepo 形态**（上级有 packages/）：alias 指源码 src/index.ts，本关跑
 *     全部历史断言（源码直供 / 不指 node_modules / 三处语义同源）。
 *   - **standalone 形态**（单仓 checkout / CI / 开源用户）：两个 alias 键不注册，
 *     解析走 node_modules 的 npm 版。此时：
 *       · alias 表应恰为 1 个键（`@`）；
 *       · tsconfig 仍**声明**两个 pkg 键（静态描述不随形态裁剪，否则丢
 *         monorepo 的类型直供），TS 会回落 node_modules —— 因此"tsconfig 声明了
 *         该键"仍要断言，"与 aliases.ts 解析到同一文件"按设计跳过；
 *       · 探针改用 node 原生 `import.meta.resolve` 断言裸说明符命中
 *         `node_modules/<pkg>/dist/` 且文件真实存在（刻意不用 vite 探针：dev
 *         server 的 optimizeDeps 会把裸包预热成 `.vite/deps/` 缓存产物，
 *         resolveId 命中的是预构建文件，验证不到"命中 npm 版"的语义）。
 *
 * 退出码：0 全绿 / 1 有失败
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..'); // oauth21/

/** monorepo 根（oauth21 的上一级，packages/ 的所在处）。 */
const MONOREPO_ROOT = resolve(ROOT, '..');

/** 源码直供目标（两个本地包的 monorepo 入口）。 */
const LOCAL_PKG_SOURCE = {
  skinsuite: resolve(MONOREPO_ROOT, 'packages/theme-core/src/index.ts'),
  'stable-deviceid': resolve(MONOREPO_ROOT, 'packages/shared-device/src/index.ts')
};

/**
 * 形态判定：monorepo 源码在 → 源码直供形态；不在 → standalone（npm 版回落）形态。
 * 与 `config/aliases.ts` 的注册判定保持同一物理条件。
 */
const MONOREPO_FORM = existsSync(LOCAL_PKG_SOURCE.skinsuite);

let pass = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failures.push(label);
    console.log(`  \u2717 ${label}${detail ? `  \u2192 ${detail}` : ''}`);
  }
}

/**
 * 读 JSONC（tsconfig 允许注释与尾逗号）。
 * ⚠️ 刻意**不**用「正则去注释」的土办法：tsconfig 里 `"@/*"` 这种键名本身含 `/*`，
 *    任何朴素的块注释正则会从它开始吃掉后面一大段（实测踩过）。
 *    这里用 TypeScript 自带的 `parseConfigFileTextToJson`，它就是 tsc 读 tsconfig 的实现。
 */
async function readJsonc(file) {
  const ts = await import('typescript');
  const text = readFileSync(file, 'utf8');
  const parsed = ts.parseConfigFileTextToJson(file, text);
  if (parsed.error) {
    throw new Error(
      `JSONC 解析失败：${ts.flattenDiagnosticMessageText(parsed.error.messageText, ' ')}`
    );
  }
  return parsed.config;
}

// ---------------------------------------------------------------- 1) 加载 aliases.ts
console.log(`== 1) config/aliases.ts（形态：${MONOREPO_FORM ? 'monorepo 源码直供' : 'standalone npm 版回落'}）==`);
const aliasesFile = join(ROOT, 'config', 'aliases.ts');
check('config/aliases.ts 存在', existsSync(aliasesFile), aliasesFile);

let aliases = {};
let tsconfigPathsExport = {};
try {
  const mod = await import(pathToFileURL(aliasesFile).href);
  aliases = mod.aliases || {};
  tsconfigPathsExport = mod.tsconfigPaths || {};
} catch (e) {
  check('config/aliases.ts 可加载', false, e.message);
}

const aliasKeys = Object.keys(aliases).sort();
if (MONOREPO_FORM) {
  check(
    '导出 aliases 含 3 个键（@ / skinsuite / stable-deviceid）',
    aliasKeys.length === 3 && aliasKeys.join(',') === '@,skinsuite,stable-deviceid',
    `实际：${aliasKeys.join(', ') || '(空)'}`
  );
} else {
  // standalone：两个本地包按设计不注册，解析回落 node_modules
  check(
    'standalone 形态 aliases 恰 1 个键（@，本地包回落 node_modules）',
    aliasKeys.length === 1 && aliasKeys[0] === '@',
    `实际：${aliasKeys.join(', ') || '(空)'}`
  );
}

// 解析出的绝对路径必须真实存在（否则构建期就是 Cannot find module）
for (const [k, v] of Object.entries(aliases)) {
  check(`alias ${JSON.stringify(k)} 指向的文件存在`, existsSync(v), v);
}

// 两个本地包必须指向源码（src/index.ts），不是 node_modules dist
// —— 仅 monorepo 形态适用；standalone 形态由第 3) 段探针验证 node_modules 回落
if (MONOREPO_FORM) {
  for (const pkg of ['skinsuite', 'stable-deviceid']) {
    const target = aliases[pkg] || '';
    check(
      `${pkg} 指向 packages/*/src/index.ts（源码直供）`,
      /packages\/(theme-core|shared-device)\/src\/index\.ts$/.test(target.replace(/\\/g, '/')),
      `实际：${target}`
    );
    check(
      `${pkg} 不指向 node_modules`,
      !target.includes('node_modules'),
      `实际：${target}`
    );
  }
} else {
  for (const pkg of ['skinsuite', 'stable-deviceid']) {
    check(
      `${pkg} 未注册 alias（standalone 设计如此，走 node_modules）`,
      !Object.prototype.hasOwnProperty.call(aliases, pkg),
      `实际已注册：${aliases[pkg]}`
    );
  }
}

// ---------------------------------------------------------------- 2) 与 tsconfig.app.json 比对
console.log('\n== 2) tsconfig.app.json paths 一致性 ==');
const tsconfigFile = join(ROOT, 'tsconfig.app.json');
check('tsconfig.app.json 存在', existsSync(tsconfigFile), tsconfigFile);

const tsconfig = await readJsonc(tsconfigFile);
const tsPaths = tsconfig.compilerOptions?.paths || {};

/**
 * 把 tsconfig 的相对 path（相对 tsconfig 所在目录 oauth21/）解析成绝对路径。
 * @ 那条写作 `@/*` → `./src/*`，比对时把 `/*` 去掉再比。
 */
function resolveTsPath(p) {
  return resolve(ROOT, p).replace(/\\/g, '/');
}

// @ → src（两种形态都成立：src/ 是本仓自有目录）
const tsAt = (tsPaths['@/*'] || [])[0];
check(
  'tsconfig `@/*` 与 aliases.ts 的 `@` 同源（都指 oauth21/src）',
  tsAt && resolveTsPath(tsAt).replace(/\/\*$/, '') === aliases['@'].replace(/\\/g, '/'),
  `tsconfig=${tsAt ? resolveTsPath(tsAt) : '(缺)'}  aliases=${aliases['@']}`
);

for (const pkg of ['skinsuite', 'stable-deviceid']) {
  const tsVal = (tsPaths[pkg] || [])[0];
  check(
    `tsconfig 声明了 "${pkg}"`,
    Boolean(tsVal),
    tsVal ? '' : '缺少该键'
  );
  // "解析到同一文件"仅 monorepo 形态可比：standalone 下 tsconfig 指向的
  // ../packages/... 不存在，TS 回落 node_modules（paths 未命中不报错），
  // 这是 aliases.ts 文件头记录的设计行为。
  if (tsVal && MONOREPO_FORM) {
    check(
      `tsconfig "${pkg}" 与 aliases.ts 解析到同一文件`,
      resolveTsPath(tsVal) === aliases[pkg].replace(/\\/g, '/'),
      `tsconfig=${resolveTsPath(tsVal)}  aliases=${aliases[pkg]}`
    );
  }
}

// 反向：tsconfig 里的别名键，aliases.ts 里应当有非通配的对应项
// —— standalone 形态豁免两个本地包（按设计不注册，回落 node_modules）
const tsKeys = Object.keys(tsPaths);
for (const k of tsKeys) {
  const base = k.replace(/\/\*$/, '');
  if (base === '@') continue; // @/* 已在上面单比
  const inAliases =
    Object.prototype.hasOwnProperty.call(aliases, base) ||
    Object.prototype.hasOwnProperty.call(aliases, k);
  const exemptStandalone = !MONOREPO_FORM && (base === 'skinsuite' || base === 'stable-deviceid');
  check(
    `tsconfig 键 "${k}" 在 aliases.ts 里有对应项`,
    inAliases || exemptStandalone,
    `aliases 里有：${aliasKeys.join(', ')}${exemptStandalone ? '（standalone 豁免）' : ''}`
  );
}

// 自描述：aliases.ts 导出的 tsconfigPaths 应与真实 tsconfig 一致（防两处又抄一遍）
if (Object.keys(tsconfigPathsExport).length) {
  const exported = JSON.stringify(tsconfigPathsExport, Object.keys(tsconfigPathsExport).sort());
  const actual = JSON.stringify(
    Object.fromEntries(Object.entries(tsPaths).sort(([a], [b]) => a.localeCompare(b)))
  );
  check(
    'aliases.ts 导出的 tsconfigPaths 与真实 tsconfig.app.json 一致',
    exported === actual,
    exported === actual ? '' : `导出=${exported}\n    实际=${actual}`
  );
}

// ---------------------------------------------------------------- 3) 真解析探针
console.log('\n== 3) 解析探针 ==');
if (MONOREPO_FORM) {
  // monorepo 形态：vite alias 精确匹配 → 必须命中 packages/ 源码
  let server;
  try {
    server = await createServer({
      root: ROOT,
      configFile: join(ROOT, 'vitest.config.ts'),
      server: { middlewareMode: true },
      logLevel: 'silent'
    });

    for (const [spec, expectSuffix] of [
      ['skinsuite', 'packages/theme-core/src/index.ts'],
      ['stable-deviceid', 'packages/shared-device/src/index.ts']
    ]) {
      try {
        const resolved = await server.pluginContainer.resolveId(spec, join(ROOT, 'src', '__probe__.ts'));
        const id = (resolved && resolved.id) || '';
        const norm = id.replace(/\\/g, '/');
        check(
          `vite 运行期解析 ${JSON.stringify(spec)} → ${expectSuffix}`,
          norm.endsWith(expectSuffix),
          `实际：${id || '(未解析)'}`
        );
      } catch (e) {
        check(`vite 运行期解析 ${JSON.stringify(spec)}`, false, e.message);
      }
    }
  } catch (e) {
    check('起 vite 解析探针', false, e.message);
  } finally {
    if (server) await server.close();
  }
} else {
  // standalone 形态：alias 键已删，要验证的是"裸说明符经 node 标准解析命中
  // node_modules 的 npm 版"这条回落机制本身。刻意不用 vite 探针 —— dev server 的
  // optimizeDeps 会把裸包预热成 node_modules/.vite/deps/<pkg>.js 缓存产物，
  // resolveId 命中的是预构建文件而非包入口，验证不到"命中 npm 版"的语义。
  const parentUrl = pathToFileURL(join(ROOT, 'src', '__probe__.ts')).href;
  for (const [spec, expectSuffix] of [
    ['skinsuite', 'node_modules/skinsuite/dist/index.js'],
    ['stable-deviceid', 'node_modules/stable-deviceid/dist/index.js']
  ]) {
    try {
      // await 兼容同步 string / Promise 两种返回（node 版本差异）
      const resolved = await import.meta.resolve(spec, parentUrl);
      const id = resolved ? fileURLToPath(resolved) : '';
      const norm = id.replace(/\\/g, '/');
      check(
        `node 解析 ${JSON.stringify(spec)} → ${expectSuffix}`,
        norm.endsWith(expectSuffix) && existsSync(id),
        `实际：${id || '(未解析)'}`
      );
    } catch (e) {
      check(`node 解析 ${JSON.stringify(spec)}`, false, e.message);
    }
  }
}

// ---------------------------------------------------------------- 汇总
const total = pass + failures.length;
console.log(`\n===== ${failures.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过 =====`);
if (failures.length) {
  console.log('失败项：');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
