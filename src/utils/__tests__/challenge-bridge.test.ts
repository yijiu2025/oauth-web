/**
 * `challenge-bridge` —— 428 通知宿主的桥接测试
 *
 * 这段代码的自救能力为零：宿主收不到消息 = 登录页被 428 卡死且没有任何提示。
 * 所以判据必须是「**真的往父窗口发了、且只发一次、且只发给白名单父 origin**」，
 * 而不是"函数被调用了"。
 *
 * 手法：伪造 `window.parent`（happy-dom 顶层窗口 `parent === window`，不伪造就只会
 * 走 early-return 分支，测试会假绿）+ 伪造 `document.referrer` 提供父 origin，
 * 然后对替身父窗口的 `postMessage` 做真实断言。
 *
 * 去重窗口用假时钟推进（真等 5 秒会让单测变成 sleep）。
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

/** 白名单内的父 origin（dev 兜底值，见 parent-origins.ts 的 DEV_FALLBACK） */
const TRUSTED_PARENT = 'http://localhost:5176';

/**
 * 装一个"父窗口"替身，并让当前窗口处于 iframe 环境
 *
 * @returns 收消息的替身（`postMessage` 已换为 spy）
 */
function installFakeParent(referrer = `${TRUSTED_PARENT}/login`): { postMessage: ReturnType<typeof vi.fn> } {
  const fakeParent = { postMessage: vi.fn() };
  Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true });
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
  // ancestorOrigins 优先于 referrer：happy-dom 没有该字段，显式清掉避免其它用例残留
  Object.defineProperty(window.location, 'ancestorOrigins', { value: [], configurable: true });
  return fakeParent;
}

/** 每个用例都要拿到全新的模块（去重计是模块级状态） */
async function loadBridge(): Promise<typeof import('@/utils/challenge-bridge')> {
  vi.resetModules();
  return import('@/utils/challenge-bridge');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
});

describe('notifyHostChallengeRequired —— iframe 被 428 拦下时通知宿主', () => {
  test('向白名单内的父窗口发 CHALLENGE_REQUIRED，且 targetOrigin 是父 origin（不是 *）', async () => {
    const parent = installFakeParent();
    const { CHALLENGE_REQUIRED, notifyHostChallengeRequired } = await loadBridge();

    notifyHostChallengeRequired();

    expect(CHALLENGE_REQUIRED).toBe('CHALLENGE_REQUIRED');
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'CHALLENGE_REQUIRED' }, TRUSTED_PARENT);
  });

  test('同一轮加载里的成串 428 只通知一次（否则会瞬间耗光宿主的连跳上限）', async () => {
    const parent = installFakeParent();
    const { notifyHostChallengeRequired } = await loadBridge();

    // h5-token 预取 + 首个业务请求 + 并发菜单请求：真实场景一次加载就会有 3~5 条
    notifyHostChallengeRequired();
    notifyHostChallengeRequired();
    notifyHostChallengeRequired();

    expect(parent.postMessage).toHaveBeenCalledTimes(1);
  });

  test('去重窗口过后可以再次通知（验证没生效时宿主还能收到第二轮）', async () => {
    const parent = installFakeParent();
    const { notifyHostChallengeRequired } = await loadBridge();

    notifyHostChallengeRequired();
    vi.advanceTimersByTime(5001);
    notifyHostChallengeRequired();

    expect(parent.postMessage).toHaveBeenCalledTimes(2);
  });

  test('父 origin 不在白名单：一条都不发（防恶意页面嵌入后骗取跳转指令）', async () => {
    const parent = installFakeParent('http://evil.example.com/steal');
    const { notifyHostChallengeRequired } = await loadBridge();

    notifyHostChallengeRequired();

    expect(parent.postMessage).not.toHaveBeenCalled();
  });
});
