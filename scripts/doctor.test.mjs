/**
 * doctor 自身的行为测试（node --test）
 *
 * 「预检门诊」自己也要被验证 —— 判定函数写错（永远抛 / 永远不抛 / 边界判反）
 * 比没有预检更糟：它会用自信的语气把人带偏。这里只测**纯函数**
 * （版本 / 端口分类 / 缓存分类 / 形态判定 / env 文件），真 IO 探活不测
 * （由 --only static 的实跑覆盖）。
 *
 * 跑法（verify-all 静态组）：
 *   node --test scripts/doctor.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseVersion,
  satisfies,
  classifyPort,
  classifyViteCache,
  detectSkinsuiteForm,
  checkEnvFiles
} from './doctor.mjs';

/* ---- parseVersion ------------------------------------------------------- */

test('parseVersion：v 前缀 / 缺段 / 非法值', () => {
  assert.deepEqual(parseVersion('22.22.2'), [22, 22, 2]);
  assert.deepEqual(parseVersion('v20.18.1'), [20, 18, 1]);
  assert.deepEqual(parseVersion('22'), [22, 0, 0]);
  assert.deepEqual(parseVersion('22.5'), [22, 5, 0]);
  assert.equal(parseVersion('abc'), null);
  assert.equal(parseVersion(null), null);
  assert.equal(parseVersion(undefined), null);
});

/* ---- satisfies ---------------------------------------------------------- */

test('satisfies：>= 范围两边界', () => {
  assert.equal(satisfies('20.0.0', '>=20'), true);
  assert.equal(satisfies('22.22.2', '>=20'), true);
  assert.equal(satisfies('19.9.9', '>=20'), false);
});

test('satisfies：^ 与 ~ 的区间边界', () => {
  assert.equal(satisfies('20.1.5', '^20.1.0'), true);
  assert.equal(satisfies('21.0.0', '^20.1.0'), false); // major 跳出版本不满足
  assert.equal(satisfies('20.2.0', '~20.1.0'), false); // minor 跳出不满足
  assert.equal(satisfies('20.1.9', '~20.1.0'), true);
});

test('satisfies：精确匹配与判不了的范围（宁可误报不漏报）', () => {
  assert.equal(satisfies('20.1.0', '20.1.0'), true);
  assert.equal(satisfies('20.1.1', '20.1.0'), false);
  assert.equal(satisfies('20.1.0', '<21'), false); // 不支持的 range 一律不满足
  assert.equal(satisfies('20.1.0', '20 || 22'), false);
});

/* ---- classifyPort ------------------------------------------------------- */

test('classifyPort：三态分类', () => {
  assert.equal(classifyPort({ httpOk: true, tcpOk: true }), 'up');
  assert.equal(classifyPort({ httpOk: true, tcpOk: false }), 'up'); // HTTP 就绪即就绪
  assert.equal(classifyPort({ httpOk: false, tcpOk: true }), 'busy'); // 被占且非 HTTP
  assert.equal(classifyPort({ httpOk: false, tcpOk: false }), 'free');
});

/* ---- classifyViteCache -------------------------------------------------- */

test('classifyViteCache：四态分类（temp-only 是 504 白屏已知成因）', () => {
  assert.equal(classifyViteCache(null), 'missing');
  assert.equal(classifyViteCache(['deps', 'deps_temp_abc']), 'ok');
  assert.equal(classifyViteCache(['deps']), 'ok');
  assert.equal(classifyViteCache(['deps_temp_abc']), 'temp-only');
  assert.equal(classifyViteCache([]), 'empty');
  assert.equal(classifyViteCache(['some-other-dir']), 'empty');
});

/* ---- detectSkinsuiteForm ------------------------------------------------- */

/** 假 fs：按 existing 集合回答存在性 */
const fakeExists =
  (existing) =>
  (p) =>
    existing.has(p.replace(/\\/g, '/'));

const ROOTS = {
  monorepoRoot: '/repo',
  installedRoots: ['/repo/node_modules', '/repo/oauth21/node_modules']
};

test('detectSkinsuiteForm：monorepo 优先（与 aliases.ts 注册顺序一致）', () => {
  const exists = fakeExists(
    new Set([
      '/repo/packages/theme-core/src/index.ts',
      '/repo/packages/shared-device/src/index.ts',
      '/repo/node_modules/skinsuite/src/index.ts' // 装了也认 monorepo
    ])
  );
  const r = detectSkinsuiteForm(exists, ROOTS);
  assert.equal(r.form, 'monorepo');
  assert.deepEqual(r.warnings, []);
});

test('detectSkinsuiteForm：无 packages 源码 → 独立仓形态', () => {
  const exists = fakeExists(new Set(['/repo/oauth21/node_modules/skinsuite/src/index.ts']));
  const r = detectSkinsuiteForm(exists, ROOTS);
  assert.equal(r.form, 'installed');
  assert.deepEqual(r.warnings, []);
});

test('detectSkinsuiteForm：两处都没有 → broken', () => {
  const r = detectSkinsuiteForm(fakeExists(new Set()), ROOTS);
  assert.equal(r.form, 'broken');
});

test('detectSkinsuiteForm：packages/ 在但 theme-core 源码缺失 → 回落警告（submodule 未初始化）', () => {
  const exists = fakeExists(
    new Set(['/repo/packages', '/repo/node_modules/skinsuite/src/index.ts'])
  );
  const r = detectSkinsuiteForm(exists, ROOTS);
  assert.equal(r.form, 'installed');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /submodule 未初始化/);
});

test('detectSkinsuiteForm：monorepo 下 shared-device 缺失 → 提示回落', () => {
  const exists = fakeExists(new Set(['/repo/packages/theme-core/src/index.ts']));
  const r = detectSkinsuiteForm(exists, ROOTS);
  assert.equal(r.form, 'monorepo');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /stable-deviceid 回落/);
});

/* ---- checkEnvFiles ------------------------------------------------------- */

test('checkEnvFiles：四文件齐 → 全 ok', () => {
  const rs = checkEnvFiles((n) => ['.env', '.env.development', '.env.production', '.env.example'].includes(n));
  assert.equal(rs.length, 4);
  assert.ok(rs.every((r) => r.status === 'ok'));
});

test('checkEnvFiles：.env 缺 → warn（不入库，补一份即可）；入库文件缺 → fail', () => {
  const rs = checkEnvFiles((n) => n === '.env.development' || n === '.env.example');
  const byName = Object.fromEntries(rs.map((r) => [r.name, r.status]));
  assert.equal(byName['.env'], 'warn');
  assert.equal(byName['.env.production'], 'fail');
  assert.equal(byName['.env.development'], 'ok');
});
