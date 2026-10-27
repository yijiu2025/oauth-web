/**
 * 版式（UI）优先级验收 —— 四档链 + 设备维度键 + 三页同形
 *
 * === 四档（高 → 低，login / register / forgot-password 三页一致）===
 *   1. URL `?th_<设备缩写>`   —— 设备专属（如 `th_mobile`；容器用 `readDeviceParam` 取，见 skinsuite 的 views/params.ts）
 *   2. URL `?th`              —— 通用键（三端共用）
 *   3. 主题包 / 配色的 `views.<page>` 声明（`themeStore.viewFor(<page>)` 取出）
 *   4. 当前**包名**          —— 一个主题包 = 一种版式（`viewId ≡ pkg`，不再是 `'base'`）
 *
 * === 两条硬规则 ===
 *   🔴 空串 / 纯空白 = **未指定**：`?th_mobile=` 不能把 `?th=compact` 顶掉。
 *   🔴 URL 显式非法值**不回退**到第 3 档：落**当前包**（`?th=typo` → 当前包），
 *      否则"参数写错"会静默换成另一套 UI，比看到当前包的版式难排查得多。
 *
 * === 本脚本能控制什么、不能控制什么（别装作验过）===
 *   • 第 1/2/4 档 + 上面两条规则：只靠 URL 就能验 → 主实例（默认 5174）跑。
 *   • 第 3 档（声明）：本仓三个包**都没有**声明 `views` ⇒ 浏览器侧只能验"不误伤"。
 *     "声明真的生效"由 `verify-theme-dirs.mjs` §12 从实现口径守（三页 pick* 都接收
 *     `source.theme`、三个容器都传 `theme: themeStore.viewFor(<page>)`）。
 *
 * === 取值方式 ===
 *   版式身份读 DOM（版式根上的 `data-mauth-view`，值 = 主题包名）；
 *   设备读调试出口 `window.__MAUTH_STORE__.activeDevice`（需 `?debug=theme`，
 *   且必须等 store **落定** —— 它挂在 store setup 里，那一刻 activeDevice 还是初值）。
 *
 * 用法: node verify-view-priority.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { requirePort } from './lib/env-guard.mjs';

const argv = process.argv.slice(2);
const BASE = argv.find(a => !a.startsWith('--')) || 'http://127.0.0.1:5174';
await requirePort(BASE); // 环境自检：端口没起 / 5xx 时在此红（退出码 2），不进 Playwright 超时地狱
const QS = '?appName=posecraft&client_id=demo-client-001&debug=theme';

/** 三个设备的视口（判定：宽(≥1024) ＞ 窄(<768) ＞ UA —— 必须**先造视口再导航**） */
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const COMPACT = { width: 480, height: 860 };

