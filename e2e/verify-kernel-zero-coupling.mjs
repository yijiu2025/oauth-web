/**
 * workspace 包「零框架耦合」守卫：钉住两个本地包不被引入 Vue/第三方运行时依赖
 *
 * === 背景（评审第 4 条的核实结论）===
 * 评审提出「skinsuite 未在 root-workspace 对齐，有双 Vue 实例风险」，据此要求加固。
 * 2026-09-28 **实测核实**后修正了这一判断：
 *   - `packages/theme-core`（skinsuite 0.1.0）：dependencies / peerDependencies **全空**，
 *     只有 devDependency `typescript`；源码 import 面**只有内部相对路径**（./mode.js 等）。
 *   - `packages/shared-device`（stable-deviceid 1.0.3）：dependencies / peerDependencies 全空，
 *     连 devDependencies 都没有；同样零外部 import。
 *   ⇒ 两包都**不 import vue**、也不声明 vue 为 peer，所以它们**不可能**成为第二个 Vue 实例的来源。
 *     评审担心的风险在**当前代码上不成立**。
 *
 * === 那这个关卡为什么还要有 ===
 * 因为"当前不成立"是**易失的**：这两个包被三个前端通过 vite alias **源码直供**（不是走 node_modules
 * 符号链接），一旦哪天有人在包里 `import { ref } from 'vue'`：
 *   - 若 vue 只是包自己的 dependency → 会出现**两份 Vue**（包内一份 + 宿主一份），
 *     `inject`/`provide`、响应式追踪、`instance` 判定全都会以诡异方式失效；
 *   - 因为是源码直供，**npm 的根本不会报重复依赖**，构建也不会警告 —— 完全静默。
 * 所以这里把"零框架耦合"从"现状"升格为"被守卫的不变量"。
 *
 * === 判据（由接口/清单派生，不手抄成员名）===
 *   1. 两包 package.json 的 `dependencies` 与 `peerDependencies` 必须为空/不存在
 *   2. 两包 `src/**` 的 import 说明符必须**全部是相对路径**（`./` 或 `../`）——
 *      这条比"禁 vue"更强：任何外部包（vue / react / lodash…）都不许进内核
 *   3. 顺带断言 `sideEffects: false` 仍在（纯函数内核的前提，影响 tree-shaking）
 *
 * 退出码：0 通过 / 1 断言失败
 *
 * === 双形态（2026-10-15）===
 * 目标包的物理位置随仓形态切换（与 `config/aliases.ts` 同一物理条件）：
 *   - monorepo 形态（上级有 packages/）→ `packages/<dir>`（源码直供对象）
 *   - standalone 形态（单仓 checkout / CI / 开源用户）→ `node_modules/<pkg>`
 *     （npm 发布面）。npm 版 skinsuite 的 files 带 src，逐文件对应；stable-deviceid
 *     的 files 只有 dist —— 对它的源码 import 面检查**降级查 dist**（tsc 产物保留
 *     源码 import 面，外部 import 不会被改写，判据等效）。
 *   第 3) 节（宿主 alias 仍指源码）仅 monorepo 形态适用；standalone 下 alias 键
 *   按设计不注册，等价保护 = 1)/2) 节已在 npm 发布面上验证零耦合。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..'); // oauth21/
const MONOREPO = join(ROOT, '..');

/** 形态判定：monorepo 源码在 → 源码直供形态；不在 → standalone（npm 版）形态。 */
const MONOREPO_FORM = existsSync(join(MONOREPO, 'packages', 'theme-core', 'src', 'index.ts'));

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

/** 目标包：目录名 → 期望的 npm 包名 */
const TARGETS = [
  { dir: 'packages/theme-core', pkg: 'skinsuite' },
  { dir: 'packages/shared-device', pkg: 'stable-deviceid' }
];

/** 按形态取包的物理根：monorepo → packages/<dir>；standalone → node_modules/<pkg> */
function pkgRoot(target) {
  return MONOREPO_FORM ? join(MONOREPO, target.dir) : join(ROOT, 'node_modules', target.pkg);
}

