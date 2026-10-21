/**
 * env 四文件一致性机检 —— 把 CONTRIBUTING 红线 #2 从「人守」变成「机检」
 *
 * === 守的红线 ===
 * 「env 四文件必须同序同注释：新增变量时四个文件同时加、注释写全（含漏配症状）」——
 * 此前这条只有人读文档遵守，漏改的症状是**静默**的：某文件少一个键，代码读到的
 * 是另一文件的默认值 / undefined，不报错，只是行为不符预期。本关卡把它机检化。
 *
 * === 检什么 ===
 *   ① 四文件（.env / .env.development / .env.production / .env.example）键序列
 *      **完全一致**（集合 + 顺序）—— 少键 / 多键 / 换序都红；
 *   ② 文件内无重复键（后者覆盖前者，Vite 不报错）；
 *   ③ 键形 `^VITE_[A-Z0-9_]+$` —— 非 VITE_ 前缀的键 Vite **静默不暴露**，
 *      写了等于没写（与「URL 非法值不回退」同族的静默失败）；
 *   ④ .env.example（模板，注释最全版本）每个键上方都有注释 —— 「注释写全」。
 *
 * 退出码：0 全过 / 1 断言红 / 2 环境自检红（文件缺失等，与断言红区分）。
 *
 * @author yijiu2025
 * @since 2026-10-21
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRepoRoot } from './lib/env-guard.mjs';

/** 四个 env 文件（顺序即报告顺序）；`.env.example` 是模板 = 注释最全版本 */
export const ENV_FILES = ['.env', '.env.development', '.env.production', '.env.example'];
/** 模板文件（注释齐全性以它为基准） */
export const TEMPLATE_FILE = '.env.example';
/** 合法键形：Vite 只暴露 VITE_ 前缀；其余静默不暴露 */
const KEY_RE = /^VITE_[A-Z0-9_]+$/;

/* ---------------------------------------------------------------------------
 * 纯函数（可单测 —— 见 verify-env-files.test.mjs）
 * ------------------------------------------------------------------------- */

/**
 * 解析 env 文件内容 → 有序键列表 + 每键是否有上方注释
 *
 * 规则：跳过空行与 `#` 注释行；`KEY=value` 取 `=` 前为键（值里允许再带 `=`）；
 * CRLF / LF 都吃；`hasComment` = 该键上方**紧邻的连续注释块**非空
 * （空行隔断后不算 —— 那通常是下一个 section 的标题，不属于这个键）。
 *
 * @param {string} content 文件全文
 * @returns {Array<{ key: string, hasComment: boolean }>}
 */
export function parseEnvKeys(content) {
  const out = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let commentRun = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      commentRun = 0; // 空行隔断：上面的注释不再属于后面的键
      continue;
    }
    if (line.startsWith('#')) {
      commentRun++;
      continue;
    }
    const eq = line.indexOf('=');
    const key = (eq === -1 ? line : line.slice(0, eq)).trim();
    out.push({ key, hasComment: commentRun > 0 });
    commentRun = 0;
  }
  return out;
}

/**
 * 比对多个文件的键序列 → 问题清单（空数组 = 一致）
 *
 * @param {Array<{ name: string, entries: Array<{ key: string }> }>} files
 * @returns {string[]} 人类可读的问题列表（空 = 通过）
 */