let pass = 0;
const fails = [];
const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}${extra ? `  ${extra}` : ''}`);
  } else {
    fails.push(name);
    console.log(`  ❌ ${name}${extra ? `  ${extra}` : ''}`);
  }
};

const { resolveChromePath } = await import('./lib/chrome.mjs');
const CHROME = resolveChromePath();
if (!CHROME) {
  console.error('❌ 找不到 Chrome/Chromium：请设 CHROME_PATH 环境变量指向 chrome 可执行文件');
  process.exit(2);
}
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true
});

/**
 * 打开一个 URL，读出「渲染了哪套版式 + 当前是哪台设备」。
 *
 * 每个场景都用**全新 context**（空缓存 + 空 localStorage），避免互相污染 ——
 * 配色会被落盘，共用 context 时上一个场景的选择会渗进下一个。
 */
async function open(path, { viewport = DESKTOP, base = BASE } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const s = window.__MAUTH_STORE__;
      return Boolean(s && s.activeDevice && s.activePage && s.activeView) &&
        document.querySelector('[data-mauth-view]') !== null;
    },
    { timeout: 30000 }
  );
  // 等惰性 chunk 落地（换包时版式是动态 import，DOM 属性要等它挂上）
  await page.waitForTimeout(600);
  const snap = await page.evaluate(() => {
    const roots = [...document.querySelectorAll('[data-mauth-view]')];
    return {
      identities: [...new Set(roots.map(el => el.getAttribute('data-mauth-view')))],
      device: window.__MAUTH_STORE__?.activeDevice ?? null,
      activeView: window.__MAUTH_STORE__?.activeView ?? null,
      activeThemeId: window.__MAUTH_STORE__?.activeThemeId ?? null,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--mauth-primary').trim()
    };
  });
  await ctx.close();
  return snap;
}

/** 版式身份：DOM 上必须**只有一套**（两套并存说明分发器同时挂了两份容器） */
async function viewOf(path, opts) {
  const s = await open(path, opts);
  if (s.identities.length !== 1) {
    return { view: `<多套:${s.identities.join('|')}>`, device: s.device };
  }
  return { view: s.identities[0], device: s.device, ...s };
}

try {
  console.log('\n===== A. 默认（不带任何 view 参数）→ 当前包名，三页 × 三端 =====');
  const a1 = await viewOf(`/login${QS}`, { viewport: DESKTOP });
  check('A1 /login（桌面）→ default 且 device=standard', a1.view === 'default' && a1.device === 'standard', `view=${a1.view} device=${a1.device}`);
  const a2 = await viewOf(`/m/login${QS}`, { viewport: PHONE });
  check('A2 /m/login（手机）→ default 且 device=mobile', a2.view === 'default' && a2.device === 'mobile', `view=${a2.view} device=${a2.device}`);
  const a3 = await viewOf(`/mini-login${QS}`, { viewport: COMPACT });
  check('A3 /mini-login（紧凑）→ default 且 device=mini', a3.view === 'default' && a3.device === 'mini', `view=${a3.view} device=${a3.device}`);
  const a4 = await viewOf(`/register${QS}`, { viewport: DESKTOP });
  check('A4 /register（桌面）→ default', a4.view === 'default' && a4.device === 'standard', `view=${a4.view} device=${a4.device}`);
  const a5 = await viewOf(`/m/register${QS}`, { viewport: PHONE });
  check('A5 /m/register（手机）→ default', a5.view === 'default' && a5.device === 'mobile', `view=${a5.view} device=${a5.device}`);
  const a6 = await viewOf(`/m/forgot-password${QS}`, { viewport: PHONE });
  check('A6 /m/forgot-password（手机）→ default', a6.view === 'default' && a6.device === 'mobile', `view=${a6.view} device=${a6.device}`);

  console.log('\n===== B. 第 2 档：URL 通用键（跨包 = 切包；本页无此包 = 安静下沉）=====');
  const b1 = await viewOf(`/m/register${QS}&th=compact`, { viewport: PHONE });
  check('B1 /m/register?th=compact（手机）→ compact（命中另一包 ⇒ 切包）', b1.view === 'compact', `view=${b1.view}`);
  const b2 = await viewOf(`/register${QS}&th=compact`, { viewport: DESKTOP });
  check('B2 同一链接（桌面）→ default（compact 包没有 standard/register ⇒ 下沉当前包）', b2.view === 'default' && b2.device === 'standard', `view=${b2.view} device=${b2.device}`);
  const b3 = await viewOf(`/m/login${QS}&th=compact`, { viewport: PHONE });
  check('B3 /m/login?th=compact → default（compact 包没有 login 版式）', b3.view === 'default', `view=${b3.view}`);
  const b4 = await viewOf(`/m/forgot-password${QS}&th=compact`, { viewport: PHONE });
  check('B4 /m/forgot-password?th=compact → default（compact 包没有该页版式）', b4.view === 'default', `view=${b4.view}`);
  const b5 = await viewOf(`/m/register${QS}&th=default`, { viewport: PHONE });
  check('B5 ?th=当前包名 等价于"用当前包"（不算非法）', b5.view === 'default', `view=${b5.view}`);

  console.log('\n===== C. 第 1 档：设备维度键 + 两条硬规则 =====');
  const c1 = await viewOf(`/m/register${QS}&th=default&th_mobile=compact`, { viewport: PHONE });
  check('C1 `th_mobile` 优先于通用 `view`（同一链接里两把键都给）', c1.view === 'compact', `view=${c1.view}（通用键是 default，落 compact 才说明设备键赢了）`);
  const c2 = await viewOf(`/register${QS}&th=default&th_mobile=compact`, { viewport: DESKTOP });
  check('C2 同一条链接在桌面：`th_mobile` 对他端无效，落通用 `view=default`', c2.view === 'default' && c2.device === 'standard', `view=${c2.view} device=${c2.device}`);
  const c3 = await viewOf(`/m/register${QS}&th=compact&th_mobile=`, { viewport: PHONE });
  check('C3 设备键留空 = 未指定 ⇒ 回落到通用 `view=compact`（空串不吞掉回退链）', c3.view === 'compact', `view=${c3.view}`);
  const c4 = await viewOf(`/m/register${QS}&th=compact&th_mobile=%20`, { viewport: PHONE });
  check('C4 设备键只有空白同上（纯空白也算未指定）', c4.view === 'compact', `view=${c4.view}`);
  const c5 = await viewOf(`/m/register${QS}&th=compact&th_mobile=typo`, { viewport: PHONE });
  check('C5 设备键是非法值 ⇒ 落**当前包**（不回退到通用键的 compact）', c5.view === 'default', `view=${c5.view} —— 显式写错不静默换 UI`);
  const c6 = await viewOf(`/m/register${QS}&th=typo`, { viewport: PHONE });
  check('C6 通用键非法（?th=typo）⇒ 落当前包', c6.view === 'default', `view=${c6.view}`);
  const c7 = await viewOf(`/m/register${QS}&th=base`, { viewport: PHONE });
  check('C7 `?th=base` 归一到**包名**（不是把已废弃的 `base` 当 id 传下去）', c7.view === 'default' && c7.activeView === 'default', `DOM=${c7.view} activeView=${c7.activeView}`);
  for (const bad of ['../evil', 'A B', 'x'.repeat(40), 'default%2F..']) {
    const r = await viewOf(`/m/register${QS}&th=${bad}`, { viewport: PHONE });
    check(`C8 非法/超长 id "${bad.slice(0, 12)}" ⇒ 落当前包、不白屏`, r.view === 'default', `view=${r.view}`);
  }
  const c9 = await viewOf(`/m/register${QS}&th=compact&th=bogus`, { viewport: PHONE });
  check('C9 同名键给两次（数组形态）⇒ 当作没给，落当前包', c9.view === 'default', `view=${c9.view}`);

  console.log('\n===== D. 同一链接、不同设备 → 各自解析（不串台）=====');
  const d1 = await viewOf(`/register${QS}&th_mobile=compact`, { viewport: PHONE });
  check('D1 `?th_mobile=compact` 在手机上生效', d1.view === 'compact' && d1.device === 'mobile', `view=${d1.view} device=${d1.device}`);
  const d2 = await viewOf(`/register${QS}&th_mobile=compact`, { viewport: DESKTOP });
  check('D2 同一条链接在桌面：`th_mobile` 不串到 standard，落当前包', d2.view === 'default' && d2.device === 'standard', `view=${d2.view} device=${d2.device}`);
  const d3 = await viewOf(`/register${QS}&th_std=compact`, { viewport: PHONE });
  check('D3 `th_std=compact` 在手机上不生效（compact 也没有 standard 版式）', d3.view === 'default', `view=${d3.view}`);
  const d4 = await viewOf(`/mini-login${QS}&th=compact&th_mini=default`, { viewport: COMPACT });
  check('D4 mini 也有自己的设备键（`th_mini` 生效）', d4.view === 'default' && d4.device === 'mini', `view=${d4.view} device=${d4.device}`);

  console.log('\n===== E. 版式选择不破坏配色（token 不许静默丢失）=====');
  const e0 = await viewOf(`/m/login${QS}&th_color=blue`, { viewport: PHONE });
  const E_CASES = ['th=typo', 'th=base', 'th=default', 'th_mobile=default'];
  for (let i = 0; i < E_CASES.length; i += 1) {
    const q = E_CASES[i];
    const r = await viewOf(`/m/login${QS}&th_color=blue&${q}`, { viewport: PHONE });
    check(
      `E${i + 1} 「${q}」与不带 view 时配色逐项一致（配色 id + 主色）`,
      r.activeThemeId === e0.activeThemeId && r.primary === e0.primary && Boolean(r.primary),
      `${r.activeThemeId}/${r.primary} vs ${e0.activeThemeId}/${e0.primary}`
    );
  }
  check('E5 基准配色确实是 blue 的 #2f7fd6（否则上面几条是空比）', e0.primary === '#2f7fd6', `--mauth-primary=${e0.primary}`);
} finally {
  await browser.close();
}

const total = pass + fails.length;
console.log(`\n===== ${fails.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过 =====`);
if (fails.length) {
  console.log('失败项：');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
