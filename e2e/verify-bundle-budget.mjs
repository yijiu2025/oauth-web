/**
 * 包体积预算守门 —— 证明「产物没有悄悄膨胀」
 *
 * 为什么要有这条关卡：
 *   代码分割 / 懒加载 / 分包都是**一次性动作**，之后任何一次 PR 都可能让入口图
 *   悄悄变大（加一个同步 import、vendor 里多一个 API、样式里多一坨规则），而这类
 *   退化**功能一切正常、没有任何现有关卡会红** —— 它只体现在用户首屏流量上。
 *   本关卡把「首屏静态集 gzip 总量 / 单 chunk 体积 / dist 总量」钉成硬预算，
 *   超线即红，把性能回归挡在合入之前。
 *
 * === 口径（2026-10-15 首次实测钉线，改预算线 = 显式决策，必须同步改本注释）===
 *   首屏静态集 = `dist/index.html` 里引用的全部 /assets/ 文件
 *   （entry script + modulepreload + stylesheet）。真实用户首屏 JS/CSS 流量 ≈ 该集合
 *   + 按需 chunk；预算只守静态集这一项，按需部分由 verify-first-paint-budget.mjs
 *   （真实浏览器网络清单）守。
 *   压缩口径 = node:zlib gzip level 6（= nginx `gzip on` 默认级别、CDN 通用口径）。
 *   ⚠️ 刻意不信任构建日志里的 `gzip: xx kB`：那是对 chunk 逐文件估算，且不同 Rolldown
 *      版本算法可能变；本关卡对**落盘后的真实字节**自算，口径自持。
 *
 *   实测基线（2026-10-15，修复 vite.svg 断链 + modulepreload polyfill 关闭 + favicon
 *   压缩后的构建）：
 *     首屏静态集  8 files · 135.6 KB gz / 446.6 KB raw
 *     最大 chunk  form-vendor 51.4 KB gz / 160.1 KB raw
 *     dist 总量   808.5 KB raw（90 个 chunk）
 *     index.html  2.8 KB
 *
 *   实测基线（2026-10-19，主题机制下沉 + i18n 按领域拆分 + 404 四设备页之后）：
 *     首屏静态集  9 files · 160.2 KB gz / 609.7 KB raw  ← 调线：150 → 175
 *     最大 chunk  index 45.9 KB gz / 211.1 KB raw       ← 调线：200 → 240
 *     dist 总量   839.3 KB raw（69 个 chunk；chunk 数下降是因为分包粒度变粗）
 *     index.html  7.0 KB
 *
 *   🔴 2026-10-19 为什么调线（**显式决策**，不是"跑绿了就行"）：
 *     本轮新增了 404 页的**四设备容器 + 四版式 + 八套配色**（每套都被独立的
 *     主题包机制装配）、7 个 i18n 命名空间、页面契约类型与设备域。这些都在 app
 *     shell 里，首屏静态集 gzip 从 135.6 → 160.2（+18%）、入口 chunk 从 160 → 211。
 *     新增预算仍留 ~9%（A2 175）/ ~13%（B2 240）的余量，**不是把线拉到刚好过**。
 *     若后续还要涨，先按 `verify-first-paint-budget.mjs` 的真实网络清单定位，
 *     再决定是拆分包还是调线 —— 别默认调线。
 *
 * === 毒丸自证 ===
 *   `--poison` 把所有预算线压到 -1 重跑，必须**全部断言失败**（exit 1）——
 *   若仍绿，说明关卡本身失效（恒绿 = 没关卡）。
 *
 * 用法:
 *   node verify-bundle-budget.mjs                 # 默认 dist
 *   node verify-bundle-budget.mjs --dir dist-nopwa
 *   node verify-bundle-budget.mjs --poison        # 自证：必须变红
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OA = resolve(HERE, '..');

const argv = process.argv.slice(2);
const POISON = argv.includes('--poison');
const dirIdx = argv.indexOf('--dir');
const DIST = resolve(OA, dirIdx >= 0 && argv[dirIdx + 1] ? argv[dirIdx + 1] : 'dist');

const KB = 1024;

/* ============================ 预算线（KB） ============================ */
// 修改任何一条都必须同步更新文件头注释里的「实测基线」，并写清为什么旧线不够。
const BUDGET = {
  /** 首屏静态集 gzip 总量（实测 160.2，留 ~9% 余量；2026-10-19 由 150 上调） */
  firstPaintGz: POISON ? -1 : 175,
  /** 首屏静态集文件数（实测 8；防"把按需 chunk 提回静态图"） */
  firstPaintFiles: POISON ? -1 : 12,
  /** 单 chunk gzip（实测最大 51.2，留 ~17% 余量） */
  chunkGz: POISON ? -1 : 60,
  /** 单 chunk raw（实测最大 211.1，留 ~13% 余量；2026-10-19 由 200 上调） */
  chunkRaw: POISON ? -1 : 240,
  /** dist 全量 raw（实测 0.79 MB；登录页全量产物不该超过 1 MB） */
  distRaw: POISON ? -1 : 1024,
  /** index.html 体积（实测 ~2.5 KB；它是唯一无法长缓存的文档，必须保持小巧） */
  htmlRaw: POISON ? -1 : 8
};

