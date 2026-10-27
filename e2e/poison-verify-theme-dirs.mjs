/**
 * 毒丸验证：证明 verify-theme-dirs.mjs 的断言真的会失败（恒绿的闸门等于没有闸门）
 *
 * 毒丸三枚（2026-10-27 重写 —— 旧的 8 枚里 7 枚的断言语义已被抽包/设备模块重构删除，
 * 注入点（src/theme/index.ts / registry.ts / tone.ts）也已不存在，脚本运行即 ENOENT）：
 *   ① 在页面下建一个「版式层目录」`themes/default/mobile/login/compact/`
 *      → 必须触发「页面目录下不存在多余子目录（只允许 colors）」失败
 *   ② 往内核包任意 .ts 塞一句 `window.location`（DOM 依赖）
 *      → 必须触发「内核不依赖：window / document（DOM）」失败
 *   ③ 在主题包里建一个非法设备目录 `themes/default/evil/`
 *      → 必须触发「设备目录都在白名单内」失败
 *
 * 跑完自动还原（务必确认还原干净，失败时打印还原状态）。
 */
import { readFileSync, writeFileSync, openSync, closeSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OA = join(HERE, '..');
const CHECKER = join(HERE, 'verify-theme-dirs.mjs');
/** 内核包源码根（与关卡同口径：monorepo 形态 → packages/theme-core/src） */
const MONOREPO_CORE = join(HERE, '..', '..', 'packages', 'theme-core', 'src');
const CORE = existsSync(join(MONOREPO_CORE, 'index.ts')) ? MONOREPO_CORE : '';
/** 毒丸①的目标：页面下多建一层目录 */
const POISON_DIR = join(OA, 'src', 'theme', 'themes', 'default', 'mobile', 'login', 'compact');
/** 毒丸③的目标：非法设备目录 */
const POISON_DEVICE_DIR = join(OA, 'src', 'theme', 'themes', 'default', 'evil');
/** 毒丸②的注入点：内核任意 .ts（constants.ts 稳定存在） */
const CORE_CONSTANTS = CORE ? join(CORE, 'constants.ts') : '';
const LOG = join(HERE, '.poison-checker.log');

/**
 * 改动前的原文（file → text）。用一张表而不是若干个 dirty 标记：
 * 毒丸还会继续加，每加一枚就多一个标记必然漏还原。
 */
const backups = new Map();
function poke(file, newText) {
  if (!file || !existsSync(file)) return false;
  if (!backups.has(file)) backups.set(file, readFileSync(file, 'utf8'));
  writeFileSync(file, newText, 'utf8');
  // 回读确认注入真的落盘（写失败 / 路径错时不能算毒丸通过）
  return readFileSync(file, 'utf8') === newText;
}
function restoreAll() {
  for (const [file, text] of backups) writeFileSync(file, text, 'utf8');
  if (existsSync(POISON_DIR)) rmSync(POISON_DIR, { recursive: true, force: true });
  if (existsSync(POISON_DEVICE_DIR)) rmSync(POISON_DEVICE_DIR, { recursive: true, force: true });
}

/**
 * ⚠️ 本机同步 spawn 走**管道 IO** 会恒抛（EBUSY / status=null 且无输出），
 *    必须用 spawnSync + **文件型 stdio**，再把日志读回来。
 */
function runChecker() {
  const fd = openSync(LOG, 'w');
  let r;
  try {
    r = spawnSync(process.execPath, [CHECKER], { stdio: ['ignore', fd, fd] });
  } finally {
    closeSync(fd);
  }
  const out = readFileSync(LOG, 'utf8');
  return { code: r.status ?? 1, out };
}

const results = [];
const total = 3;
function record(label, ok, detail = '') {
  results.push([label, ok, detail]);
}

try {
  // ---- 基线
  const base = runChecker();
  record('基线（无改动）', base.code === 0, `exit=${base.code}`);

  // ---- 毒丸 ①：页面下建版式层目录
  mkdirSync(POISON_DIR, { recursive: true });
  const p1 = runChecker();
  const hit1 = /页面目录下不存在多余子目录/.test(p1.out);
  record(
    '毒丸①  页面下建 <版式>/ 目录 → 关卡变红',
    p1.code === 1 && hit1,
    `exit=${p1.code}, 命中断言=${hit1}`
  );
  rmSync(POISON_DIR, { recursive: true, force: true });

  // ---- 毒丸 ②：内核包塞 DOM 依赖（"内核不知道宿主"是抽包前提）
  if (!CORE_CONSTANTS) {
    record('毒丸②  内核里塞 DOM 依赖 → 关卡变红', false, `注入点缺失 ${CORE_CONSTANTS}`);
  } else {
    const coreOriginal = readFileSync(CORE_CONSTANTS, 'utf8');
    const injected = `${coreOriginal}\nexport const __poison = window.location.href;\n`;
    if (poke(CORE_CONSTANTS, injected)) {
      const p2 = runChecker();
      const hit2 = /内核不依赖：window \/ document（DOM）/.test(p2.out);
      record(
        '毒丸②  内核里塞 DOM 依赖 → 关卡变红',
        p2.code === 1 && hit2,
        `exit=${p2.code}, 命中断言=${hit2}`
      );
      writeFileSync(CORE_CONSTANTS, coreOriginal, 'utf8');
      backups.delete(CORE_CONSTANTS);
    } else {
      record('毒丸②  内核里塞 DOM 依赖 → 关卡变红', false, '注入失败（写盘/回读不匹配）');
    }
  }

  // ---- 毒丸 ③：主题包里建非法设备目录
  mkdirSync(POISON_DEVICE_DIR, { recursive: true });
  const p3 = runChecker();
  const hit3 = /设备目录都在白名单内/.test(p3.out);
  record(
    '毒丸③  建非法设备目录 → 关卡变红',
    p3.code === 1 && hit3,
    `exit=${p3.code}, 命中断言=${hit3}`
  );
  rmSync(POISON_DEVICE_DIR, { recursive: true, force: true });
} finally {
  restoreAll();
}

// ---- 还原校验
const after = runChecker();
record('还原后回到全绿', after.code === 0, `exit=${after.code}`);
for (const [file, text] of backups) {
  record(`字节级还原：${file}`, readFileSync(file, 'utf8') === text);
}
if (backups.size === 0) record('全部注入点都已还原（备份表为空）', true);
record('毒丸目录已清除', !existsSync(POISON_DIR) && !existsSync(POISON_DEVICE_DIR));

let bad = 0;
console.log('\n=== 毒丸验证结果 ===');
for (const [label, ok, detail] of results) {
  if (!ok) bad += 1;
  console.log(`${ok ? '\u2713' : '\u2717'} ${label}${detail ? `  (${detail})` : ''}`);
}
console.log(`\n毒丸 ${total} 枚：${bad === 0 ? '验证通过（每枚都真的会让关卡变红）' : `验证失败：${bad} 项`}`);
process.exit(bad === 0 ? 0 : 1);
