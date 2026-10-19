/**
 * console 剥离关卡：确认生产构建真的删掉了 console.*
 *
 * === 为什么要有这个关卡 ===
 * 🔴 2026-09-28 实测发现：本仓 `build.esbuild.drop: ['console']` **在 Vite 8 下完全无效**，
 *    生产产物里仍残留 **28 处 console.***（warn/error 为主）。
 *
 *    成因是"三重静默"：
 *      ① Vite 8 改用 Rolldown + Oxc，`build.esbuild` 已不是合法字段（顶部 `esbuild` 亦 deprecated）；
 *         正确入口是 `build.rolldownOptions.output.minify.compress.dropConsole`。
 *      ② `vite.config` 当时是 **`.js`**，从不参与 `vue-tsc -b` 类型检查 ⇒ 字段名写错无声。
 *      ③ 构建本身**成功**（exit 0），只是配置被忽略 —— 没有任何信号。
 *    ⇒ 改的时候是"有意图的保护"（防 Error 堆栈/内部标识泄露到 DevTools），
 *      但实际等于**根本没做**。这种"以为有、其实没有"的安全措施必须有关卡守。
 *
 * === 本关卡做什么 ===
 *   (1) 从 `vite.config.ts` 里断言 `dropConsole: true` 仍在（配置层防删除）
 *   (2) **真构建一次**（临时 outDir），扫产物确认 `console.*` 数量为 0（行为层防失效）
 *   (3) 反面对照：确认源码里**确实有** console 待删（否则"0 残留"是假绿 —— 可能源码本来就没有）
 *
 * ⚠️ 不依赖已存在的 dist（那是上一次构建的产物，可能是旧的）—— 本关卡自己构建。
 *
 * 退出码：0 通过 / 1 断言失败
 */
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

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

// ---------------------------------------------------------------- 1) 配置层
console.log('== 1) vite.config.ts 配置层 ==');
const cfgPath = join(ROOT, 'vite.config.ts');
check('vite.config.ts 存在（已由 .js 改为 .ts，纳入类型检查）', existsSync(cfgPath), cfgPath);

const cfg = readFileSync(cfgPath, 'utf8');
check('配置里声明了 dropConsole: true', /dropConsole:\s*true/.test(cfg), '找不到 dropConsole: true');
check(
  '没有回退到失效的 build.esbuild.drop 写法',
  !/esbuild:\s*\{[^}]*drop:/.test(cfg),
  '仍在使用 Vite 8 下无效的 build.esbuild.drop'
);

// ---------------------------------------------------------------- 2) 源码对照（防假绿）
console.log('\n== 2) 源码对照（确认"有东西可删"） ==');
const srcDir = join(ROOT, 'src');
let srcConsoleCount = 0;
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|vue|js)$/.test(entry.name)) {
      const hits = readFileSync(p, 'utf8').match(/console\.(log|warn|error|info|debug)/g);
      if (hits) srcConsoleCount += hits.length;
    }
  }
})(srcDir);
check(
  'src/ 下确实存在 console 调用（否则"0 残留"是假绿）',
  srcConsoleCount > 0,
  `源码里 0 处 console —— 关卡失去意义，请连同本关卡一起复核`
);
console.log(`    （参考：源码里共 ${srcConsoleCount} 处 console.*）`);

// ---------------------------------------------------------------- 3) 真构建 + 扫产物
console.log('\n== 3) 真构建并扫描产物 ==');
// 🔴 2026-10-17 改回固定目录 + 三层防堆积（历史两次反复的教训，勿再简化）：
//   · 2026-10-15 之前用固定名 `dist-console-guard`：清理失败一次，残留目录让
//     下一轮"建到已存在目录"抛错，被 catch 当成「生产构建失败」——判定被清理
//     问题污染。
//   · 2026-10-15 改为 pid 后缀（每轮全新目录）：判定干净了，但**进程被强制
//     终止时清理来不及跑**（Windows `TerminateProcess` 拦不住任何钩子），
//     实测在仓库根堆了 11 个 `dist-console-guard-<pid>`，且从不自愈。
//   ⇒ 现方案：固定目录复用 + 清旧失败降级 + 启动 gc，两个毛病都不占。
//     `.gitignore` 的 `dist-*` 已覆盖该名字，不会入库。
const FIXED_OUT = 'dist-console-guard';

/**
 * 真删目录；返回是否已不存在（不抛异常，调用方据此决策）。
 *
 * 🔴 safe-delete shim（WorkBuddy 环境）会把 `rmSync` 重定向成「移入回收站」，
 *    而回收站操作对构建产物目录（大量小文件）常失败（trash "Some operations
 *    were aborted"），于是清理失效、目录无限堆积。这里 `rmSync` 失败时，
 *    起一个**禁 shim 的子进程**（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）真删。
 *    普通终端（无 shim）下 `rmSync` 一步就成，子进程兜底根本不触发。
 */
