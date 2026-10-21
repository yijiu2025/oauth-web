/**
 * env 四文件一致性机检的自身行为测试（node --test）
 *
 * 与 env-guard.test.mjs 同一思路：机检第一次真实触发就是真实判红/判绿，
 * 判定函数写错比没有机检更糟（会用自信的语气把对的判成错的）。这里对
 * parseEnvKeys / compareEnvFiles 的每条判定路径都覆盖**通过与失败**两侧。
 *
 * 跑法（verify-all 静态组）：
 *   node --test e2e/verify-env-files.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvKeys, compareEnvFiles } from './verify-env-files.mjs';

/* ---------------------------------------------------------------------------
 * parseEnvKeys：解析
 * ------------------------------------------------------------------------- */

test('parseEnvKeys：注释与空行跳过，键按出现序收集', () => {
  const content = [
    '# 顶层注释（section 标题）',
    '',
    '# VITE_A 的注释',
    'VITE_A=1',
    'VITE_B=x',
    '# 尾注',
  ].join('\n');
  const out = parseEnvKeys(content);
  assert.deepEqual(out.map((e) => e.key), ['VITE_A', 'VITE_B']);
});

test('parseEnvKeys：hasComment 只认紧邻的连续注释块（空行隔断不算）', () => {
  const content = [
    '# A 上方注释',
    '# 第二行注释',
    'VITE_A=1',
    '# 空行下面的注释属于下一个 section，不属于 VITE_B',
    '',
    'VITE_B=2',
  ].join('\n');
  const out = parseEnvKeys(content);
  assert.equal(out[0].hasComment, true);
  assert.equal(out[1].hasComment, false);
});

test('parseEnvKeys：CRLF 与值里再带 = 都正确吃下', () => {
  const content = '# 注释\r\nVITE_API_BASE_URL=https://a.b/api?a=1&b=2\r\n';
  const out = parseEnvKeys(content);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 'VITE_API_BASE_URL');
  assert.equal(out[0].hasComment, true);
});

test('parseEnvKeys：重复键如实保留（交由 compareEnvFiles 判红）', () => {
  const out = parseEnvKeys('VITE_A=1\nVITE_A=2\n');
  assert.deepEqual(out.map((e) => e.key), ['VITE_A', 'VITE_A']);
});

test('parseEnvKeys：空内容 → 空列表', () => {
  assert.deepEqual(parseEnvKeys(''), []);
  assert.deepEqual(parseEnvKeys('# 只有注释\n\n'), []);
});

/* ---------------------------------------------------------------------------
 * compareEnvFiles：比对
 * ------------------------------------------------------------------------- */

/** 便捷构造：从 [key, hasComment] 对数组造 files 形参 */
function filesOf(spec) {
  return spec.map(([name, keys]) => ({
    name,
    entries: keys.map((k) => ({ key: k, hasComment: false })),
  }));
}

test('compareEnvFiles：完全一致（同键同序）→ 空问题清单', () => {
  const files = filesOf([
    ['.env', ['VITE_A', 'VITE_B']],
    ['.env.development', ['VITE_A', 'VITE_B']],
  ]);
  assert.deepEqual(compareEnvFiles(files), []);
});

test('compareEnvFiles：少于两个文件无从比起 → 空（不误报）', () => {
  const files = filesOf([['.env', ['VITE_A']]]);
  assert.deepEqual(compareEnvFiles(files), []);
});

test('compareEnvFiles：少键 → 报缺（静默失败模式：读到的是别的文件的默认值）', () => {
  const files = filesOf([
    ['.env', ['VITE_A', 'VITE_B']],
    ['.env.production', ['VITE_A']],
  ]);
  const problems = compareEnvFiles(files);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\.env\.production：缺少键「VITE_B」/);
});

test('compareEnvFiles：多键 → 报多', () => {
  const files = filesOf([
    ['.env', ['VITE_A']],
    ['.env.production', ['VITE_A', 'VITE_NEW']],
  ]);
  const problems = compareEnvFiles(files);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /多出键「VITE_NEW」/);
});

test('compareEnvFiles：共有键换序 → 报顺序漂移', () => {
  const files = filesOf([
    ['.env', ['VITE_A', 'VITE_B', 'VITE_C']],
    ['.env.production', ['VITE_A', 'VITE_C', 'VITE_B']],
  ]);
  const problems = compareEnvFiles(files);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /相对顺序与 \.env 不一致/);
});

test('compareEnvFiles：文件内重复键 → 报重复（后者静默覆盖前者）', () => {
  const files = filesOf([
    ['.env', ['VITE_A', 'VITE_A']],
    ['.env.production', ['VITE_A']],
  ]);
  const problems = compareEnvFiles(files);
  // 只报 1 条重复 —— 回归：曾把 [A,A] vs [A] 误判成「顺序漂移」报出第 2 条，
  // 同一根因报两条是噪声（会掩护真红）；重复由 ① 管，顺序比对必须先去重
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\.env：键「VITE_A」重复定义/);
});

test('compareEnvFiles：非 VITE_ 前缀 → 报键形（Vite 静默不暴露，写了等于没写）', () => {
  const files = filesOf([
    ['.env', ['VITE_A', 'APP_SECRET']],
    ['.env.production', ['VITE_A', 'APP_SECRET']],
  ]);
  const problems = compareEnvFiles(files);
  // 两个文件都有坏键 → 各报一条（逐个文件点名，不让「另一个文件也一样」蒙混）
  assert.equal(problems.length, 2);
  assert.ok(problems.every((p) => /「APP_SECRET」不是 VITE_ 前缀/.test(p)));
  assert.ok(problems.some((p) => p.startsWith('.env：')));
  assert.ok(problems.some((p) => p.startsWith('.env.production：')));
});

test('compareEnvFiles：多个问题类型可同时报出（不互相掩盖）', () => {
  const files = filesOf([
    ['.env', ['VITE_A', 'VITE_B']],
    ['.env.production', ['VITE_B', 'VITE_A', 'vite_lower']],
  ]);
  const problems = compareEnvFiles(files);
  // 顺序漂移 1 + 多出键 1 + 键形 1 = 3（无少键/重复）
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => /相对顺序/.test(p)));
  assert.ok(problems.some((p) => /多出键「vite_lower」/.test(p)));
  assert.ok(problems.some((p) => /「vite_lower」不是 VITE_ 前缀/.test(p)));
});
