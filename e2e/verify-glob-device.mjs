/**
 * 主题目录扫描探针：确认四级结构（包 → 设备 → 页面 → 配色）真的被扫到
 *
 * === 背景（2026-10-17 改写）===
 * 早先主题资产走 `import.meta.glob`，模式必须是**字面量**，「主题目录在哪」因此
 * 被写死在源码里、改不了。现在改用主题库 `skinsuite/vite` 的 `themeAssets()` 插件
 * 在构建期扫目录、以虚拟模块 `virtual:theme` 注入 —— 于是本探针的检查对象
 * 也随之从"源码里的 glob 模式串"变成**插件真实的扫描产物**。
 *
 * 这比对模式串更强：模式写对了但目录结构歪了，旧探针是看不出来的。
 *
 * 仍然保留的失败场景：目录少一层、设备名拼错、某个包漏了 `index.ts` ——
 * 这些都会让注册表静默少几套配色（"配色永远不出现"且没有任何报错）。
 *
 * 🔴 2026-09-26：**一个主题包 = 一种版式** ⇒ 配色路径只剩 4 段
 * （包 / 设备 / 页面 / colors / 配色），所以本探针断言"6 段形态不存在"，
 * 而不是"两套都要扫到"。
 *
 * 做法：让 Vite 以 ssr 模式 transform 目标模块，直接读回编译产物里的路径说明符。
 *
 * 退出码：0 全部命中 / 1 有关键项为空
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

let pass = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failures.push(label);
    console.log(`  \u2717 ${label}${detail ? `  \u2192 ${detail}` : ''}`);
  }
}

/** 从编译产物里把所有被扫描出来的路径抓出来 */
function extractGlobKeys(code) {
  // 插件的产物形如 `import * as __packages0 from "/src/theme/themes/x/index.ts";`
  const keys = new Set();
  const re = /["'](\/src\/theme\/themes\/[^"']+\.(?:vue|ts|scss))(?:\?inline)?["']/g;
  let m;
  while ((m = re.exec(code))) keys.add(m[1]);
  // 也抓相对形态（若有人写错成相对路径，这里能看到它是空的）
  const re2 = /["'](\.\/themes\/[^"']+\.(?:vue|ts|scss))["']/g;
  while ((m = re2.exec(code))) keys.add(m[1]);
  return [...keys].sort();
}

const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom'
});

/**
 * 取虚拟模块的编译产物
 *
 * `\0` 开头的模块 id 在 URL 里要编码成 `/@id/__x00__<id>`；几种写法都试一遍，
 * 免得 Vite 内部编码规则一变就整套探针空转（空转的症状是"全部失败"，很好认，
 * 但先把退路留好）。
 */
async function loadVirtualModule() {
  const candidates = [
    '/@id/__x00__virtual:theme',
    '/@id/%00virtual:theme',
    '\0virtual:theme',
    'virtual:theme'
  ];
  for (const url of candidates) {
    try {
      const res = await server.transformRequest(url, { ssr: true });
      if (res?.code?.includes('/src/theme/themes/')) return res.code;
    } catch {
      // 换下一种写法
    }
  }
  return '';
}

