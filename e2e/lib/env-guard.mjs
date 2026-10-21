/**
 * 关卡环境自检（防假绿 / 假红的第一道闸）
 *
 * === 为什么要有这个模块 ===
 * 2026-10-21 一天内踩了两次同一类坑，都是「关卡自身的环境假设静默不成立」：
 *   ① `verify-first-paint-budget` 用 `process.cwd()` 定位主题目录，而 verify-all 跑关卡时
 *      cwd = e2e/ → 扫到不存在的目录 → 期望集算成 0 个 → A1 恒红（查了半天产品代码）；
 *   ② `verify-forgot-view` 的 link 模式段跑在 5175，verify-all 只声明 5174 → 缺实例时
 *      关卡硬崩；而端口没起时 verify-all 的选择是「跳过」——跳过累计下来仍报「全部通过」，
 *      这正是**假绿**：没验的关卡和验过的关卡在汇总里长得一样。
 *
 * 本模块把三类环境假设收成显式自检，**假设不成立就当场红**（退出码 2，与断言红 1 区分）：
 *   · `assertScanDir`  扫描目录必须存在且非空 —— 「期望集为 0」是恒红/假绿的根源，
 *     空目录上「每条版式都不含 X」这类断言会** vacuously 通过**；
 *   · `assertDist`     产物目录必须存在（含 index.html）且不比最新源码旧 ——
 *     陈旧产物上跑 prod 组 = 拿昨天的代码换今天的绿灯；
 *   · `assertPort`     端口必须返回 HTTP 响应（比 TCP 连通强：服务在但 500 也能发现）；
 *   · `repoRoot`       从脚本自身位置推导仓根（带 package.json name 校验）——
 *     替代「用 cwd 推路径」这个两次事故的源头。
 *
 * === 用法 ===
 * ```js
 * import { requireScanDir, requirePort } from './lib/env-guard.mjs';
 * const entries = requireScanDir(THEMES, '主题包目录');   // 失败即退出码 2 + 一行原因
 * await requirePort(BASE);                                // 失败即退出码 2 + 一行原因
 * ```
 * `assert*` 是纯抛错版（供单测），`require*` 是自退出版（供关卡调用）。
 *
 * @author yijiu2025
 * @since 2026-10-21
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 环境自检失败（与「断言失败」区分：退出码 2 vs 1） */
export class EnvGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnvGuardError';
  }
}

/** 仓根判定：package.json 的 name 含 oauth（宿主仓名 oauth-web） */
const ROOT_NAME_RE = /oauth/i;
/** 陈旧判定的容差（秒）：构建落地与源码落盘的时钟差，1s 足够 */
const STALE_SLACK_MS = 1000;
/** 推导仓根时最多上爬层数（e2e/lib → e2e → oauth21，3 层够；留余量防深嵌套） */
const MAX_UP = 8;

/**
 * 从**调用方脚本自身位置**往上推导仓根（不信 cwd —— cwd 是本模块存在的原因）
 *
 * @param {string} importMetaUrl 调用方的 `import.meta.url`
 * @returns {string} 仓根绝对路径（含 package.json 且 name 命中 oauth）
 */
export function assertRepoRoot(importMetaUrl) {
  let dir = dirname(fileURLToPath(importMetaUrl));
  for (let i = 0; i < MAX_UP; i++) {
    const pj = join(dir, 'package.json');
    if (existsSync(pj)) {
      try {
        const pkg = JSON.parse(readFileSync(pj, 'utf8'));
        if (typeof pkg.name === 'string' && ROOT_NAME_RE.test(pkg.name)) return dir;
      } catch {
        // package.json 解析失败 → 继续上爬（可能是别的项目的残留文件）
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new EnvGuardError(
    `仓根推导失败：从 ${fileURLToPath(importMetaUrl)} 上爬 ${MAX_UP} 层没找到 ` +
      `package.json（name 需匹配 ${ROOT_NAME_RE}）—— 关卡脚本被移出了仓结构？`
  );
}

/**
 * 扫描目录必须存在且非空
 *
 * 「期望集为 0」是两类事故的根源：恒红（动态算期望，目录扫空 → 每条断言都红）与
 * 假绿（否定式断言「版式里不含 X」在空集上 vacuously 通过）。所以空目录不是
 * 「跳过几条」，是自检失败。
 *
 * @param {string} dir 目录绝对路径
 * @param {string} label 人类可读名（进错误信息）
 * @param {{ min?: number }} [opts] 最少条目数（默认 1）
 * @returns {string[]} 目录条目（调用方可直接用）
 */
export function assertScanDir(dir, label, opts = {}) {
  const min = opts.min ?? 1;
  if (!existsSync(dir)) {
    throw new EnvGuardError(`${label}目录不存在：${dir}（目录被移走 / 改名 / 拼写错？）`);
  }
  const entries = readdirSync(dir);
  if (entries.length < min) {
    throw new EnvGuardError(
      `${label}目录为空：${dir}（期望 ≥ ${min} 个条目）—— ` +
        '期望集为 0 会让断言恒红或假绿，按自检失败处理'
    );
  }
  return entries;
}

/** 递归取某目录下最新 mtime（跳过不存在的目录 → null；**非产物文件不计**） */
function newestMtime(dir) {
  if (!existsSync(dir)) return null;
  // 不进产物的文件写它不该让 dist 变「陈旧」，否则守卫会因狼来了被绕过：
  //   · 测试文件（__tests__/、*.test.*、*.spec.*）—— 单测不打包；
  //   · *.d.ts —— 纯类型声明；src/auto-import.d.ts 还是 AutoImport 插件每次
  //     dev/test 都重写的生成物（内容不变 mtime 也变，2026-10-21 实测误报）。
  const isNonBundle = (p) =>
    p.includes(`${sep}__tests__${sep}`) ||
    /\.(test|spec)\./.test(p) ||
    p.endsWith('.d.ts');
  let newest = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === '.git' || name === 'dist-nopwa') continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (!isNonBundle(p) && st.mtimeMs > newest) newest = st.mtimeMs;
    }
  };
  walk(dir);
  return newest;
}

