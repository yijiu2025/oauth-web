/**
 * 环境预检（doctor）—— 跑验证 / 开发前的「预检门诊」
 *
 * === 为什么要有这个脚本 ===
 * 2026-10-21 一天的 Debug 成本几乎全花在「环境假设静默不成立」上：cwd 假设、
 * 多实例共用 vite 缓存导致 504 白屏、端口探活超时太短误判未就绪。这些假设
 * 每一条都已写进 VERIFY.md / CONTRIBUTING，但要人主动读、主动对照 —— 本脚本
 * 把它们收成**一条命令**，跑验证前先过门诊，假设不成立当场说清楚缺什么、补什么。
 *
 * 与关卡内的 env-guard 分工：
 *   · env-guard（e2e/lib/）= 关卡**开跑时**的自检，失败 → exit 2（红）；
 *   · doctor（本脚本）= 人**动手前**的预检，失败 → exit 1，但定位是「环境没准备好」
 *     而不是「代码红了」——结论给人看，动作是「先补环境」。
 *
 * === 检查什么 ===
 *   1. 运行时版本（node / npm vs package.json engines）
 *   2. 依赖已安装（node_modules 在否）+ skinsuite 双形态判定（与 config/aliases.ts
 *      同一套物理判据：monorepo 源码直供 / 独立仓 node_modules 源码直供 / 都没装）
 *   3. env 文件齐否（.env 不入库，另三个入库）
 *   4. 端口状态（HTTP 200 = 就绪；TCP 通但非 HTTP = 被占；都没 = 空闲）
 *   5. vite 预打包缓存健康度（只有 deps_temp_* 没有 deps/ = 504 白屏已知成因）
 *   6. git 状态（分支 / 未提交数 / 与上游差 / tag 基线可取否）
 *   7. 工具链附注（gh CLI 在否、safe-delete shim 状态）—— 只提示，不影响结论
 *
 * === 用法 ===
 *   npm run doctor          # 全量预检（退出码：0 = 无 FAIL；1 = 有 FAIL）
 *
 * @author yijiu2025
 * @since 2026-10-21
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPort } from '../e2e/lib/env-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** oauth21 工程根（scripts/ 的上一级） */
const OA = dirname(HERE);
/** monorepo 根（packages/ 的所在处）—— 与 config/aliases.ts 的 MONOREPO_ROOT 同源 */
const MONOREPO_ROOT = dirname(OA);

/* ---------------------------------------------------------------------------
 * 纯函数（判定逻辑，全部可单测 —— 见 doctor.test.mjs）
 * ------------------------------------------------------------------------- */

/**
 * 版本串 → 数字三元组（'v22.22.2' / '22.22' / '22' 都容；非法 → null）
 * @param {string|null|undefined} v
 * @returns {[number, number, number]|null}
 */