try {
  const targets = [
    { file: 'src/theme/views/login.ts', label: 'login 版式注册表' },
    { file: 'src/theme/views/register.ts', label: 'register 版式注册表' },
    { file: 'src/theme/views/forgot-password.ts', label: 'forgot-password 版式注册表' }
  ];

  const results = {};
  for (const t of targets) {
    const res = await server.transformRequest('/' + t.file, { ssr: true });
    results[t.file] = extractGlobKeys(res?.code ?? '');
    console.log(`\n=== ${t.label}（${t.file}）扫到 ${results[t.file].length} 条 ===`);
    for (const k of results[t.file]) console.log(`    ${k}`);
  }

  // 主题注册表的资产由插件扫描后经虚拟模块注入 —— 探针直接查这一份产物
  results['virtual:theme'] = extractGlobKeys(await loadVirtualModule());
  console.log(`\n=== 主题域虚拟模块（virtual:theme）扫到 ${results['virtual:theme'].length} 条 ===`);
  for (const k of results['virtual:theme']) console.log(`    ${k}`);

  console.log('\n=== 断言 ===');

  const themeKeys = results['virtual:theme'];
  check(
    '主题注册表扫到包定义 themes/*/index.ts',
    themeKeys.includes('/src/theme/themes/default/index.ts'),
    '包定义没扫到 → 整个包不注册'
  );
  check(
    '主题注册表扫到「包/设备/页面/colors/配色」四段的配色 index.ts',
    themeKeys.some(k =>
      /^\/src\/theme\/themes\/default\/(mobile|standard|mini)\/[^/]+\/colors\/[^/]+\/index\.ts$/.test(k)
    ),
    `实际：${themeKeys.filter(k => k.includes('/colors/')).join(', ') || '(空)'}`
  );
  // 2026-09-25 起：变体版式配色不再挂在 default 包下，而是迁到独立主题包 compact/
  // 这里改为验证 compact 主题包内的 register 配色被正确扫到
  check(
    'compact 主题包的 register 配色被扫到（themes/compact/mobile/register/colors/*/index.ts）',
    themeKeys.some(k =>
      /^\/src\/theme\/themes\/compact\/mobile\/register\/colors\/[^/]+\/index\.ts$/.test(k)
    ),
    `实际：${themeKeys.filter(k => k.includes('/compact/mobile/register/colors/')).join(', ') || '(空)'}`
  );
  const mobileColors = themeKeys.filter(k => k.includes('/mobile/'));
  const standardColors = themeKeys.filter(k => k.includes('/standard/'));
  const miniColors = themeKeys.filter(k => k.includes('/mini/'));
  check(
    '移动端配色库非空（black/white/blue/cyan/rainbow）',
    mobileColors.filter(k => /\/colors\/[^/]+\/index\.ts$/.test(k)).length >= 8,
    `实际 ${mobileColors.filter(k => /\/colors\/[^/]+\/index\.ts$/.test(k)).length} 套`
  );
  check(
    '桌面端(standard)配色库非空（骨架 black/white）',
    standardColors.filter(k => /\/colors\/[^/]+\/index\.ts$/.test(k)).length >= 6,
    `实际 ${standardColors.filter(k => /\/colors\/[^/]+\/index\.ts$/.test(k)).length} 套`
  );
  check(
    '紧凑版(mini)配色库非空（login/register/forgot-password 三页 black/white）',
    miniColors.filter(k => /\/colors\/[^/]+\/index\.ts$/.test(k)).length >= 6,
    `实际 ${miniColors.filter(k => /\/colors\/[^/]+\/index\.ts$/.test(k)).length} 套`
  );
  check(
    '配色样式 glob 扫到 page 下的 theme.scss',
    themeKeys.some(k => /\/themes\/default\/mobile\/[^/]+\/colors\/[^/]+\/theme\.scss$/.test(k)),
    '样式没扫到 → 配色只有 token 没有背景图'
  );
  // 🔴 2026-09-26：一个主题包 = 一种版式 → 配色路径里**没有**「版式」这一层。
  //    断言"6 段形态不存在"，而不是"两套形态都要扫到"。
  {
    const colorKeys = themeKeys.filter(k => k.includes('/colors/'));
    // ⚠️ 反面断言要按"`colors` 前恰好 3 段"写：`*/` 在 4 段路径里本来就出现 3 次，
    //    用"出现 2 次即违规"这类写法会把正确路径也判成违规。
    const fourSegment = /\/themes\/[^/]+\/[^/]+\/[^/]+\/colors\/[^/]+\//;
    const sixSegment = /\/themes\/(?:[^/]+\/){4}colors\//;
    check(
      '配色路径只有一套形态（4 段：包/设备/页面/colors/配色）',
      colorKeys.length > 0 && colorKeys.every(k => fourSegment.test(k)),
      `实际：${colorKeys.join(' | ') || '(空)'}`
    );
    check(
      '无 6 段配色路径残留（配色路径里没有「版式」这一层）',
      colorKeys.every(k => !sixSegment.test(k)),
      '一个主题包 = 一种版式；6 段形态会扫到 0 个文件且静默不报错'
    );
    // 机制层面的反面断言：注册表不该再自己写 glob（目录是配置项，写 glob 就退回去了）
    // ⚠️ 按 `import.meta.glob(` 判（带括号）：文件里还留着"不再来自 import.meta.glob"
    //    的说明性注释，只按词判会把注释也算成违规。
    // 2026-10-17：注册表构建层下沉到内核（skinsuite 的 registry.ts），宿主装配点
    //   src/theme-manifest.ts 只做接线（从 virtual:theme 取资产 + installThemeRegistry），
    //   这里改查宿主的装配点。
    const hostIndexSrc = readFileSync(join(ROOT, 'src/theme-manifest.ts'), 'utf8');
    check(
      '宿主注册表接线从虚拟模块取资产，且不再使用 import.meta.glob',
      hostIndexSrc.includes("from 'virtual:theme'") && !hostIndexSrc.includes('import.meta.glob('),
      'glob 的模式必须是字面量，用了它「主题目录在哪」就又是源码常量了'
    );
  }

  for (const page of ['login', 'register', 'forgot-password']) {
    const keys = results[`src/theme/views/${page}.ts`];
    const mobileBase = keys.filter(k =>
      new RegExp(`/themes/default/mobile/${page}/index\\.vue$`).test(k)
    );
    const standardBase = keys.filter(k =>
      new RegExp(`/themes/default/standard/${page}/index\\.vue$`).test(k)
    );
    check(
      `${page}：移动端基础版式被扫到`,
      mobileBase.length === 1,
      `实际 ${mobileBase.length} 条（应当 1）`
    );
    check(
      `${page}：桌面端(standard)基础版式骨架被扫到`,
      standardBase.length === 1,
      `实际 ${standardBase.length} 条（应当 1）`
    );
    const miniBase = keys.filter(k =>
      new RegExp(`/themes/default/mini/${page}/index\\.vue$`).test(k)
    );
    check(
      `${page}：紧凑版(mini)版式被扫到`,
      miniBase.length === 1,
      `实际 ${miniBase.length} 条（应当 1）`
    );
    check(
      `${page}：版式 glob 不吞「版式层」目录（无 <页面>/<变体>/index.vue 形态）`,
      keys.every(k => !new RegExp(`/${page}/[^/]+/index\\.vue$`).test(k)),
      '一个主题包 = 一种版式：多一层的形态不该再被任何 glob 匹配'
    );
  }
  // 2026-09-25 起：register 不再有变体形态 —— 改为扫描主题包粒度的版式
  {
    const regKeys = results['src/theme/views/register.ts'];
    check(
      'register 主题包粒度的 compact 版式被扫到（themes/compact/mobile/register/index.vue）',
      regKeys.some(k => /\/themes\/compact\/mobile\/register\/index\.vue$/.test(k)),
      `实际：${regKeys.filter(k => k.includes('compact')).join(', ') || '(空)'}`
    );
    check(
      'register 主题包粒度的 default 版式被扫到（themes/default/mobile/register/index.vue）',
      regKeys.some(k => /\/themes\/default\/mobile\/register\/index\.vue$/.test(k)),
      `实际：${regKeys.filter(k => k.includes('default/mobile/register/index')).join(', ') || '(空)'}`
    );
  }
  // 2026-09-25 起：mini 是独立设备（与 standard 并列，不再是 web 下的变体）
  {
    const loginKeys = results['src/theme/views/login.ts'];
    check(
      'mini 设备 login 版式被扫到（themes/default/mini/login/index.vue）',
      loginKeys.some(k => /\/themes\/default\/mini\/login\/index\.vue$/.test(k)),
      `实际：${loginKeys.filter(k => k.includes('/mini/')).join(', ') || '(空)'}`
    );
    const regKeys = results['src/theme/views/register.ts'];
    check(
      'mini 设备 register 版式被扫到（themes/default/mini/register/index.vue）',
      regKeys.some(k => /\/themes\/default\/mini\/register\/index\.vue$/.test(k)),
      `实际：${regKeys.filter(k => k.includes('/mini/')).join(', ') || '(空)'}`
    );
    const forgotKeys = results['src/theme/views/forgot-password.ts'];
    check(
      'mini 设备 forgot-password 版式被扫到（themes/default/mini/forgot-password/index.vue）',
      forgotKeys.some(k => /\/themes\/default\/mini\/forgot-password\/index\.vue$/.test(k)),
      `实际：${forgotKeys.filter(k => k.includes('/mini/')).join(', ') || '(空)'}`
    );
  }
} finally {
  await server.close();
}

const total = pass + failures.length;
console.log(`\n===== ${failures.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过 =====`);
if (failures.length) {
  console.log('失败项：');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