/** 递归收集 .ts/.js 源文件
 *  ⚠️ **排除 `__tests__/`**：测试文件用 `@jest/globals` / `node:crypto` 是正常且必要的，
 *     它们既不进 `files` 白名单（发布产物）、也不会被宿主 alias 加载，
 *     因此不构成"内核耦合框架"的风险。把测试算进来会让判据失真（实测踩过）。
 *  同理排除 `dist/`（构建产物，其 import 由 tsc 生成）—— 但 `includeDist` 为真时
 *  （standalone 形态 stable-deviceid 未发布 src、只能查 dist 的降级路径）放行。
 */
function collectSources(dir, out = [], includeDist = false) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      if (entry.name === 'dist' && !includeDist) continue;
      collectSources(p, out, includeDist);
    } else if (/\.(ts|mts|js|mjs)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/** 抓出所有静态 import / export ... from 的说明符 */
function extractSpecifiers(code) {
  const specs = [];
  const re = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) specs.push(m[1]);
  // 纯 side-effect import： import './x.js'
  const reSide = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  while ((m = reSide.exec(code)) !== null) specs.push(m[1]);
  return specs;
}

console.log(`== 1) package.json 依赖面（形态：${MONOREPO_FORM ? 'monorepo' : 'standalone npm 发布面'}）==`);
for (const t of TARGETS) {
  const pkgFile = join(pkgRoot(t), 'package.json');
  const pkgLabel = MONOREPO_FORM ? t.dir : `node_modules/${t.pkg}`;
  check(`${pkgLabel}/package.json 存在`, existsSync(pkgFile), pkgFile);
  if (!existsSync(pkgFile)) continue;

  const j = JSON.parse(readFileSync(pkgFile, 'utf8'));
  check(`包名仍为 ${t.pkg}`, j.name === t.pkg, `实际：${j.name}`);

  const deps = Object.keys(j.dependencies || {});
  const peers = Object.keys(j.peerDependencies || {});
  check(
    `${t.pkg} 无 dependencies（内核零运行时依赖）`,
    deps.length === 0,
    deps.length ? `实际：${deps.join(', ')}` : ''
  );
  check(
    `${t.pkg} 无 peerDependencies（不要求宿主提供 vue）`,
    peers.length === 0,
    peers.length ? `实际：${peers.join(', ')}` : ''
  );
  check(
    `${t.pkg} 声明 sideEffects: false（纯内核，可 tree-shake）`,
    j.sideEffects === false,
    `实际：${JSON.stringify(j.sideEffects)}`
  );

  // files 白名单不得把 __tests__ 发出去（本关卡的"源码面"判据排除了它，这里把排除的理由钉住）
  const files = j.files || [];
  check(
    `${t.pkg} files 白名单不含 __tests__（测试不进发布产物）`,
    !files.some(f => String(f).includes('__tests__')),
    `实际：${JSON.stringify(files)}`
  );
}