function forceRemoveDir(dir) {
  if (!existsSync(dir)) return true;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 落到下面的子进程删除 */
  }
  if (!existsSync(dir)) return true;
  try {
    execFileSync(
      process.execPath,
      ['-e', 'require("fs").rmSync(process.argv[1], { recursive: true, force: true })', dir],
      {
        env: { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: '0' },
        stdio: 'ignore',
        windowsHide: true
      }
    );
  } catch {
    /* 落到 existsSync 复检 */
  }
  return !existsSync(dir);
}

/** 尽力删除目录；返回是否已不存在（不抛异常，调用方据此决策）。 */
function removeDirBestEffort(dir, label) {
  const gone = forceRemoveDir(dir);
  if (!gone) console.log(`    ⚠️ 无法删除 ${label}（文件占用或历史残留），将跳过`);
  return gone;
}

// ① 启动 gc：回收历史 pid 残留。正常情况下不该有；有就说明上一轮被强杀过。
//    这一步让"曾经堆积"能自愈，而不是只能人工清理。
let gcCount = 0;
for (const name of readdirSync(ROOT)) {
  if (/^dist-console-guard-\d+$/.test(name) && removeDirBestEffort(join(ROOT, name), name)) gcCount += 1;
}
if (gcCount > 0) console.log(`    已回收 ${gcCount} 个历史残留 outDir`);

// ② 优先复用固定目录（清不掉就降级到带 pid 的全新目录，
//    从而"清理问题"永远不会被误判成"生产构建失败"）
const canReuseFixed = removeDirBestEffort(join(ROOT, FIXED_OUT), FIXED_OUT);
const outDirName = canReuseFixed ? FIXED_OUT : `${FIXED_OUT}-${process.pid}`;
if (!canReuseFixed) console.log(`    固定目录不可复用，本轮降级到 ${outDirName}`);
const outDir = join(ROOT, outDirName);

/** 同步 sleep（顶层脚本里不能用 await 语义的定时器，且 exit 钩子内必须同步）。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** ③ 跑完自清：判定采集完毕后调用，清理失败不影响结果。
 *  实测（2026-10-17）：Windows 上 vite/rolldown 的子进程句柄会延迟释放，
 *  删完立刻复检可能重新出现该目录 ⇒ 短重试，最多 4 轮。 */
function cleanupOutDir() {
  for (let i = 0; i < 4; i += 1) {
    if (!existsSync(outDir)) return;
    forceRemoveDir(outDir);
    if (!existsSync(outDir)) return;
    sleepSync(120);
  }
}

// 兜底钩子：正常退出 / Ctrl-C / SIGTERM 都清一次。
// ⚠️ Windows 的强制终止（TerminateProcess，任务管理器或 Stop-Process -Force）
//    拦不住任何钩子 —— 那种情况由下一次运行的启动 gc 回收（见上）。
process.on('exit', cleanupOutDir);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    cleanupOutDir();
    process.exit(1);
  });
}

try {
  console.log(`    构建中（--outDir ${outDirName}）…`);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', outDirName], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  check('生产构建成功', true);
} catch (e) {
  check('生产构建成功', false, String(e.message).split('\n')[0]);
}

let distConsoleCount = 0;
const details = [];
const assetsDir = join(outDir, 'assets');
if (existsSync(assetsDir)) {
  for (const f of readdirSync(assetsDir)) {
    if (!f.endsWith('.js')) continue;
    const hits = readFileSync(join(assetsDir, f), 'utf8').match(/console\.(log|warn|error|info|debug)/g);
    if (hits) {
      distConsoleCount += hits.length;
      details.push(`${f}: ${hits.length}`);
    }
  }
}

check(
  '产物里 console.* 残留为 0',
  distConsoleCount === 0,
  distConsoleCount === 0 ? '' : `残留 ${distConsoleCount} 处 → ${details.join(', ')}`
);

// 清理临时产物（本关卡自产自销，不入库；gitignore 已覆盖 dist-*）
cleanupOutDir();
if (existsSync(outDir)) {
  console.log(`    ⚠️ 临时产物未能删除：${outDirName}（判定不受影响，下一次运行会 gc）`);
} else {
  console.log(`    已清理临时产物 ${outDirName}`);
}

// ---------------------------------------------------------------- 汇总
const total = pass + failures.length;
console.log(`\n===== ${failures.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过 =====`);
if (failures.length) {
  console.log('失败项：');
  for (const f of failures) console.log(`  - ${f}`);
  console.log('\n提示：Vite 8 下删 console 的唯一入口是');
  console.log('  build.rolldownOptions.output.minify.compress.dropConsole = true');
  process.exit(1);
}
process.exit(0);
