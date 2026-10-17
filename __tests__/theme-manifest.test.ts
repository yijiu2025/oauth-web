/**
 * 主题清单 × 页面注册表的**一致性关卡**
 *
 * === 为什么需要它 ===
 * 清单里的 `routes` 是"投影"，路由本身仍由 `src/router/` 与页面注册表生成 ——
 * 两套东西描述同一件事（这条路径是哪一页），就必然会漂移。漂移的症状是**静默的**：
 *   · 页面加了但清单没加 → 该页调试面板认不出页面（版式/颜色区整块空）
 *   · 清单加了但页面没加 → 投影指向一个不存在的页面，面板读到半截状态
 * 两种都不会报错。所以这里做机械比对：**加法忘了一处，CI 直接红**。
 *
 * === 为什么是单测而不是 e2e 脚本 ===
 * 判据要同时拿到"清单"（虚拟模块 `virtual:theme`）与"页面注册表"（`import.meta.glob`
 * 扫出来的页面对象）。后者只有跑在 Vite 里才能求值 —— 裸 Node 脚本拿不到，
 * 而 vitest 已经挂了同一个 `themeAssets()` 插件，天然是同一份真相。
 *
 * === 判据来源（不要手抄清单）===
 * 页面集合来自 `listPageViews()`（= `src/theme/views/*.ts` 里带 `isThemePage` 标记的模块），
 * 路由集合来自 `themeManifest.routes`。两边都不在这里枚举，**加一页不必改本文件**。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { describe, expect, it } from 'vitest';
import { defineThemeManifest, isThemeDebugVisible, resolveThemePage } from 'skinsuite';
import { themeManifest } from '@/theme-manifest';
import { listPageViews, pageFromPath } from '@/theme/views/pages';

const pages = listPageViews();
const pageNames = pages.map(pv => pv.page);

describe('主题清单契约（内核）', () => {
  it('debug.enabled 只接受三档，写错在声明期就抛', () => {
    expect(() => defineThemeManifest({ debug: { enabled: 'always' } })).not.toThrow();
    expect(() =>
      // @ts-expect-error 故意给非法值：这条断言守的是运行时校验，不是类型
      defineThemeManifest({ debug: { enabled: 'never' } })
    ).toThrow(/debug\.enabled/);
  });

  it('routes 的 path 必须以 / 开头，page 不能为空，且不允许重复声明', () => {
    expect(() => defineThemeManifest({ routes: [{ path: 'login', page: 'login' }] })).toThrow(
      /必须以 \/ 开头/
    );
    expect(() => defineThemeManifest({ routes: [{ path: '/login', page: ' ' }] })).toThrow(
      /缺少 page/
    );
    expect(() =>
      defineThemeManifest({
        routes: [
          { path: '/login', page: 'login' },
          { path: '/login', page: 'register' }
        ]
      })
    ).toThrow(/重复声明/);
  });

  it('静态段多的规则优先：/mini-login 胜过 /:page', () => {
    const routes = [
      { path: '/:page', page: ':page' },
      { path: '/mini-login', page: 'login' }
    ];
    expect(resolveThemePage(routes, '/mini-login')).toBe('login');
    expect(resolveThemePage(routes, '/register')).toBe('register');
  });

  it('参数段会替换进 page，且段数不等不命中', () => {
    const routes = [{ path: '/m/:page', page: ':page' }];
    expect(resolveThemePage(routes, '/m/register')).toBe('register');
    expect(resolveThemePage(routes, '/m/register/extra')).toBeNull();
    expect(resolveThemePage(routes, '/register')).toBeNull();
    // query / hash 不参与匹配
    expect(resolveThemePage(routes, '/m/login?client_id=abc#top')).toBe('login');
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
});

describe('主题清单 × 页面注册表', () => {
  it('主题目录里有清单（缺了就退化成"面板认不出任何页面"）', () => {
    expect(themeManifest.routes.length).toBeGreaterThan(0);
  });

  it('每个页面都有 /<页面> 与 /m/<页面> 两条投影', () => {
    const missing: string[] = [];
    for (const page of pageNames) {
      for (const path of [`/${page}`, `/m/${page}`]) {
        if (resolveThemePage(themeManifest.routes, path) !== page) missing.push(`${path} → ${page}`);
      }
    }
    expect(missing, `清单缺投影（新增页面时忘了改 theme.config.ts？）：${missing.join('、')}`).toEqual(
      []
    );
  });

  it('清单里的静态 page 都真实存在（否则投影指向幽灵页面）', () => {
    const ghosts: string[] = [];
    for (const rule of themeManifest.routes) {
      // 参数段页面（`:page`）由路径捕获决定，无法静态校验
      if (rule.page.includes(':')) continue;
      if (!pageNames.includes(rule.page)) ghosts.push(`${rule.path} → ${rule.page}`);
    }
    expect(ghosts, `清单声明了不存在的页面：${ghosts.join('、')}`).toEqual([]);
  });

  it('pageFromPath 只认清单，且不认未接入版式机制的页面名', () => {
    expect(pageFromPath('/login')).toBe('login');
    expect(pageFromPath('/m/register')).toBe('register');
    // mini 设备的独立入口：路径与页面不同名，旧"末段猜测"靠剥 mini- 前缀，现在靠声明
    expect(pageFromPath('/mini-login')).toBe('login');
    // 清单里没有这条路径 → 不猜（旧实现的"末段猜测"会在这里乱认）
    expect(pageFromPath('/authorize')).toBeUndefined();
    expect(pageFromPath('/not-a-page')).toBeUndefined();
  });
});