export function compareEnvFiles(files) {
  const problems = [];
  if (files.length < 2) return problems;

  const seq = (f) => f.entries.map((e) => e.key);
  const base = seq(files[0]);

  // ① 文件内重复键（同文件里后者静默覆盖前者）
  for (const f of files) {
    const seen = new Set();
    for (const k of seq(f)) {
      if (seen.has(k)) problems.push(`${f.name}：键「${k}」重复定义（后者静默覆盖前者）`);
      seen.add(k);
    }
  }

  // ② 以第一个文件为基准，逐个比对其余文件：少键 / 多键 / 顺序漂移
  for (const f of files.slice(1)) {
    const keys = seq(f);
    const missing = base.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !base.includes(k));
    for (const k of missing) problems.push(`${f.name}：缺少键「${k}」（${files[0].name} 有）`);
    for (const k of extra) problems.push(`${f.name}：多出键「${k}」（${files[0].name} 没有）`);
    // 共有部分的相对顺序必须一致（去差集后逐位比）
    // ⚠️ 两侧都先去重再比：重复键已由上面的 ① 单独报出，若带着重复比顺序，
    //    [A,A] vs [A] 会被误判成「顺序漂移」—— 同一根因报两条，噪声会掩护真红。
    const dedupe = (arr) => [...new Set(arr)];
    const commonBase = dedupe(base).filter((k) => keys.includes(k));
    const commonThis = dedupe(keys).filter((k) => base.includes(k));
    if (commonBase.join('|') !== commonThis.join('|')) {
      problems.push(`${f.name}：共有键的相对顺序与 ${files[0].name} 不一致（同序同注释是红线）`);
    }
  }

  // ③ 键形：必须 VITE_ 前缀（非前缀 = Vite 静默不暴露，写了等于没写）
  for (const f of files) {
    for (const e of f.entries) {
      if (!KEY_RE.test(e.key)) {
        problems.push(`${f.name}：键「${e.key}」不是 VITE_ 前缀 —— Vite 不会暴露它，写了静默无效`);
      }
    }
  }

  return problems;
}

/* ---------------------------------------------------------------------------
 * 门（真 IO）
 * ------------------------------------------------------------------------- */

function exitGuard(message) {
  console.error(`\n🛑 环境自检未通过（退出码 2，区别于断言红 1）：\n   ${message}\n`);
  process.exit(2);
}

function main() {
  let root;
  try {
    root = assertRepoRoot(import.meta.url);
  } catch (err) {
    exitGuard(err.message);
  }

  // 文件存在性 = 环境自检（入库文件缺失是仓状态坏了，不是断言红）
  const files = [];
  for (const name of ENV_FILES) {
    const path = join(root, name);
    if (!existsSync(path)) {
      exitGuard(`${name} 不存在（${path}）—— 入库文件缺失？git checkout -- ${name}`);
    }
    const content = readFileSync(path, 'utf8');
    files.push({ name, entries: parseEnvKeys(content) });
  }

  const problems = compareEnvFiles(files);

  // ④ 模板文件注释齐全（红线「注释写全（含漏配症状）」）
  const template = files.find((f) => f.name === TEMPLATE_FILE);
  for (const e of template.entries) {
    if (!e.hasComment) {
      problems.push(`${TEMPLATE_FILE}：键「${e.key}」上方没有注释 —— 红线要求注释写全（含漏配症状）`);
    }
  }

  console.log('🔑 env 四文件一致性');
  const counts = files.map((f) => `${f.name} ${f.entries.length} 键`).join(' · ');
  console.log(`  ${counts}`);
  for (const p of problems) console.log(`  ✗ ${p}`);

  if (problems.length > 0) {
    console.log(`\n  ${problems.length} 个问题 —— 新增变量时四个文件同时加、注释写全（CONTRIBUTING 红线 #2）`);
    process.exit(1);
  }
  console.log('  四文件同键同序、键形合规、模板注释齐全 ✅');
  process.exit(0);
}

// 仅直接运行时走门（被 import 做单测时不触发）
// ⚠️ 判据必须是 argv[1] 解析后与本模块路径**全等**（与 scripts/doctor.mjs 同款）：
//    2026-10-21 实测 Node v22.22.2 下，若判据写松（如只匹配文件名后缀），
//    `node --test verify-env-files.test.mjs` 时本门会在 import 期跑完并
//    process.exit(0) —— 单测主体根本没执行，runner 却报 ok/pass/exit 0
//    （假绿，已用最小复现证实）。测试自己先被假绿，比没有测试更糟。
const invokedAsMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  main();
}
