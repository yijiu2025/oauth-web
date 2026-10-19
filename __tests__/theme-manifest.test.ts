/**
 * 主题清单（`theme.config.ts`）契约测试
 *
 * === 为什么这里只有 debug 开关，没有「路径 → 页面」一致性关卡 ===
 * 早先清单里有 `routes`（哪条路径算哪个页面），需要和页面注册表做机械比对防漂移。
 * 现在页面身份由 `<ThemeView page="...">` **显式传入**（容器文件位置即身份），不再
 * 从路径反推；「路径 → 页面」的映射归 router（路由表由 `listPageViews()` 自动生成）。
 * 于是清单只剩 `debug` 开关，那条「两套东西描述同一件事必漂移」的一致性关卡也随之消失。
 *
 * @author yijiu2025
 * @since 2026-10-17（2026-10-18 移除 routes 一致性关卡）
 */
import { describe, expect, it } from 'vitest';
import { defineThemeManifest, isThemeDebugVisible } from 'skinsuite';
import { themeManifest } from 'virtual:theme';

describe('主题清单契约（内核）', () => {
  it('debug.enabled 只接受三档，写错在声明期就抛', () => {
    expect(() => defineThemeManifest({ debug: { enabled: 'always' } })).not.toThrow();
    expect(() =>
      // @ts-expect-error 故意给非法值：这条断言守的是运行时校验，不是类型
      defineThemeManifest({ debug: { enabled: 'never' } })
    ).toThrow(/debug\.enabled/);
  });

  it('调试开关三档语义', () => {
    const url = defineThemeManifest({ debug: { enabled: 'url' } }).debug;
    expect(isThemeDebugVisible(url, { debug: 'theme' })).toBe(true);
    // 数组形态（?debug=theme&debug=other）：任一命中即可
    expect(isThemeDebugVisible(url, { debug: ['other', 'theme'] })).toBe(true);
    expect(isThemeDebugVisible(url, {})).toBe(false);
    expect(isThemeDebugVisible(url, { debug: 'other' })).toBe(false);

    expect(isThemeDebugVisible({ ...url, enabled: 'off' }, { debug: 'theme' })).toBe(false);
    expect(isThemeDebugVisible({ ...url, enabled: 'always' }, {})).toBe(true);
  });

  it('主题目录里有清单（virtual:theme 自动装配出默认档）', () => {
    expect(themeManifest).toBeDefined();
    expect(themeManifest.debug.enabled).toBe('url');
  });
});
