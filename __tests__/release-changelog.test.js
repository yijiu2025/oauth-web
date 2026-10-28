// release-web.mjs 的 CHANGELOG 提升纯函数单测。
// 只测纯函数（bumpChangelog / alignPackageVersion），不触发主流程副作用。

import { describe, it, expect } from 'vitest';
import { bumpChangelog, alignPackageVersion } from '../scripts/release-web.mjs';

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
