/**
 * `isAllowedParentOrigin` 父 origin 白名单测试
 *
 * 真实加载 `@/utils/parent-origins`，覆盖白名单判定与 `parseAllowedOrigins` 纯函数
 * （trim / 空项过滤 / 显式空串 = 拒绝一切）。白名单值来自 `VITE_ALLOWED_PARENT_ORIGINS`
 * （未定义时 dev 回落 DEV_FALLBACK、prod 为空集），解析逻辑抽成纯函数后可直接单测，
 * 不再依赖 env 取值（旧测试删掉 trim 也照样绿）。
 */
import { describe, expect, test } from 'vitest';
import {
  isAllowedParentOrigin,
  getParentOrigin,
  parseAllowedOrigins,
  ALLOWED_PARENT_ORIGINS
} from '@/utils/parent-origins';

describe('isAllowedParentOrigin —— 父应用 origin 白名单', () => {
  test('白名单内的 origin 命中', () => {
    // 测试环境（dev）至少含一条 DEV_FALLBACK；先断言非空，避免白名单意外为空时零断言通过
    expect(ALLOWED_PARENT_ORIGINS.length).toBeGreaterThan(0);
    expect(isAllowedParentOrigin(ALLOWED_PARENT_ORIGINS[0])).toBe(true);
  });

  test('白名单外的 origin 不命中', () => {
    expect(isAllowedParentOrigin('https://evil.example.com')).toBe(false);
  });

  test('空值 / null / undefined 一律不命中且类型收窄为 string', () => {
    expect(isAllowedParentOrigin('')).toBe(false);
    expect(isAllowedParentOrigin(null)).toBe(false);
    expect(isAllowedParentOrigin(undefined)).toBe(false);
  });

  test('getParentOrigin：无父窗口（无 ancestorOrigins 且无 referrer）时返回 null', () => {
    expect(getParentOrigin()).toBeNull();
  });
});

describe('parseAllowedOrigins —— 白名单解析（纯函数）', () => {
  test('逗号空格 / 空项会被 trim + 过滤', () => {
    expect(parseAllowedOrigins(' http://a.test , ,http://b.test, ', 'http://fb')).toEqual([
      'http://a.test',
      'http://b.test'
    ]);
  });

  test('显式空串 = 白名单为空（不回落到 dev 兜底，生产安全）', () => {
    expect(parseAllowedOrigins('', 'http://fb')).toEqual([]);
  });

  test('undefined 才回落 devFallback（dev 兜底语义）', () => {
    expect(parseAllowedOrigins(undefined, 'http://fb1,http://fb2')).toEqual([
      'http://fb1',
      'http://fb2'
    ]);
  });
});
