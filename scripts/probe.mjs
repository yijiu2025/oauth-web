/**
 * 多实例探针环境一键起停 —— 把「四串手抄命令」收成一条
 *
 * === 为什么要有这个脚本 ===
 * 全量 verify-all 要 5174 / 5175 / 5177 / 5197 四个 dev 实例同时在线，每个还必须
 * 独占 cacheDir（共享 node_modules/.vite 会互判依赖过期 → 504 → 白屏 → DOM 断言
 * 假红，实测共享 19/22 vs 隔离 22/22）。此前这套起法是 CONTRIBUTING 里四段手抄
 * 命令 + 手抄探针配置，新人第一道坎就是它；本脚本把「生成探针配置 → 串行起实例
 * → 等每个 HTTP 200 → 记录 pid」一次做完。
 *
 * === 用法 ===
 *   npm run probe:up       # 起四个 dev 实例（已在运行的跳过；detached，命令返回后仍存活）
 *   npm run probe:down     # 按 pids.json 全杀（幂等）
 *   npm run probe:status   # 探活 + pid 存活表（退出码：0 = 四个 dev 端口全就绪）
 *
 * 端口 / 环境约定（与 e2e/verify-all.mjs 头部、VERIFY.md §二一致）：
 *   5174 = dev 默认实例
 *   5175 = link 模式实例（VITE_PASSWORD_RESET_MODE=link）
 *   5177 = compact 版式实例（VITE_REGISTER_VIEW=compact）
 *   5197 = color-peer 专用
 * 生产预览 5189 不走这里（要先构建 dist-nopwa，且陈旧判定要人盯着，见 VERIFY.md §八）。
 *
 * === 为什么不起 5189 ===
 * prod 组的第一判据是「产物不旧于源码」（env-guard assertDist），自动起 preview 会
 * 把「该重建了」这个信号藏起来 —— 那条路刻意留给人：先构建，再 preview。
 *
 * @author yijiu2025
 * @since 2026-10-21
 */
import { spawnSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPort } from '../e2e/lib/env-guard.mjs';
import { classifyPort } from './doctor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** oauth21 工程根（scripts/ 的上一级） */
const OA = dirname(HERE);
const PROBE_DIR = join(OA, '.tmp-probe'); // gitignore 已覆盖
const PROBE_CONFIG = join(PROBE_DIR, 'vite.probe.config.mjs');
const PIDS_FILE = join(PROBE_DIR, 'pids.json');
const LOG = (port) => join(PROBE_DIR, `vite-${port}.log`);
const VITE_BIN = join(OA, 'node_modules', 'vite', 'bin', 'vite.js');

/** 单个实例就绪等待预算：冷 cacheDir 要重跑依赖预打包，给足 2 分钟 */
const READY_BUDGET_MS = 120_000;

const INSTANCES = [
  { port: 5174, label: 'dev 默认实例', env: {} },
  { port: 5175, label: 'link 模式实例', env: { VITE_PASSWORD_RESET_MODE: 'link' } },
  { port: 5177, label: 'compact 版式实例', env: { VITE_REGISTER_VIEW: 'compact' } },
  { port: 5197, label: 'color-peer 专用', env: {} }
];

/**
 * 探针配置模板（与 CONTRIBUTING §「本地多实例验收」同源，那里是手抄版）。
 *
 * 🔴 vite.config.ts 是**函数式**默认导出：`{ ...base }` 展开函数得到空对象，
 *    plugins / alias / proxy 静默全丢、dev server 裸奔。必须把 ConfigEnv 透传进
 *    函数再展开（对象式导出也兼容）。
 */
