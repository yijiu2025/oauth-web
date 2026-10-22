/**
 * env-guard 自身的行为测试（node --test）
 *
 * 「关卡的自检」自己也要被验证 —— 否则第一次真实触发可能就是线上红/绿误判。
 * 这里对每个 assert* 都覆盖**通过与失败两条路径**（失败路径是本模块存在的原因，
 * 最容易被写错成永远抛 / 永远不抛）。
 *
 * 跑法（verify-all 静态组第一项）：
 *   node --test e2e/lib/env-guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

import {
  assertRepoRoot,
  assertScanDir,
  assertDist,
  assertPort,
  EnvGuardError
} from './env-guard.mjs';

/** 建一个临时目录（用后即焚） */
function tmp() {
  return mkdtempSync(join(tmpdir(), 'env-guard-test-'));
}

test('assertRepoRoot：从 e2e/lib/ 推出含 oauth package.json 的仓根', () => {
  const root = assertRepoRoot(import.meta.url);
  // 被测契约是「靠 package.json 的 name 命中 oauth 推导仓根」，**不是目录名**：
  // CI checkout 目录 = repo 名（oauth-web），本地目录 = oauth21 —— 断言目录名
  // 会把测试绑死在本机路径上（2026-10-22 实测 CI 因此红，本地却绿）。
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.name, /oauth/i);
});

test('assertScanDir：存在的非空目录返回条目', () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, 'a.vue'), '');
    mkdirSync(join(dir, 'sub'));
    const entries = assertScanDir(dir, '测试目录');
    assert.ok(entries.includes('a.vue'));
    assert.ok(entries.includes('sub'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assertScanDir：目录不存在 → EnvGuardError（不是裸 ENOENT）', () => {
  const dir = join(tmp(), 'definitely-missing');
  assert.throws(() => assertScanDir(dir, '测试目录'), EnvGuardError);
});

test('assertScanDir：空目录 → EnvGuardError（期望集为 0 的根源）', () => {
  const dir = tmp();
  try {
    assert.throws(() => assertScanDir(dir, '测试目录'), (err) => {
      assert.ok(err instanceof EnvGuardError);
      assert.match(err.message, /为空/);
      return true;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assertDist：含 index.html 的新鲜产物通过', () => {
  const root = tmp();
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'a.ts'), ''); // 源码 mtime = 建目录时刻
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'index.html'), ''); // 产物晚于源码
    assert.equal(assertDist(join(root, 'dist'), join(root, 'src')), join(root, 'dist'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertDist：缺 index.html → EnvGuardError', () => {
  const root = tmp();
  try {
    mkdirSync(join(root, 'dist'));
    assert.throws(() => assertDist(join(root, 'dist'), join(root, 'src')), EnvGuardError);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertDist：产物旧于源码 → EnvGuardError（假绿口）', () => {
  const root = tmp();
  try {
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'dist'));
    const distHtml = join(root, 'dist', 'index.html');
    writeFileSync(distHtml, '');
    // 源码改成明显晚于产物的 mtime
    const srcFile = join(root, 'src', 'late.ts');
    writeFileSync(srcFile, '');
    const later = new Date(Date.now() + 60_000);
    utimesSync(srcFile, later, later);
    assert.throws(() => assertDist(join(root, 'dist'), join(root, 'src')), (err) => {
      assert.match(err.message, /陈旧/);
      return true;
    });
    // escape 通道：显式允许时放过
    assert.doesNotThrow(() => assertDist(join(root, 'dist'), join(root, 'src'), { allowStale: true }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertPort：真实 HTTP 服务 → 通过', async () => {
  const server = http.createServer((_req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await assertPort(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('assertPort：没人听的端口 → EnvGuardError（含地址）', async () => {
  // 先占后放：拿一个一定没人听的端口
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  await assert.rejects(() => assertPort(`http://127.0.0.1:${port}`), (err) => {
    assert.ok(err instanceof EnvGuardError);
    assert.match(err.message, /端口未就绪/);
    return true;
  });
});

test('assertPort：服务在但 500 → EnvGuardError（TCP 探活会发现不了的那类）', async () => {
  const server = http.createServer((_req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await assert.rejects(() => assertPort(`http://127.0.0.1:${port}`), (err) => {
      assert.match(err.message, /HTTP 500/);
      return true;
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
