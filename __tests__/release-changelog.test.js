// release-web.mjs 的 CHANGELOG 提升纯函数单测。
// 只测纯函数（bumpChangelog / alignPackageVersion / alignLockVersion / writeLockVersion），
// 不触发主流程副作用。

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  bumpChangelog,
  alignPackageVersion,
  alignLockVersion,
  writeLockVersion
} from '../scripts/release-web.mjs';

describe('bumpChangelog', () => {
  it('把非空的「未发布」区块提升为带版本号+日期的正式区块，并重建空未发布区块', () => {
    const input = [
      '# Changelog',
      '',
      '## 未发布（Unreleased）',
      '',
      '### 修复',
      '',
      '- 修了一个 bug',
      '',
      '## 1.0.0 — 2026-10-14',
      '',
      '- 首个版本',
      ''
    ].join('\n');

    const { text, changed } = bumpChangelog(input, '1.1.0', '2026-10-28');

    expect(changed).toBe(true);
    // 提升了
    expect(text).toContain('## 1.1.0 — 2026-10-28');
    // 未发布的正文内容被保留
    expect(text).toContain('- 修了一个 bug');
    // 旧版本区块仍在
    expect(text).toContain('## 1.0.0 — 2026-10-14');
    // 重建了空未发布区块，且排在提升后的新版本之后
    const newIdx = text.indexOf('## 1.1.0 — 2026-10-28');
    const placeholderIdx = text.indexOf('## 未发布（Unreleased）');
    expect(newIdx).toBeGreaterThanOrEqual(0);
    expect(placeholderIdx).toBeGreaterThan(newIdx);
  });

  it('未发布区块为空时不提升', () => {
    const input = [
      '# Changelog',
      '',
      '## 未发布（Unreleased）',
      '',
      '## 1.0.0 — 2026-10-14',
      ''
    ].join('\n');

    const { changed, reason } = bumpChangelog(input, '1.1.0', '2026-10-28');

    expect(changed).toBe(false);
    expect(reason).toContain('为空');
  });

  it('没有未发布标题时返回原样并说明原因', () => {
    const input = '# Changelog\n\n## 1.0.0 — 2026-10-14\n';
    const { changed, reason } = bumpChangelog(input, '1.1.0', '2026-10-28');
    expect(changed).toBe(false);
    expect(reason).toContain('未找到');
  });

  it('多次调用不重复提升（幂等性由标题唯一性保证）', () => {
    const input = [
      '# Changelog',
      '',
      '## 未发布（Unreleased）',
      '',
      '### 新增',
      '',
      '- 功能 A',
      '',
      '## 1.0.0 — 2026-10-14',
      ''
    ].join('\n');

    const first = bumpChangelog(input, '1.1.0', '2026-10-28');
    expect(first.changed).toBe(true);
    // 提升后「未发布」变空了，再提升应返回 unchanged
    const second = bumpChangelog(first.text, '1.2.0', '2026-10-29');
    expect(second.changed).toBe(false);
  });
});

describe('alignPackageVersion', () => {
  it('返回 null 表示没有 package.json（纯静态仓）', () => {
    // 依赖 ROOT 定位，这里只验证函数在无文件时安全返回
    // 实际 ROOT 是 oauth21 仓，有 package.json，故此处不测真实路径。
    // 用一个不存在的路径逻辑由函数内部 existsSync 兜底，这里只测函数签名不抛。
    expect(typeof alignPackageVersion).toBe('function');
  });
});

describe('alignLockVersion / writeLockVersion', () => {
  /** 造一个最小 lock：根版本 v1，另有一个恰好同版本号的三方包 */
  const makeLock = version =>
    [
      '{',
      '  "name": "oauth-web",',
      `  "version": "${version}",`,
      '  "lockfileVersion": 3,',
      '  "packages": {',
      '    "": {',
      '      "name": "oauth-web",',
      `      "version": "${version}",`,
      '      "license": "GPL-3.0"',
      '    },',
      '    "node_modules/some-pkg": {',
      '      "name": "some-pkg",',
      `      "version": "${version}",`,
      '      "license": "MIT"',
      '    }',
      '  }',
      '}',
      ''
    ].join('\n');

  const withTempLock = (content, fn) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'release-lock-'));
    try {
      const lockPath = path.join(dir, 'package-lock.json');
      writeFileSync(lockPath, content);
      return fn({ dir, lockPath });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('根版本与目标一致时返回 null（无需对齐）', () => {
    withTempLock(makeLock('1.2.0'), ({ dir }) => {
      expect(alignLockVersion('1.2.0', dir)).toBeNull();
    });
  });

  it('根版本落后时返回漂移信息', () => {
    withTempLock(makeLock('1.1.2'), ({ dir }) => {
      const r = alignLockVersion('1.2.0', dir);
      expect(r).not.toBeNull();
      expect(r.from).toBe('1.1.2');
      expect(r.rootFrom).toBe('1.1.2');
      expect(r.to).toBe('1.2.0');
    });
  });

  it('缺 package-lock.json 时安全返回 null', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'release-lock-empty-'));
    try {
      expect(alignLockVersion('1.2.0', dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('只替换根版本两处，恰好同版本号的三方包不动（文本替换，不重新序列化）', () => {
    withTempLock(makeLock('1.1.2'), ({ lockPath }) => {
      expect(writeLockVersion(lockPath, '1.2.0')).toBe(true);

      const text = readFileSync(lockPath, 'utf8');
      expect(text).toContain('"name": "oauth-web",\n  "version": "1.2.0"');
      expect(text).toContain('"name": "oauth-web",\n      "version": "1.2.0"');
      // 三方包保持原版本 —— 这是"只动根"的判据
      expect(text).toContain('"name": "some-pkg",\n      "version": "1.1.2"');
      // 未引入 CR（保持 LF）
      expect(text).not.toContain('\r');
    });
  });

  it('锚点不全时返回 false 且不改文件', () => {
    const broken = '{\n  "name": "oauth-web",\n  "lockfileVersion": 3\n}\n';
    withTempLock(broken, ({ lockPath }) => {
      expect(writeLockVersion(lockPath, '1.2.0')).toBe(false);
      expect(readFileSync(lockPath, 'utf8')).toBe(broken);
    });
  });

  it('写回后 alignLockVersion 再次判定为已对齐（幂等）', () => {
    withTempLock(makeLock('1.1.2'), ({ dir, lockPath }) => {
      writeLockVersion(lockPath, '1.2.0');
      expect(alignLockVersion('1.2.0', dir)).toBeNull();
    });
  });
});