const PROBE_CONFIG_TEMPLATE = `// 本文件由 scripts/probe.mjs 生成（手改会在下次 probe:up 被覆盖）
import base from '../vite.config.ts';

export default (env) => ({
  ...(typeof base === 'function' ? base(env) : base),
  cacheDir: process.env.PROBE_CACHE_DIR || 'node_modules/.vite'
});
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------------------
 * 小工具
 * ------------------------------------------------------------------------- */

function logTail(port, lines = 5) {
  try {
    return readFileSync(LOG(port), 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-lines)
      .join('\n');
  } catch {
    return '（日志读不到）';
  }
}

/** TCP 连通判定（区分「端口被占且非 HTTP」与「空闲」；HTTP 就绪时不必跑） */
function tcpOpen(port) {
  return new Promise((done) => {
    const sock = createConnection({ host: '127.0.0.1', port });
    const finish = (ok) => {
      sock.destroy();
      done(ok);
    };
    sock.setTimeout(800);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
  });
}

async function portState(port) {
  try {
    await assertPort(`http://127.0.0.1:${port}`, { timeoutMs: 1500 });
    return classifyPort({ httpOk: true, tcpOk: true });
  } catch {
    return classifyPort({ httpOk: false, tcpOk: await tcpOpen(port) });
  }
}

function readPids() {
  try {
    const arr = JSON.parse(readFileSync(PIDS_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writePids(entries) {
  writeFileSync(PIDS_FILE, `${JSON.stringify(entries, null, 2)}\n`);
}

/* ---------------------------------------------------------------------------
 * up：生成探针配置 → 串行起实例 → 等就绪 → 记 pid
 * ------------------------------------------------------------------------- */

async function startOne(inst) {
  const url = `http://127.0.0.1:${inst.port}`;
  const state = await portState(inst.port);
  if (state === 'up') {
    console.log(`  ⏭️  ${inst.port} ${inst.label}：已在运行，跳过启动`);
    return { port: inst.port, pid: null, skipped: true };
  }
  if (state === 'busy') {
    console.log(`  ✗ ${inst.port} ${inst.label}：端口被占且不是 HTTP 服务 —— 先腾地方（被占时 vite 只会 EADDRINUSE）`);
    return { port: inst.port, failed: true };
  }

  const logFd = openSync(LOG(inst.port), 'w');
  const child = spawn(
    process.execPath,
    [VITE_BIN, '--config', '.tmp-probe/vite.probe.config.mjs', '--port', String(inst.port), '--strictPort'],
    {
      cwd: OA,
      // 每实例独占 cacheDir —— 共享会互判过期（504 白屏，见文件头）
      env: { ...process.env, PROBE_CACHE_DIR: `node_modules/.vite-p${inst.port}`, ...inst.env },
      stdio: ['ignore', logFd, logFd],
      detached: true // 命令返回后继续存活（2026-10-21 实测：父进程退出不影响 detached 子进程）
    }
  );
  closeSync(logFd);
  child.unref();

  const earlyExit = new Promise((res) => {
    child.on('exit', (code) => res({ earlyExit: true, code }));
  });
  const waitReady = (async () => {
    const started = Date.now();
    while (Date.now() - started < READY_BUDGET_MS) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      try {
        await assertPort(url, { timeoutMs: 2000 });
        return { ready: true };
      } catch {
        await sleep(1000);
      }
    }
    return { ready: false };
  })();

  const r = await Promise.race([earlyExit, waitReady]);
  if (r.ready) {
    console.log(`  ✓ ${inst.port} ${inst.label}：就绪（pid ${child.pid}，日志 .tmp-probe/vite-${inst.port}.log）`);
    return { port: inst.port, pid: child.pid };
  }
  if (r.earlyExit) {
    console.log(`  ✗ ${inst.port} ${inst.label}：vite 提前退出（exit ${r.code}）`);
  } else {
    console.log(`  ✗ ${inst.port} ${inst.label}：${READY_BUDGET_MS / 1000}s 内没就绪`);
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      /* 已经没了 */
    }
  }
  console.log(`    日志尾部：\n${logTail(inst.port)}`);
  return { port: inst.port, failed: true };
}

async function up() {
  if (!existsSync(VITE_BIN)) {
    console.error(`✗ 找不到 ${VITE_BIN} —— 先 npm install`);
    process.exit(1);
  }
  // .tmp-probe/ 是 gitignore 的本地目录：全新克隆下不存在，写配置前先建
  //（漏了这一步，新人第一次 probe:up 就是 ENOENT —— 与本脚本的存在目的相悖）
  mkdirSync(PROBE_DIR, { recursive: true });
  // 探针配置每次重新生成：与模板同源，避免手改版悄悄漂移
  writeFileSync(PROBE_CONFIG, PROBE_CONFIG_TEMPLATE);

  console.log('🚀 起 dev 探针实例（串行：前一个就绪再起下一个，冷缓存下共用 .vite 会互相废掉）');
  const entries = [];
  let failed = 0;
  for (const inst of INSTANCES) {
    const r = await startOne(inst);
    if (r.failed) failed++;
    else if (!r.skipped) entries.push({ port: r.port, pid: r.pid, label: inst.label, env: inst.env });
    else entries.push({ port: r.port, pid: null, label: inst.label, skipped: true, env: inst.env });
  }
  writePids(entries);

  if (failed > 0) {
    console.log(`\n${failed} 个实例没起来（见上）`);
    process.exit(1);
  }
  console.log('\n起齐了。下一步：node e2e/verify-all.mjs（跳过生产组加 --skip-prod）');
  process.exit(0);
}

/* ---------------------------------------------------------------------------
 * down：按 pids.json 杀（幂等；win32 走 taskkill /T 连进程树）
 * ------------------------------------------------------------------------- */

function killPid(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* 已经没了 */
    }
  }
}