/**
 * 产物目录必须存在、含 index.html、且不比最新源码旧
 *
 * 陈旧产物 = 用旧代码换新绿灯（prod 组最容易踩：昨晚的 dist 今早直接 preview）。
 *  escape：`GUARD_ALLOW_STALE=1` 或 `opts.allowStale`（知道自己在干什么时才用）。
 *
 * @param {string} distDir 产物目录（如 dist-nopwa）
 * @param {string} srcDir 源码目录（如 <root>/src），不存在则跳过陈旧判定
 * @param {{ allowStale?: boolean }} [opts]
 * @returns {string} distDir
 */
export function assertDist(distDir, srcDir, opts = {}) {
  const allowStale = opts.allowStale ?? !!process.env.GUARD_ALLOW_STALE;
  const indexHtml = join(distDir, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new EnvGuardError(
      `产物目录不可用：${indexHtml} 不存在 —— prod 组跑之前先 ` +
        '`npx vite build --outDir <distDir>`'
    );
  }
  if (allowStale) return distDir;
  const distMs = statSync(indexHtml).mtimeMs;
  const srcMs = newestMtime(srcDir);
  if (srcMs !== null && srcMs - distMs > STALE_SLACK_MS) {
    const fmt = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
    throw new EnvGuardError(
      `产物陈旧：${distDir}（${fmt(distMs)}）旧于最新源码（${fmt(srcMs)}）—— ` +
        '现在跑 prod 组验的是旧代码（假绿）。重建：`npx vite build --outDir ' +
        distDir.split(/[\\/]/).pop() + '`；确有理由跑旧产物：GUARD_ALLOW_STALE=1'
    );
  }
  return distDir;
}

/**
 * 端口必须返回 HTTP 响应（比 TCP 连通强一级）
 *
 * TCP 连通只证明「有进程在听」；服务在但崩在 500 / 反代 502 时 TCP 探活照样绿，
 * 关卡跑进去才在一堆超时里红。这里直接 GET `/`，任何 < 400 的状态都算就绪。
 *
 * @param {string} baseUrl 形如 http://127.0.0.1:5174
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function assertPort(baseUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 5000;
  let res;
  try {
    res = await fetch(baseUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const why = err?.name === 'TimeoutError' ? `请求超时（${timeoutMs}ms）` : err?.message;
    throw new EnvGuardError(`端口未就绪：${baseUrl}（${why}）—— 先按 VERIFY.md 起实例`);
  }
  if (res.status >= 400) {
    throw new EnvGuardError(
      `端口响应异常：${baseUrl} → HTTP ${res.status} —— 服务在但状态不对，` +
        '修服务再跑关卡（带着 5xx 跑进去只会得到一片超时红）'
    );
  }
}

/* ---------------------------------------------------------------------------
 * require* 薄包装：自检失败 → 统一格式 + 退出码 2（关卡零 boilerplate）
 * ------------------------------------------------------------------------- */

function exitGuard(err) {
  if (err instanceof EnvGuardError) {
    console.error(`\n🛑 环境自检未通过（退出码 2，区别于断言红 1）：\n   ${err.message}\n`);
    process.exit(2);
  }
  throw err;
}

export function requireRepoRoot(importMetaUrl) {
  try {
    return assertRepoRoot(importMetaUrl);
  } catch (err) {
    exitGuard(err);
  }
}

export function requireScanDir(dir, label, opts) {
  try {
    return assertScanDir(dir, label, opts);
  } catch (err) {
    exitGuard(err);
  }
}

export function requireDist(distDir, srcDir, opts) {
  try {
    return assertDist(distDir, srcDir, opts);
  } catch (err) {
    exitGuard(err);
  }
}

export async function requirePort(baseUrl, opts) {
  try {
    return await assertPort(baseUrl, opts);
  } catch (err) {
    exitGuard(err);
  }
}