console.log('\n== 2) 源码 import 面（必须全是相对路径） ==');
for (const t of TARGETS) {
  const srcDir = join(pkgRoot(t), 'src');
  if (!existsSync(srcDir)) {
    if (MONOREPO_FORM) {
      check(`${t.dir}/src 存在`, false, srcDir);
      continue;
    }
    // standalone 且 npm 版未发布 src（stable-deviceid 的 files 只有 dist）：
    // 降级查 dist —— tsc 产物保留源码 import 面（外部 import 原样生成），判据等效。
    const distDir = join(pkgRoot(t), 'dist');
    check(`node_modules/${t.pkg} 有 src 或 dist 可查`, existsSync(distDir), distDir);
    if (!existsSync(distDir)) continue;
    const distFiles = collectSources(distDir, [], true);
    check(`node_modules/${t.pkg}/dist 有产物文件`, distFiles.length > 0, `找到 ${distFiles.length} 个`);
    const distOffenders = [];
    for (const f of distFiles) {
      for (const spec of extractSpecifiers(readFileSync(f, 'utf8'))) {
        if (!spec.startsWith('.')) {
          distOffenders.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} → ${spec}`);
        }
      }
    }
    check(
      `${t.pkg} dist 只 import 相对路径（零外部包，含禁 vue）`,
      distOffenders.length === 0,
      distOffenders.length ? `发现 ${distOffenders.length} 处：\n      ${distOffenders.join('\n      ')}` : ''
    );
    continue;
  }
  const files = collectSources(srcDir);
  check(
    `${MONOREPO_FORM ? t.dir : `node_modules/${t.pkg}`}/src 有源码文件`,
    files.length > 0,
    `找到 ${files.length} 个`
  );

  const offenders = [];
  for (const f of files) {
    for (const spec of extractSpecifiers(readFileSync(f, 'utf8'))) {
      // 允许：相对路径。禁止：裸包名（含 vue / @scope/x）
      if (!spec.startsWith('.')) {
        offenders.push(`${f.replace(MONOREPO, '').replace(ROOT, '').replace(/\\/g, '/')} → ${spec}`);
      }
    }
  }
  check(
    `${t.pkg} 源码只 import 相对路径（零外部包，含禁 vue）`,
    offenders.length === 0,
    offenders.length ? `发现 ${offenders.length} 处：\n      ${offenders.join('\n      ')}` : ''
  );
}

if (MONOREPO_FORM) {
  console.log('\n== 3) 宿主侧 alias 仍指源码（否则"零耦合"约束的对象就变了） ==');
  const aliasesFile = join(ROOT, 'config', 'aliases.ts');
  if (existsSync(aliasesFile)) {
    const text = readFileSync(aliasesFile, 'utf8');
    for (const { dir, pkg } of TARGETS) {
      const expect = dir.replace('packages/', '');
      check(
        `aliases.ts 里 ${pkg} 仍指向 packages/${expect}/src/index.ts`,
        new RegExp(`${pkg}['"]\\s*:\\s*path\\.resolve\\([^)]*'${expect}/src/index\\.ts'`).test(text) ||
          new RegExp(`${pkg}['"]\\s*:\\s*path\\.resolve\\([^)]*${expect}[\\\\/]src[\\\\/]index\\.ts`).test(text),
        '找不到对应 alias（源码直供链断了？）'
      );
    }
  } else {
    check('config/aliases.ts 存在', false, aliasesFile);
  }
} else {
  // standalone 形态：alias 键按设计不注册（删键回落 node_modules），"源码直供链"
  // 不存在。等价保护 = 1)/2) 节已在 npm 发布面上验证零耦合；这里只钉住
  // aliases.ts 的**条件注册逻辑**健在 —— 回 monorepo 时代码直供自动恢复，
  // 不会因为本次改动把源码直供能力弄丢。
  console.log('\n== 3) standalone：aliases.ts 条件注册逻辑健在（回 monorepo 自动恢复源码直供） ==');
  const aliasesFile = join(ROOT, 'config', 'aliases.ts');
  if (existsSync(aliasesFile)) {
    const text = readFileSync(aliasesFile, 'utf8');
    check(
      'aliases.ts 保留 LOCAL_PKG_SOURCES 源码目标表',
      text.includes('LOCAL_PKG_SOURCES'),
      '找不到 LOCAL_PKG_SOURCES'
    );
    check(
      'aliases.ts 保留 existsSync 条件注册（源码在才注册）',
      /if\s*\(existsSync\(src\)\)/.test(text),
      '找不到条件注册门'
    );
    check(
      'aliases.ts 保留注册动作（aliases[spec] = src）',
      /aliases\[spec\]\s*=\s*src/.test(text),
      '找不到注册赋值'
    );
  } else {
    check('config/aliases.ts 存在', false, aliasesFile);
  }
}

// ---------------------------------------------------------------- 汇总
const total = pass + failures.length;
console.log(`\n===== ${failures.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过 =====`);
if (failures.length) {
  console.log('失败项：');
  for (const f of failures) console.log(`  - ${f}`);
  if (MONOREPO_FORM) {
    console.log('\n提示：这两个包被三个前端「源码直供」（vite alias 指 src/index.ts，不走 node_modules），');
    console.log('      一旦包内 import vue，会静默产出**两份 Vue**，且 npm / 构建都不会报警。');
  } else {
    console.log('\n提示：standalone 形态走 node_modules 的 npm 版（dependencies 为空即装不到外部包），');
    console.log('      import 面已在发布产物（src 或 dist）上验证；回 monorepo 后恢复源码直供检查。');
  }
  process.exit(1);
}
process.exit(0);