let pass = 0;
const fails = [];
const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}${extra ? `  ${extra}` : ''}`);
  } else {
    fails.push(name);
    console.log(`  ❌ ${name}${extra ? `  ${extra}` : ''}`);
  }
};

const kb = n => `${(n / KB).toFixed(1)} KB`;

/** 目录树总字节数（真实文件字节，非 du 块对齐） */
function treeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? treeBytes(p) : statSync(p).size;
  }
  return total;
}

/* ============================ 主流程 ============================ */
if (!existsSync(DIST)) {
  console.error(`产物目录不存在：${DIST}\n先跑 npm run build（或 --dir 指定其它产物目录）。`);
  process.exit(3); // 3 = 环境未就绪（与 verify-all.mjs 的跳过语义区分：这里是显式报错）
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const htmlBytes = Buffer.byteLength(html, 'utf8');

// index.html 里的静态引用：entry script / modulepreload / stylesheet
const refs = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]))].sort();

console.log(`\n===== 包体积预算（${POISON ? '毒丸模式：预算线全部压到 -1，必须全红' : 'dist'}）=====`);

// A. 首屏静态集：存在性 + 总量 + 文件数
console.log('\n── A. 首屏静态集（index.html 引用的 /assets/）──');
const firstPaint = refs.map(ref => {
  const p = join(DIST, ref);
  const raw = existsSync(p) ? statSync(p).size : null;
  return { ref, raw, gz: raw === null ? null : gzipSync(readFileSync(p)).length };
});
const missing = firstPaint.filter(f => f.raw === null);
check('A1 index.html 引用的每个 /assets/ 文件都存在于产物中', missing.length === 0, missing.length ? `缺失：${missing.map(m => m.ref).join(', ')}` : `${firstPaint.length} 个文件`);

const totalRaw = firstPaint.reduce((a, f) => a + (f.raw ?? 0), 0);
const totalGz = firstPaint.reduce((a, f) => a + (f.gz ?? 0), 0);
for (const f of firstPaint) {
  console.log(`      ${kb(f.gz ?? 0).padStart(8)} gz  ${kb(f.raw ?? 0).padStart(8)} raw  ${f.ref.replace('/assets/', '')}`);
}
console.log(`      ${'——'.padStart(8)}     ${'——'.padStart(8)}`);
console.log(`      ${kb(totalGz).padStart(8)} gz  ${kb(totalRaw).padStart(8)} raw  合计 ${firstPaint.length} files`);

check(`A2 首屏静态集 gzip 总量 ≤ ${BUDGET.firstPaintGz} KB`, totalGz <= BUDGET.firstPaintGz * KB, `实测 ${kb(totalGz)}`);
check(`A3 首屏静态集文件数 ≤ ${BUDGET.firstPaintFiles}`, firstPaint.length <= BUDGET.firstPaintFiles, `实测 ${firstPaint.length}`);

// B. 单 chunk 体积
console.log('\n── B. 单 chunk 体积（dist/assets 全部 .js/.css）──');
const assetsDir = join(DIST, 'assets');
const chunks = readdirSync(assetsDir)
  .filter(f => f.endsWith('.js') || f.endsWith('.css'))
  .map(f => {
    const raw = statSync(join(assetsDir, f)).size;
    return { f, raw, gz: gzipSync(readFileSync(join(assetsDir, f))).length };
  })
  .sort((a, b) => b.gz - a.gz);
const maxGz = chunks[0];
const maxRaw = chunks.reduce((a, b) => (b.raw > a.raw ? b : a), chunks[0]);
check(`B1 最大 chunk gzip ≤ ${BUDGET.chunkGz} KB`, maxGz.gz <= BUDGET.chunkGz * KB, `实测 ${maxGz.f} = ${kb(maxGz.gz)}`);
check(`B2 最大 chunk raw ≤ ${BUDGET.chunkRaw} KB`, maxRaw.raw <= BUDGET.chunkRaw * KB, `实测 ${maxRaw.f} = ${kb(maxRaw.raw)}`);

// C. dist 总量
console.log('\n── C. dist 全量体积 ──');
const distTotal = treeBytes(DIST);
check(`C1 dist 总量 ≤ ${BUDGET.distRaw} KB`, distTotal <= BUDGET.distRaw * KB, `实测 ${kb(distTotal)}（${chunks.length} 个 chunk）`);

// D. index.html 本体
console.log('\n── D. index.html（不可长缓存的文档）──');
check(`D1 index.html ≤ ${BUDGET.htmlRaw} KB`, htmlBytes <= BUDGET.htmlRaw * KB, `实测 ${kb(htmlBytes)}`);

// E. 体积报表：Top 8 chunk，人在 CI 日志里直接看趋势
console.log('\n── E. Top 8 chunk（按 gzip）──');
for (const c of chunks.slice(0, 8)) {
  console.log(`      ${kb(c.gz).padStart(8)} gz  ${kb(c.raw).padStart(8)} raw  ${c.f}`);
}

console.log(`\n===== ${fails.length === 0 ? '预算内 ✅' : '超预算 ❌'}：${pass}/${pass + fails.length} 通过 =====`);
if (fails.length) {
  console.log('超预算项（性能回归，见文件头「改预算线 = 显式决策」）：');
  for (const f of fails) console.log(`  - ${f}`);
}
if (POISON && fails.length === 0) {
  console.log('⛔️ 毒丸模式下仍然全绿 —— 关卡本身失效，必须修复！');
  process.exit(1);
}
process.exit(fails.length ? 1 : 0);
