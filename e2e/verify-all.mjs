/**
 * 统一关卡入口 —— 一键跑全部「活跃」验收关卡，汇总报告。
 *
 * 为什么要有它：
 *   以前关卡散落、启动方式不一（有的要 5174、有的要 5177/5197/5189、有的要生产构建、
 *   有的纯静态），每次全量回归都要人肉记端口、手动串行。这个脚本把「跑哪些、用什么环境、
 *   环境没起时怎么办」收敛到一处，并把结果汇总成一张表。
 *
 * 退出码约定（沿用各关卡既有语义）：
 *   0 = 全部通过（无跳过，或 --allow-skip 下有跳过）
 *   1 = 至少一个断言失败
 *   3 = 环境不可用（所有关卡都因端口/产物没就绪而跳过）
 *   4 = 有跳过（2026-10-21 新增：**没验 ≠ 通过** —— 端口没起时旧语义是静默跳过、
 *       累计下来仍报「全部通过」，正是假绿；--allow-skip 回到旧语义）
 *
 * 用法：
 *   node oauth21/e2e/verify-all.mjs
 *   node oauth21/e2e/verify-all.mjs --dev 5174          # 覆盖 dev 实例端口
 *   node oauth21/e2e/verify-all.mjs --link 5175          # 覆盖 link 模式实例端口
 *   node oauth21/e2e/verify-all.mjs --allow-skip         # 允许「跳过」仍算通过（旧语义）
 *   node oauth21/e2e/verify-all.mjs --skip-prod         # 跳过需要生产构建的关卡
 *   node oauth21/e2e/verify-all.mjs --only static       # 只跑静态关卡（无浏览器/服务器）
 *   node oauth21/e2e/verify-all.mjs --list              # 只打印关卡清单，不跑
 *
 * 端口约定（与 e2e/VERIFY.md §二、MEMORY §9 一致）：
 *   5174 = dev（默认实例）  5175 = link 模式实例（VITE_PASSWORD_RESET_MODE=link）
 *   5177 = 首屏流量实例（verify-first-paint-budget 独占；compact 由 URL 驱动）  5197 = color-peer 专用
 *   5189 = dist 预览（生产构建，量流量/验 SW 用）
 *
 * 关卡清单（权威口径）与每个关卡的用途/环境见同目录 VERIFY.md。
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { assertPort } from './lib/env-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// 关卡所在目录 = oauth21/e2e/，oauth21 就是上一级
const OA = join(HERE, '..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const flagVal = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const DEV = flagVal('--dev', 'http://127.0.0.1:5174');
const COMPACT = flagVal('--compact', 'http://127.0.0.1:5177');
const COLOR_PEER = flagVal('--color-peer', 'http://127.0.0.1:5197');
const PROD = flagVal('--prod', 'http://127.0.0.1:5189');
// link 模式实例（VITE_PASSWORD_RESET_MODE=link）：verify-forgot-view 的 G4~G7 段
const LINK = flagVal('--link', 'http://127.0.0.1:5175');
const ONLY = flagVal('--only', 'all');
const SKIP_PROD = flag('--skip-prod');
// 跳过是否算通过（默认不算 → 退出码 4）：「没验 ≠ 通过」
const ALLOW_SKIP = flag('--allow-skip');

// 每一组关卡：{ name, cmd:[...], needs: {port?, ports:[], dist?} }
// needs 里的值用于「环境没就绪 → 跳过」而不是「跑出一片红」。
// ⚠️ 跳过只是不跑，**不等于通过**：默认累计到退出码 4（--allow-skip 回到旧语义）。
const GROUPS = [
  {
    title: '① 静态关卡（无浏览器 / 无服务器）',
    only: 'static',
    items: [
      // 2026-10-21：自检模块自身的行为测试（node --test）—— 防假绿/假红的第一道闸
      // 自己也要被验证，否则第一次真实触发可能就是误判
      { name: 'verify-env-guard', cmd: ['--test', join('lib', 'env-guard.test.mjs')], needs: {} },
      // 2026-10-21：预检门诊 doctor 的判定函数测试（node --test）—— 判定写错比没有
      // 预检更糟（会用自信的语气把人带偏），与 env-guard 同一思路
      { name: 'verify-doctor', cmd: ['--test', join('..', 'scripts', 'doctor.test.mjs')], needs: {} },
      // 2026-10-21：env 四文件一致性机检（CONTRIBUTING 红线 #2 从人守变机检）
      { name: 'verify-env-files', cmd: ['verify-env-files.mjs'], needs: {} },
      // 2026-10-21：上一项的判定函数测试（node --test）—— 顺序漂移/少键/多键/键形
      // 四条判定路径各自覆盖通过+失败两侧，防第一次真实触发就误判
      { name: 'verify-env-files-test', cmd: ['--test', 'verify-env-files.test.mjs'], needs: {} },
      { name: 'verify-theme-dirs', cmd: ['verify-theme-dirs.mjs'], needs: {} },
      { name: 'verify-glob-device', cmd: ['verify-glob-device.mjs'], needs: {} },
      // 2026-09-28 新增：别名三处一致（aliases.ts ↔ tsconfig.app.json ↔ vite 实解析）
      { name: 'verify-alias-single-source', cmd: ['verify-alias-single-source.mjs'], needs: {} },
      // 2026-09-28 新增：内核零框架耦合（防 packages/* 引入 vue → 静默双实例）
      { name: 'verify-kernel-zero-coupling', cmd: ['verify-kernel-zero-coupling.mjs'], needs: {} },
      // 2026-09-28 新增：console 剥离真生效（自建一次生产构建扫产物；Vite 8 下曾长期静默失效）
      { name: 'verify-console-strip', cmd: ['verify-console-strip.mjs'], needs: {} },
      // 2026-09-28 新增：类型逃逸清零（any/@ts-ignore 关在 types/external.ts 单一入口）
      { name: 'verify-no-any-debt', cmd: ['verify-no-any-debt.mjs'], needs: {} },
      // ⚠️ verify-agreement-placeholders（协议占位符/个人邮箱清零）**不进常规 CI**：
      // 它是「上线前」合规阻断 —— 占位符在开发阶段未填是正常的（真实主体信息需
      // 上线前由维护者填写），进 CI 会让每次 push 恒红、掩盖其它真实失败（狼来了）。
      // 上线前手动跑：`node e2e/verify-agreement-placeholders.mjs`。
      { name: 'verify-no-pwa', cmd: ['verify-no-pwa.mjs', '--dir', 'dist-nopwa'], needs: { dist: join(OA, 'dist-nopwa') } },
      // 2026-10-15 新增：包体积预算（首屏静态集 gz / 单 chunk / dist 总量，防悄悄膨胀）
      { name: 'verify-bundle-budget', cmd: ['verify-bundle-budget.mjs', '--dir', 'dist'], needs: { dist: join(OA, 'dist') } },
    ],
  },
  {
    title: '② dev 实例关卡（默认 5174）',
    only: 'dev',
    items: [
      { name: 'verify-panel-v3', cmd: ['verify-panel-v3.mjs', DEV], needs: { port: DEV } },
      { name: 'verify-tablet-landing', cmd: ['verify-tablet-landing.mjs', DEV], needs: { port: DEV } },
      { name: 'verify-tone-memory', cmd: ['verify-tone-memory.mjs', DEV], needs: { port: DEV } },
      { name: 'verify-tone-unified', cmd: ['verify-tone-unified.mjs', DEV], needs: { port: DEV } },
      { name: 'verify-login-view', cmd: ['verify-login-view.mjs'], needs: { port: DEV } },
      { name: 'verify-register-view', cmd: ['verify-register-view.mjs'], needs: { port: DEV } },
      // 2026-10-21：G4~G7 link 模式段跑在 5175（VITE_PASSWORD_RESET_MODE=link），
      // 只声明 5174 时缺 5175 会让关卡在 open() 硬崩（uncaught，exit 1 + 栈），
      // 违反本脚本「环境没就绪 → 跳过」的口径 —— 多端口一起声明。
      { name: 'verify-forgot-view', cmd: ['verify-forgot-view.mjs'], needs: { ports: [DEV, LINK] } },
      // 注：本关卡只用位置参数 baseUrl（URL 驱动验四档链），不再接收 --env-base（env 档 2026-10-18 已移除）
      { name: 'verify-view-priority', cmd: ['verify-view-priority.mjs', DEV], needs: { port: DEV } },
      { name: 'verify-mobile-forgot', cmd: ['verify-mobile-forgot.mjs'], needs: { port: DEV } },
    ],
  },
  {
    title: '③ 特殊端口关卡',
    only: 'special',
    items: [
      { name: 'verify-color-peer', cmd: ['verify-color-peer.mjs', COLOR_PEER], needs: { port: COLOR_PEER } },
      { name: 'verify-first-paint-budget', cmd: ['verify-first-paint-budget.mjs', COMPACT], needs: { port: COMPACT } },
      { name: 'verify-colors-in-views', cmd: ['verify-colors-in-views.mjs', DEV], needs: { port: DEV } },
    ],
  },
  {
    title: '④ 生产构建关卡（dist 预览 5189）',
    only: 'prod',
    skipIf: SKIP_PROD,
    items: [
      { name: 'verify-responsive-switch', cmd: ['verify-responsive-switch.mjs', PROD], needs: { port: PROD } },
      { name: 'verify-sw-migration', cmd: ['verify-sw-migration.mjs', PROD, join(OA, 'dist-nopwa')], needs: { port: PROD, dist: join(OA, 'dist-nopwa') } },
    ],
  },
];

/**
 * 端口探活（HTTP 级，比 TCP 连通强一级：服务在但 5xx 时 TCP 照样绿）
 * 与各关卡内部的 requirePort 同源（lib/env-guard.mjs）
 *
 * 🔴 重试一次：全量链启动时 CPU 常被构建/类型检查占着，冷请求可能超过 800ms ——
 *    2026-10-21 实测 tone-unified/view-priority 在同一端口上前三关刚跑绿的情况下
 *    被误判「未就绪」而跳过。守卫的价值是「真挂能抓到」，不是「忙时误判」：
 *    宁可多等 2s，也不产出假跳过（假跳过比假红更隐蔽）。
 */
