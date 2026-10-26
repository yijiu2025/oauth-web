/**
 * 探针：验证「配色挂在版式下」的新模型是否真的生效
 *
 * 断言：
 *   A. 注册表按「包/设备/页面/版式」四段归属 —— listColorsOf(device,page,view) 返回该版式的颜色
 *   B. 不同版式的颜色清单不同（register base 有 4 色；compact 只有黑/白）
 *   C. ?theme=cyan&th=compact 时 compact 无 cyan → 回落（data-mauth-theme 不写或写默认）
 *   D. ?theme=cyan 在 register 基础版式下真的注入青色 token
 *
 * 用法：node verify-colors-in-views.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { requirePort } from './lib/env-guard.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:5184';
await requirePort(BASE); // 环境自检：端口没起 / 5xx 时在此红（退出码 2），不进 Playwright 超时地狱
const QS = '?appName=posecraft&client_id=demo-client-001';

let pass = 0;
const fails = [];
const check = (name, ok, extra = '') => {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}${extra ? '  ' + extra : ''}`);
  } else {
    fails.push(name);
    console.log(`  ❌ ${name}${extra ? '  ' + extra : ''}`);
  }
};

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2
});
const page = await ctx.newPage();

/** 打开某路径，等页面就绪后读 html 上的 data-mauth-theme 与注入的 token */
async function probe(path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      theme: root.dataset.mauthTheme ?? null,
      view: document.querySelector('.mauth-page')?.getAttribute('data-mauth-view') ?? null,
      primary: root.style.getPropertyValue('--mauth-primary') || '(空)',
      radius: root.style.getPropertyValue('--mauth-radius') || '(空)',
      /* 自带底色（黑/白/蓝/青 各自声明；未声明的配色留空串） */
      bg: root.style.getPropertyValue('--mauth-bg') || '(空)',
      canvas: root.style.getPropertyValue('--mauth-canvas') || '(空)',
      tokens: Array.from(root.style).filter(n => n.startsWith('--mauth-')).length
    };
  });
}

/* ===== A. register 基础版式：4 色可选 ===== */
const aBlack = await probe('/m/register' + QS + '&th_color=black');
check('A1 register base: th_color=black 生效（data-mauth-theme=black）', aBlack.theme === 'black', `theme=${aBlack.theme}`);
/* 🔴 2026-09-25 改：black / white 不再零 token —— 它们现在是和蓝青**并列的普通颜色**，
   各自自带底色（否则选黑还是选蓝都会随用户明暗偏好变，就是用户报的"白蓝/黑蓝"问题）。
   本段因此从"断言零 token"改为"断言自带黑底且明暗不影响它"。
   🔴 2026-10-15 改：#020617(slate-950) → #000000(纯黑) —— 主题源码
   `src/theme/themes/` 下各包的 `register/colors/black/index.ts` 已改为"选黑就是纯黑"
   （用户原话："黑色背景就要使用纯黑"，不再借 slate-950 那套深蓝灰）。
   本关卡此前仍断言旧值，属于期望值漂移（产品已是新值）。 */
check('A2 register base: black 自带深色底 --mauth-bg=#000000', aBlack.bg === '#000000', `bg=${aBlack.bg}`);
check('A2b register base: black 自带画布色 #000000', aBlack.canvas === '#000000', `canvas=${aBlack.canvas}`);

const aCyan = await probe('/m/register' + QS + '&th_color=cyan');
check('A3 register base: th_color=cyan 生效', aCyan.theme === 'cyan', `theme=${aCyan.theme}`);
check('A4 register base: cyan 真的注入了 --mauth-primary', aCyan.primary === '#0e7490', `primary=${aCyan.primary}`);
check('A5 register base: cyan 不再覆写 radius（token 移除，渲染回退基线 12px）', aCyan.radius === '(空)' || aCyan.radius === '' || aCyan.radius === '12px', `radius=${aCyan.radius}`);

const aBlue = await probe('/m/register' + QS + '&th_color=blue');
check('A6 register base: th_color=blue 生效', aBlue.theme === 'blue', `theme=${aBlue.theme}`);
check('A7 register base: blue 注入 --mauth-primary=#2f7fd6', aBlue.primary === '#2f7fd6', `primary=${aBlue.primary}`);

/* ===== B. compact 版式与 base 同样四色（2026-09-25 补齐 blue/cyan，用户要求配色清单一致） ===== */
const bBlack = await probe('/m/register' + QS + '&th=compact&th_color=black');
check('B1 compact: 渲染的是 compact 版式', bBlack.view === 'compact', `view=${bBlack.view}`);
check('B2 compact: th_color=black 在 compact 下生效', bBlack.theme === 'black', `theme=${bBlack.theme}`);

const bBlue = await probe('/m/register' + QS + '&th=compact&th_color=blue');
check(
  'B3 compact 切 blue 直接生效（已补齐配色，不再回落）',
  bBlue.theme === 'blue',
  `theme=${bBlue.theme}（期望 blue）`
);

/* ===== C. 同颜色在不同页面各自独立 ===== */
const cLogin = await probe('/m/login' + QS + '&th_color=cyan');
check('C1 login base: th_color=cyan 生效', cLogin.theme === 'cyan', `theme=${cLogin.theme}`);
check('C2 login base: 注入 --mauth-primary=#0e7490', cLogin.primary === '#0e7490', `primary=${cLogin.primary}`);

const cForgot = await probe('/m/forgot-password' + QS + '&th_color=cyan');
check('C3 forgot-password base: th_color=cyan 生效', cForgot.theme === 'cyan', `theme=${cForgot.theme}`);

/* ===== D. 黑白自带底色，明暗偏好不改变它们 ===== */
// `?mode=` 明暗 URL 入口已废弃（2026-10-20，见 skinsuite 文档站「明暗与色系」）——
// 明暗只跟配色的系别走，不再从 URL 定。
const dWhite = await probe('/m/register' + QS + '&th_color=white');
check('D1 register base: th_color=white 生效', dWhite.theme === 'white', `theme=${dWhite.theme}`);
check('D2 white 自带浅色底 --mauth-bg=#f8fafc', dWhite.bg === '#f8fafc', `bg=${dWhite.bg}`);
check('D2b white 自带画布色 #ffffff', dWhite.canvas === '#ffffff', `canvas=${dWhite.canvas}`);

// `?mode=` 明暗 URL 入口已废弃（2026-10-20，见 skinsuite 文档站「明暗与色系」）——
// black 是暗系配色，天然带 dark 类；不再从 URL 定明暗。
await probe('/m/register' + QS + '&th_color=black');
check('D3 black 自带 dark 类（mode= URL 入口已废弃）', await page.evaluate(() => document.documentElement.classList.contains('dark')));

await ctx.close();
await browser.close();
console.log(`\n===== 通过 ${pass} / 失败 ${fails.length} =====`);
if (fails.length) {
  for (const f of fails) console.log('  -', f);
  process.exitCode = 1;
}