export function parseVersion(v) {
  if (typeof v !== 'string') return null;
  const m = v.replace(/^v/, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * range 判定（ engines 用到的都支持：'>=N' / '^N.M.P' / '~N.M.P' / 精确 'N.M.P' ）
 * 判不了的范围（含 || / < / x-range 等）返回 false —— 宁可误报不漏报。
 * @param {string} version 实际版本
 * @param {string} range package.json engines 里的范围
 */
export function satisfies(version, range) {
  const v = parseVersion(version);
  const r = parseVersion(range.replace(/^[><=~^\s]+/, ''));
  if (!v || !r) return false;
  const c = cmp(v, r);
  if (range.startsWith('>=')) return c >= 0;
  if (range.startsWith('^')) return c >= 0 && v[0] === r[0];
  if (range.startsWith('~')) return c >= 0 && v[0] === r[0] && v[1] === r[1];
  return c === 0;
}

/**
 * 端口状态分类（注入探活结果，不碰网络 —— 单测直接喂真假值）
 * @param {{ httpOk: boolean, tcpOk: boolean }} probe
 * @returns {'up'|'busy'|'free'} up=HTTP 就绪 / busy=TCP 通但非 HTTP（被别的东西占）/ free=没听
 */
export function classifyPort({ httpOk, tcpOk }) {
  if (httpOk) return 'up';
  if (tcpOk) return 'busy';
  return 'free';
}

/**
 * vite 预打包缓存健康度分类
 * @param {string[]|null} entries node_modules/.vite 的条目（目录不存在 → null）
 * @returns {'missing'|'ok'|'temp-only'|'empty'}
 *   missing   还没预打包过（首次 dev 会建，正常）
 *   ok        deps/ 在，正常
 *   temp-only 只有 deps_temp_* 没有 deps/ —— 预打包从未成功提交，
 *             Windows 多进程抢原子重命名的已知残留，症状是 504 白屏
 *   empty     目录在但两者都没（异常但无害，下次构建会写）
 */
export function classifyViteCache(entries) {
  if (entries === null) return 'missing';
  const hasDeps = entries.some((e) => e === 'deps');
  if (hasDeps) return 'ok';
  const hasTemp = entries.some((e) => e.startsWith('deps_temp'));
  return hasTemp ? 'temp-only' : 'empty';
}

/**
 * skinsuite 双形态判定 —— 与 config/aliases.ts 的条件注册是**同一套物理判据**
 * （existsSync 探路径，探不到就不注册），这里只读不改，形态说错会把人带偏。
 *
 * @param {(p: string) => boolean} exists 路径存在性（单测注入假 fs）
 * @param {{ monorepoRoot: string, installedRoots: string[] }} roots
 * @returns {{ form: 'monorepo'|'installed'|'broken', monoCore: boolean, monoDevice: boolean, installed: boolean, warnings: string[] }}
 */
export function detectSkinsuiteForm(exists, roots) {
  const monoCore = exists(join(roots.monorepoRoot, 'packages', 'theme-core', 'src', 'index.ts'));
  const monoDevice = exists(join(roots.monorepoRoot, 'packages', 'shared-device', 'src', 'index.ts'));
  const installed = roots.installedRoots.some((r) => exists(join(r, 'skinsuite', 'src', 'index.ts')));
  const hasPackagesDir = exists(join(roots.monorepoRoot, 'packages'));

  const form = monoCore ? 'monorepo' : installed ? 'installed' : 'broken';
  const warnings = [];
  if (!monoCore && installed && hasPackagesDir) {
    warnings.push(
      'packages/ 存在但 packages/theme-core/src/index.ts 缺失 —— submodule 未初始化？' +
        '当前静默回落 node_modules 版：改包源码不生效，且报告 bug 时形态会说不清'
    );
  }
  if (form === 'monorepo' && !monoDevice) {
    warnings.push('monorepo 形态但 packages/shared-device/src/index.ts 缺失 —— stable-deviceid 回落 node_modules 版');
  }
  return { form, monoCore, monoDevice, installed, warnings };
}

/**
 * env 文件齐否（.env 不入库 → 缺了只是 warn；另三个入库 → 缺了是 fail）
 * @param {(name: string) => boolean} exists 以 OA 为基准的存在性（单测注入）
 * @returns {Array<{ name: string, status: 'ok'|'warn'|'fail', hint?: string }>}
 */
export function checkEnvFiles(exists) {
  const out = [];
  const push = (name, status, hint) => out.push({ name, status, hint });
  if (exists('.env')) push('.env', 'ok', '存在（不入库）');
  else push('.env', 'warn', 'cp .env.example .env 起步（联调还要对齐后端 SIGN_APP_KEY）');
  for (const name of ['.env.development', '.env.production', '.env.example']) {
    if (exists(name)) push(name, 'ok');
    else push(name, 'fail', '入库文件缺失 —— git checkout -- ' + name + ' 恢复');
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 探活（真 IO，不进单测）
 * ------------------------------------------------------------------------- */

/** TCP 连通判定（被占但非 HTTP 服务的识别手段；HTTP 已就绪时没必要跑） */
function tcpOpen(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(800);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });
}

async function probePort(port) {
  let httpOk = false;
  try {
    await assertPort(`http://127.0.0.1:${port}`, { timeoutMs: 1500 });
    httpOk = true;
  } catch {
    /* 未就绪 —— 下面用 TCP 区分「空闲」与「被占」 */
  }
  const tcpOk = httpOk ? true : await tcpOpen(port);
  return { httpOk, tcpOk };
}

/* ---------------------------------------------------------------------------
 * 输出helpers
 * ------------------------------------------------------------------------- */

const SYM = { ok: '✓', warn: '⚠', fail: '✗', info: 'ℹ' };
let failCount = 0;
let warnCount = 0;

function report(status, text) {
  if (status === 'fail') failCount++;
  if (status === 'warn') warnCount++;
  console.log(`${SYM[status]} ${text}`);
}

/** 显示宽度补全（CJK 记 2 列）—— 端口表对齐用；纯装饰，不影响任何判定 */
function padCJK(s, width) {
  const w = [...s].reduce((n, ch) => n + (ch.codePointAt(0) > 0x2e7f ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, width - w));
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

/* ---------------------------------------------------------------------------
 * 各项检查
 * ------------------------------------------------------------------------- */

function checkRuntimes(pkg) {
  section('运行时版本');
  const engines = pkg.engines ?? {};
  const nodeV = process.versions.node;
  report(satisfies(nodeV, engines.node ?? '>=20') ? 'ok' : 'fail', `node ${nodeV}（engines: ${engines.node ?? '>=20'}）`);
  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], {
    shell: true,
    encoding: 'utf8'
  });
  const npmV = (npm.stdout || '').trim();
  if (npmV) {
    report(satisfies(npmV, engines.npm ?? '>=10') ? 'ok' : 'fail', `npm ${npmV}（engines: ${engines.npm ?? '>=10'}）`);
  } else {
    report('warn', '取不到 npm 版本（spawn 失败）—— 版本口径无法校验');
  }
  if (!existsSync(join(OA, 'node_modules'))) {
    report('fail', 'node_modules 不存在 —— 先 npm install');
  } else {
    report('ok', 'node_modules 在（依赖已安装）');
  }
}

function checkForm() {
  section('依赖形态（skinsuite 双形态）');
  const { form, monoDevice, warnings } = detectSkinsuiteForm(existsSync, {
    monorepoRoot: MONOREPO_ROOT,
    installedRoots: [join(MONOREPO_ROOT, 'node_modules'), join(OA, 'node_modules')]
  });
  if (form === 'monorepo') {
    report('ok', 'monorepo 形态：alias 源码直供 packages/theme-core（改包源码即时生效）');
    if (monoDevice) report('ok', 'stable-deviceid 源码直供 packages/shared-device');
  } else if (form === 'installed') {
    report('ok', '独立仓形态：alias 源码直供 node_modules/skinsuite/src（npm 发布版自带 src）');
  } else {
    report('fail', 'skinsuite 源码入口两处都找不到 —— npm install 了吗？（packages/theme-core/src 与 node_modules/skinsuite/src 都不在）');
  }
  for (const w of warnings) report('warn', w);
}

function checkEnv() {
  section('env 文件');
  for (const r of checkEnvFiles((name) => existsSync(join(OA, name)))) {
    report(r.status, `${r.name}${r.hint ? ` —— ${r.hint}` : ''}`);
  }
}

const PORTS = [
  { port: 5174, label: 'dev 默认实例', need: 'dev' },
  { port: 5175, label: 'link 模式实例', need: 'dev' },
  { port: 5177, label: 'compact 版式实例', need: 'dev' },
  { port: 5197, label: 'color-peer 专用', need: 'dev' },
  { port: 5189, label: 'dist 预览（生产组）', need: 'prod' }
];

async function checkPorts() {
  section('端口（验证关卡依赖）');
  for (const p of PORTS) {
    const { httpOk, tcpOk } = await probePort(p.port);
    const st = classifyPort({ httpOk, tcpOk });
    const label = padCJK(`${p.port} ${p.label}`, 30);
    if (st === 'up') {
      report('ok', `${label} 就绪（HTTP 200）`);
    } else if (st === 'busy') {
      report('fail', `${label} 端口被占且不是 HTTP 服务 —— 占用者不是我们的实例，换掉它再验（被占时关卡只会拿到一片超时红）`);
    } else if (p.need === 'dev') {
      report('warn', `${label} 未就绪 → npm run probe:up`);
    } else {
      report('info', `${label} 未就绪（prod 组才需要：npx vite build --outDir dist-nopwa && npx vite preview --outDir dist-nopwa --port 5189 --strictPort）`);
    }
  }
}

function checkViteCache() {
  section('vite 预打包缓存');
  const dir = join(OA, 'node_modules', '.vite');
  const entries = existsSync(dir) ? readdirSync(dir) : null;
  const st = classifyViteCache(entries);
  if (st === 'ok') report('ok', 'node_modules/.vite/deps 正常');
  else if (st === 'temp-only') {
    report(
      'warn',
      'node_modules/.vite 只有 deps_temp_* 没有 deps/ —— 预打包从未成功提交（Windows 多进程抢原子重命名），' +
        '症状是 504 Outdated Optimize Dep → 白屏 → DOM 断言假红。删掉残留目录后由单个实例重建'
    );
  } else if (st === 'missing') {
    report('info', 'node_modules/.vite 还没建（首次 dev / probe:up 会预打包）');
  } else {
    report('info', 'node_modules/.vite 存在但无 deps/ 也无 deps_temp_*（下次构建会写）');
  }
}

function git(args) {
  return spawnSync('git', args, { cwd: OA, encoding: 'utf8' });
}

function checkGit() {
  section('git 状态');
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const branchName = (branch.stdout || '').trim();
  if (branch.status === 0 && branchName) report('ok', `分支 ${branchName}`);
  else report('warn', '取不到当前分支名');

  const dirty = git(['status', '--porcelain']);
  const n = (dirty.stdout || '').split('\n').filter(Boolean).length;
  if (n === 0) report('ok', '工作区干净');
  else report('warn', `${n} 个文件未提交 —— 关卡跑的是工作区，提交前确认验的是哪份代码`);

  const ahead = git(['rev-list', '--left-right', '--count', '@{upstream}...HEAD']);
  if (ahead.status === 0) {
    const [behind, forward] = (ahead.stdout || '').trim().split(/\s+/).map(Number);
    if (behind === 0 && forward === 0) report('ok', '与上游同步');
    else report('warn', `与上游差：落后 ${behind} / 领先 ${forward} 个提交`);
  } else {
    report('info', '无上游跟踪分支（本地分支？）');
  }

  const tag = git(['describe', '--tags', '--abbrev=0']);
  if (tag.status === 0) report('ok', `tag 基线 ${(tag.stdout || '').trim()}（发版判据用它）`);
  else report('warn', 'git describe 取不到 tag —— 本机 git ref 异常时跑根仓 fix-packed-refs.mjs（发版基线会失灵）');
}

function checkToolchain() {
  section('工具链附注（只提示，不影响结论）');
  const gh = spawnSync('gh', ['--version'], { shell: true, encoding: 'utf8' });
  if (gh.status === 0) {
    report('ok', 'gh CLI 可用');
  } else {
    report(
      'info',
      'gh CLI 不可用 —— GitHub API 走 git credential 取 TOKEN + curl：' +
        "TOKEN=$(printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill | sed -n 's/^password=//p')"
    );
  }
  if (process.env.CODEBUDDY_SAFE_DELETE_ENABLED === '0') {
    report('info', 'safe-delete shim 已禁用（CODEBUDDY_SAFE_DELETE_ENABLED=0）');
  } else {
    report(
      'info',
      'safe-delete shim 活跃 —— 本地 vite build 清 dist 超过 50 文件会被拦（CONTRIBUTING 红线 #9）：' +
        '前台跑构建，或 CODEBUDDY_SAFE_DELETE_ENABLED=0 前缀'
    );
  }
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */

async function main() {
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(join(OA, 'package.json'), 'utf8'));
  } catch {
    report('fail', 'package.json 读不动 —— 在 oauth21 目录下跑：npm run doctor');
    process.exit(1);
  }

  console.log('🩺 oauth-web 环境预检（doctor）');
  console.log(`   工程根：${OA}`);

  checkRuntimes(pkg);
  checkForm();
  checkEnv();
  await checkPorts();
  checkViteCache();
  checkGit();
  checkToolchain();

  console.log('\n════ 结论 ════════');
  if (failCount > 0) {
    console.log(`${failCount} 个 FAIL · ${warnCount} 个 WARN —— 先补环境再跑关卡（环境没就绪时 verify-all 会跳过或假红）`);
    process.exit(1);
  }
  if (warnCount > 0) {
    console.log(`0 FAIL · ${warnCount} 个 WARN —— 可以开工；WARN 项按上面提示处理，尤其端口与未提交文件`);
  } else {
    console.log('全部就绪 ✅ —— node e2e/verify-all.mjs 或 npm run verify');
  }
  process.exit(0);
}

// 直接运行才执行（import 进来做单测时不触发主流程 —— env-guard 的教训）
// 仅「node scripts/doctor.mjs」直接运行时走流程；被 import（单测）时不触发
const invokedAsMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  main();
}