async function portUp(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await assertPort(url, { timeoutMs: 2000 });
      return true;
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

function runOne(item) {
  const { name, cmd } = item;
  const r = spawnSync(process.execPath, cmd.map((c) => c), {
    cwd: HERE,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    name,
    code: r.status,
    tail: (r.stdout || '').split('\n').filter(Boolean).slice(-3).join(' | '),
    errTail: (r.stderr || '').split('\n').filter(Boolean).slice(-2).join(' | '),
  };
}

function printList() {
  console.log('关卡清单（权威口径见 VERIFY.md）：\n');
  for (const g of GROUPS) {
    console.log(g.title);
    for (const it of g.items) console.log(`  - ${it.name}`);
    console.log('');
  }
}

if (flag('--list')) {
  printList();
  process.exit(0);
}

async function main() {
  if (ONLY !== 'all' && !GROUPS.some((g) => g.only === ONLY)) {
    console.error(`未知 --only 值：${ONLY}（可选 static|dev|special|prod）`);
    process.exit(2);
  }

  const results = [];
  const skippedItems = [];
  let failed = 0;
  let skipped = 0;
  let ran = 0;

  for (const g of GROUPS) {
    if (ONLY !== 'all' && g.only !== ONLY) continue;
    if (g.skipIf) {
      console.log(`\n⏭️  跳过 ${g.title}（--skip-prod）`);
      continue;
    }
    console.log(`\n══════ ${g.title} ══════`);
    for (const it of g.items) {
      // 环境预检
      let ready = true;
      let why = '';
      // needs.ports = 关卡依赖的多个端口（如 verify-forgot-view 同时要 5174 code 模式
      // + 5175 link 模式）；兼容旧的单端口 needs.port。任一没起 → 跳过，
      // 不让关卡带着缺失环境硬崩（uncaught 栈不是「断言红」，是环境噪音）。
      const ports = it.needs.ports || (it.needs.port ? [it.needs.port] : []);
      for (const p of ports) {
        if (!(await portUp(p))) {
          ready = false;
          why = `端口未就绪 ${p}`;
          break;
        }
      }
      if (ready && it.needs.dist && !existsSync(it.needs.dist)) {
        ready = false;
        why = `产物不存在 ${it.needs.dist}`;
      }
      if (!ready) {
        skipped++;
        skippedItems.push({ name: it.name, why });
        console.log(`  ⏭️  ${it.name.padEnd(28)} 跳过（${why}）`);
        continue;
      }
      ran++;
      const r = runOne(it);
      results.push(r);
      const mark = r.code === 0 ? '✅' : '❌';
      if (r.code !== 0) failed++;
      console.log(`  ${mark} ${r.name.padEnd(28)} exit=${r.code}`);
      if (r.code !== 0) console.log(`       ${r.tail || r.errTail || '（无输出）'}`);
    }
  }

  console.log('\n════════════════ 汇总 ════════════════');
  console.log(`  通过：${ran - failed} / 运行 ${ran} · 跳过 ${skipped}`);
  if (skipped > 0) {
    // 没验 ≠ 通过：跳过项逐个列出，不让它混在「通过」里
    console.log('  ⚠️  以下关卡**没有验证**（环境没就绪，不是通过）：');
    for (const s of skippedItems) console.log(`       - ${s.name}（${s.why}）`);
    console.log('  起环境：端口约定见本脚本头部 / VERIFY.md；prod 组先构建 dist-nopwa。');
  }
  if (failed > 0) {
    console.log(`  失败：${failed} 个关卡（见上 ❌）`);
    process.exit(1);
  }
  if (ran === 0) {
    console.log('  没有关卡真正运行 —— 环境未就绪（端口/产物都没起）');
    console.log('  起环境：先看 VERIFY.md 里的端口约定，串行起 dev / preview。');
    process.exit(3);
  }
  if (skipped > 0 && !ALLOW_SKIP) {
    console.log('  有跳过 → 退出码 4（默认把「没验」与「通过」分开；--allow-skip 回到旧语义）');
    process.exit(4);
  }
  console.log('  全部通过 ✅');
  process.exit(0);
}

main();
