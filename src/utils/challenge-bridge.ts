/**
 * 428（人机验证）→ 宿主桥
 *
 * 为什么要过桥：oauth21 既可以被**直接访问**，也会被后台用 iframe 嵌入（`/mini-login`）。
 * 被嵌入时它只是宿主页面里的一块，**没有能力自救**：
 *   · 挑战页是宿主的独立构建入口（`challenge.html`），iframe 里没有；
 *   · 428 的 `challengeUrl` 只是"被拦的那条请求的路径"（见后端 `engine/pipeline.js`），
 *     不是可打开的验证页地址 —— 拿它直接 `window.open` 只会再撞一次 428；
 *   · 验证要用 cookie 落在**后端 origin** 上，必须由宿主的挑战页去发起验证请求。
 *
 * 所以协议只有一句：被拦了就把消息抛给父窗口，由宿主决定怎么开验证页。
 *
 * === 协议 ===
 *   iframe → 宿主：`{ type: 'CHALLENGE_REQUIRED' }`
 *   （宿主验证完成、重载 iframe 后，若仍被拦会再次抛，宿主侧有连跳上限兜底，见
 *     `scaffold/src/api/http.ts` 的 `fw_challenge_hops`）
 *
 * 🔴 必须走 `postToParent` 而不是 `window.parent.postMessage(..., '*')`：
 *    父 origin 白名单校验在那一层（防恶意页面嵌入后骗取消息）。
 *
 * @author yijiu2025
 * @since 2026-11-10
 */
import { postToParent } from './parent';

/** 宿主侧识别的消息类型（与 scaffold `composables/useSsoLogin.ts` 对齐） */
const CHALLENGE_REQUIRED = 'CHALLENGE_REQUIRED';

/**
 * 去重窗口
 *
 * 一次页面加载里 428 往往成串出现（h5-token 预取 + 首个业务请求 + 并发的菜单/用户
 * 请求）。每条都通知等于让宿主收到一串相同的跳转指令 —— 宿主侧虽然有连跳上限，
 * 但会被这些同批消息把配额瞬间耗光（3 条就固化"验证未生效"的错误态）。
 */
const DEDUPE_MS = 5000;

/** 上次通知时间（模块级：整页导航后自然归零，正好对应"新一轮加载"） */
let lastNotifiedAt = 0;

/**
 * 通知宿主「需要人机验证」
 *
 * 非 iframe 环境、或父 origin 不在白名单时静默无副作用（`postToParent` 自己挡掉）。
 */
function notifyHostChallengeRequired(): void {
  const now = Date.now();
  if (now - lastNotifiedAt < DEDUPE_MS) return;
  lastNotifiedAt = now;
  postToParent({ type: CHALLENGE_REQUIRED });
}

export { CHALLENGE_REQUIRED, notifyHostChallengeRequired };