function down() {
  const entries = readPids().filter((e) => typeof e.pid === 'number');
  if (entries.length === 0) {
    console.log('没有记录的探针实例（pids.json 空或不存在）');
    writePids([]);
    process.exit(0);
  }
  for (const e of entries) {
    killPid(e.pid);
    console.log(`  ✓ 杀 ${e.port}（pid ${e.pid}）`);
  }
  // 不删文件只写空：rmSync 会被 safe-delete shim 拦成「静默失效」（脚本清理的既踩坑），
  // 而空数组对 up/status 都是安全的输入
  writePids([]);
  console.log('探针实例已清（npm run probe:status 复核）');
  process.exit(0);
}

/* ---------------------------------------------------------------------------
 * status：探活 + pid 存活（退出码 0 = 四个 dev 端口全就绪）
 * ------------------------------------------------------------------------- */

async function status() {
  const byPort = new Map(readPids().map((e) => [e.port, e]));
  console.log('📡 探针实例状态');
  let downCount = 0;
  for (const inst of INSTANCES) {
    const state = await portState(inst.port);
    const rec = byPort.get(inst.port);
    let pidNote = '';
    if (rec?.pid) {
      let alive = true;
      try {
        process.kill(rec.pid, 0);
      } catch {
        alive = false;
      }
      pidNote = alive ? `pid ${rec.pid} 存活` : `pid ${rec.pid} 已死（端口可能是别的进程）`;
    } else if (state === 'up') {
      pidNote = '外部进程（非 probe:up 记录的）';
    }
    if (state === 'up') {
      console.log(`  ✓ ${inst.port} ${inst.label}：就绪${pidNote ? `（${pidNote}）` : ''}`);
    } else {
      downCount++;
      const why = state === 'busy' ? '端口被占且非 HTTP' : '未就绪';
      console.log(`  ✗ ${inst.port} ${inst.label}：${why}${pidNote ? `（${pidNote}）` : ''}`);
    }
  }
  process.exit(downCount > 0 ? 1 : 0);
}

/* ---------------------------------------------------------------------------
 * 入口
 * ------------------------------------------------------------------------- */

const cmd = process.argv[2];
if (cmd === 'up') await up();
else if (cmd === 'down') down();
else if (cmd === 'status') await status();
else {
  console.log('用法：node scripts/probe.mjs up|down|status（或 npm run probe:up / probe:down / probe:status）');
  process.exit(2);
}
