/**
 * 静态关卡：主题目录口径（**四级结构**）+ 「版式跟随主题包与设备」的实现口径
 *
 * 守护的规则（`docs/multi-theme.md` 与 `oauth21/src/theme/README.md`）：
 *
 *   结构 · 四级（主题包 → 设备 → 页面 → 配色）
 *     1. `themes/` 下一层目录 = 一个**主题包**，目录名即 id（只允许 [a-z0-9-]）
 *     2. `<包>/` 下一层目录 = **设备**，只认 `mobile` / `standard` / `mini`
 *        （写错整段跳过；2026-09-25 三值化，mini 从 web 的变体升为独立设备）
 *     3. `<设备>/` 下一层目录 = **页面**，目录名即页面名（`login` / `register` / `forgot-password`）
 *     4. 🔴 **一个主题包 = 一种版式**（2026-09-26 定案，用户：「变体版式使用新包」）：
 *          • `<页面>/` 下**只有** `index.vue` 与 `colors/`
 *          • **没有**「版式」这一层目录（旧形态 `<页面>/<版式>/colors/` 已删除）
 *          • 换一套版式 = **新建一个主题包**；注册表里配色记录的 `view` **恒等于包名**
 *     5. 包根与配色都必须有 `index.ts`，且默认导出里带 `meta`
 *     6. 只有 `theme.scss`、没有 `index.ts` → 残缺（样式会被静默忽略）
 *     7. `theme.scss` 的属性选择器必须用**该目录名**（`html[data-mauth-theme='<目录名>']`）
 *     8. 🔴 **五色完全并列**（2026-09-25 改）：
 *          • `black` / `white` 是**自带底色的独立颜色**，各写全 token，不是"基线/零 token"
 *          • 明暗档已取消（"深浅就是两种颜色配置"）→ 不为某个颜色做深/浅两档身份
 *          • 每页都应同时有 `black` 与 `white` 两个实体目录
 *
 *   结构 · 版式在包里、且按设备分区
 *     9. 版式实现住在 `<包>/<设备>/<页面>/index.vue`（唯一版式，没有名字层）
 *    10. `<设备>/` 下除页面目录外，不得有别的子目录（`colors` 已下沉到页面下）
 *    11. 版式的契约 + 注册表是 `theme/views/` 下的页面文件，不在 theme 根平铺
 *
 *   实现 ↔ 文档
 *    12. 配色注册表 glob **只有一套**（4 段：包 / 设备 / 页面 / colors / 配色）
 *        —— 旧的多一层「版式」的 6 段形态已删除，两套模式盖的是同一个层级
 *    13. 各页注册表版式 glob 是**跨包跨设备**的；工厂按**当前包 × 当前设备**过滤
 *    14. 容器静态引入**内置包 × 自身设备**的版式，且硬编码目录名 === `DEFAULT_THEME_PACKAGE`
 *    15. 容器的切换 watch 同时依赖 `themeStore.packageId`
 *    16. 容器写死 `THEME_DEVICE` 常量（设备是页面身份，不跑视口判定）
 *    17. 设备同步用 watch(router.currentRoute, {immediate:true})，由 bootstrap.ts 在 pinia 之后调用
 *
 *   抽包 · 内核与宿主解耦（2026-09-26 起，见 https://github.com/yijiu2025/CoreFlow/blob/main/docs/standards/theme-package-extraction.md）
 *    18. 🔴 内核包 `packages/theme-core` **不得知道宿主**：无 `import.meta`、无
 *        `window.` / `document.`、无 `localStorage`、无非 `import type` 的 `vue`、
 *        无 `vue-router`、无 `axios` / `fetch`、无 `@/` 别名（「〇、一条原则」的机械保障）
 *    19. 包的唯一公开出口是 `src/index.ts`，且必须**显式具名导出**（不用 `export *`）：
 *        公开面是一份承诺，加一个名字要有刻意的摩擦
 *    20. 🔴 迁移铁律「同一时刻只有一个实现」：`oauth21/src/theme/` 下的**壳文件**
 *        只允许「注释 + 从 `skinsuite` 转发」，不得有任何逻辑（否则两份真相）
 *
 * 不需要浏览器：纯文件系统 + 源码断言。
 * 退出码：0 通过 / 1 断言失败
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireScanDir } from './lib/env-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// 关卡所在目录 = oauth21/e2e/，oauth21 就是上一级
const ROOT = join(HERE, '..', 'src');
const THEME = join(ROOT, 'theme');
const VIEWS = join(THEME, 'views');
const PKGS = join(THEME, 'themes');
// 环境自检（2026-10-21）：扫描目录空 = 期望集 0 = 断言恒红/假绿，先红自己
requireScanDir(PKGS, '主题包目录');

/** 目录名白名单（与 theme/index.ts 的 THEME_ID_RE 逐字一致） */
const ID_RE = /^[a-z0-9-]+$/;
/** 设备清单文件（设备维度取值集合的**唯一来源**，见 oauth21/src/theme/views/devices.ts） */
const DEVICES_FILE = join(VIEWS, 'devices.ts');
/**
 * 设备白名单 —— 从宿主设备清单 `theme/devices.ts` 派生，**不再硬编码**
 *
 * 清单里每个设备是一条 `{ id: 'mobile', … }`；本关卡读 `id:` 字段取取值集合。
 * 加一种设备 = 改 devices.ts 一条声明，本关卡自动跟上（与主题包目录的口径同源）。
 */
function readDeviceIds() {
  const src = existsSync(DEVICES_FILE) ? readFileSync(DEVICES_FILE, 'utf8') : '';
  const ids = [];
  const re = /\bid\s*:\s*['"]([a-z0-9-]+)['"]/g;
  let m;
  while ((m = re.exec(src))) ids.push(m[1]);
  return ids;
}
const DEVICES = readDeviceIds();
/** 配色目录的固定名（住在页面下） */
const COLORS_DIR = 'colors';
/** 页面目录下**唯一**允许出现的子目录名（一个包 = 一种版式，没有版式层） */
const PAGE_SUBDIRS = [COLORS_DIR];
/** 每页都应有的并列配色目录名（黑白是两个独立颜色，各自一份实体目录；包可用 coverage 覆盖） */
const DEFAULT_PEER_COLORS = ['black', 'white'];

let pass = 0;
/** 已退役断言计数（见 RETIRED：不计入失败，但仍显示出来留痕） */
let retired = 0;
const failures = [];

/**
 * 该配色 index.ts 是否是 re-export 形态（`export { default } from '…'`）
 *
 * re-export = 该设备的这套配色复用**同包另一设备**的同名配色（如 tablet 复用
 * standard 的 black）。这种形态下 meta/tone/tokens 由目标文件承担（目标文件在同包
 * 另一设备目录，已被本关卡内联检查），所以本处跳过内联检查、只验目标路径合法。
 */
function isReexport(src) {
  return /export\s*\{\s*default\s*\}\s*from\s*['"][^'"]+['"]/.test(src);
}

/**
 * 已退役的断言（2026-10-19）—— 它们描述的是**已删除的旧机制**，留着只会一直红。
 *
 * 两批：
 *   A. 「每页版式注册表 + 容器手写加载」→ 已被 `<ThemeView page device :ctx>` 取代
 *      （版式表由内核从 `virtual:theme` 惰性解析，容器不再 glob、不再 `THEME_DEVICE`）。
 *   B. 「setupTheme + 守卫预取 + RouteMeta.device + 写 store.activeDevice」→ 已被
 *      `app.use(theme, { router })` + 宿主设备模块（`useRenderDevice`）+ `<ThemeView>`
 *      device prop 告知 store 取代。
 *
 * 为什么不直接删代码：同一段落里混着**仍然有效**的项（目录结构、配色 token 等），
 * 逐条删容易连坐。用「显式退役 + 记原因」保住可追溯性 —— 也让后来者一眼看出
 * 「不是没人管，是机制没了」。要恢复某条，把匹配词从这里删掉即可。
 */
const RETIRED = [
  '容器写死 THEME_DEVICE',
  '容器静态引入',
  '容器引入的包 === DEFAULT_THEME_PACKAGE',
  '容器用 readDeviceParam',
  '容器的切换 watch 依赖 themeStore.packageId',
  '容器调 load 时传了 THEME_DEVICE',
  '注册表版式 glob',
  '注册表 glob 用 /src/',
  'setupTheme',
  'RouteMeta.device',
  '设备同步用 watch',
  '设备同步 watch 带 immediate',
  '接线把设备写回主题 store',
  'token 注入 watch 依赖 activeDevice',
  'data-mauth-theme watch 依赖',
  '路由守卫预取用 readDeviceParam',
  '选择器工厂存在且导出 createViewPicker',
  '选择器把 source.theme 交给 registry.resolve',
  '选择器有设备白名单归一',
  '选择器的 URL 分支',
  '选择器的输入含 device',
  '工厂只保留 bases 一张表',
  '工厂在内置包 + 默认设备时直接返回 null',
  '工厂有设备白名单归一',
  '工厂键正则含设备段',
  // 设备维度参数键形已从 `theme.<设备>` 点号改为 `th_color_<缩写>` 下划线（2026-10-18）
  '先取 `<名>.<设备>`',
  '配色侧按设备读 `theme.<设备>`',
  '配色侧也把空串当'
];

const isRetired = label => RETIRED.some(word => label.includes(word));

/**
 * 剥掉行注释与块注释后的「纯代码」文本
 *
 * 断言「代码里不许出现 X」时必须先剥注释：docstring 里**提到**某个词
 * （如「不 import store、不 setActiveDevice」）不等于代码里有它。
 * `//` 前的 `[^:]` 守卫是放过字符串里的 `https://`。
 */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function check(label, ok, detail = '') {
  if (isRetired(label)) {
    retired += 1;
    console.log(`  \u2298 ${label}（已退役：机制已删，见 RETIRED）`);
    return;
  }
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failures.push(label);
    console.log(`  \u2717 ${label}${detail ? `  \u2192 ${detail}` : ''}`);
  }
}

const isDir = p => existsSync(p) && statSync(p).isDirectory();
const subdirs = p => (existsSync(p) ? readdirSync(p).filter(n => isDir(join(p, n))) : []);
const read = p => readFileSync(p, 'utf8');

/**
 * 主题内核抽包后的**实现位置解析器**（2026-09-26 起）
 *
 * 纯内核的叶子层已抽到工作区包 `packages/theme-core/src/`，`oauth21/src/theme/`
 * 下只留同名 re-export 壳（保证 `@/theme/*` 的导入面不变）。本关卡断言要看的是
 * **实现**，不是壳，所以按「候选相对路径 × 两处根目录」把源码文本拼起来：
 * 实现还在 src 就命中 src，搬进包就命中包 —— 断言逻辑一个字都不用改。
 *
 * 容错：包目录还不存在（抽包进行中）时 `existsSync` 直接跳过，等价于旧行为。
 *
 * === 双形态（2026-10-15）===
 * CORE 的位置随仓形态切换（与 `config/aliases.ts` 同一物理条件）：
 *   - monorepo 形态（上级有 packages/）→ `packages/theme-core/src`
 *   - standalone 形态（单仓 checkout / CI / 开源用户）→ `node_modules/skinsuite/src`
 *     npm 版发布时 files 白名单带 `src`，7 个 .ts 与 monorepo 版逐文件对应，
 *     断言语义不变。
 */
const MONOREPO_FORM = existsSync(join(HERE, '..', '..', 'packages', 'theme-core', 'src', 'index.ts'));
/** standalone 形态的包源码根：装在 oauth21/node_modules 或 hoist 到上一级都可能 */
const INSTALLED_CORE = [
  join(ROOT, 'node_modules', 'skinsuite', 'src'),
  join(ROOT, '..', 'node_modules', 'skinsuite', 'src')
].find(dir => existsSync(dir));
const CORE = MONOREPO_FORM ? join(HERE, '..', '..', 'packages', 'theme-core', 'src') : INSTALLED_CORE || '';
function implText(relPaths) {
  const chunks = [];
  for (const rel of relPaths) {
    for (const base of [THEME, CORE]) {
      const p = join(base, rel);
      if (existsSync(p)) chunks.push(read(p));
    }
  }
  return chunks.join('\n');
}

if (!isDir(THEME)) {
  console.error(`找不到主题目录：${THEME}`);
  process.exit(1);
}

/**
 * 已接入版式机制的页面：`theme/views/<page>.ts` 里**造了页面对象**的那些文件。
 * 用「是否调用 defineThemePage(」判定 —— 页面工厂 `page.ts` 内部也会调
 * createViewRegistry，所以不能用「是否含 createViewRegistry(」识别（会把工厂本身
 * 误当成一个名叫 "page" 的页面，进而去读不存在的 view/app/page/index.vue 崩溃）。
 */
const PAGES = (existsSync(VIEWS) ? readdirSync(VIEWS) : [])
  .filter(n => /^.+\.ts$/.test(n))
  .filter(n => n !== 'page.ts')
  .filter(n => n !== 'registry.ts')
  .filter(n => read(join(VIEWS, n)).includes('defineThemePage('))
  .map(n => /^(.+)\.ts$/.exec(n)?.[1])
  .filter(Boolean);

/** 主题包 */
const PACKAGES = subdirs(PKGS);

/**
 * 读某包的 `coverage` 覆盖声明（可选字段，2026-09-27 起）
 *
 * 返回归一化后的三档范围；缺省值即"全覆盖"：
 *   • devices        —— 覆盖哪些设备；缺省 = DEVICES（全部设备）
 *   • pages          —— 覆盖哪些页面；缺省 = PAGES（全部页面）
 *   • requiredColors —— 每个作用域都应具备的配色；缺省 = DEFAULT_PEER_COLORS
 *
 * 关卡据此**推导**该包应有的目录，不再写死包名（`pkg === 'compact'`）或颜色名。
 * 解析用正则（关卡本就靠正则断言 index.ts，不 import TS 源码 —— 那个文件里有
 * `import type` / `satisfies`，Node 不能直接跑）。
 */
function coverageOf(pkg) {
  const entry = join(PKGS, pkg, 'index.ts');
  const src = existsSync(entry) ? read(entry) : '';
  const arr = (key) => {
    const re = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`);
    const m = re.exec(src);
    if (!m) return null;
    return [...m[1].matchAll(/['"]([a-z0-9-]+)['"]/g)].map(x => x[1]);
  };
  return {
    devices: arr('devices') ?? DEVICES,
    pages: arr('pages') ?? PAGES,
    requiredColors: arr('requiredColors') ?? DEFAULT_PEER_COLORS
  };
}

console.log(`\n=== 1. 目录位置 ===`);
check('theme/themes/ 存在（主题包）', isDir(PKGS));
check(
  'theme/views/ 目录存在（契约 + 注册表收在 views/）',
  isDir(VIEWS),
  '版式机制文件应收在 theme/views/，不该平铺在 theme 根'
);
check(
  'theme/themes/views/ 不存在（配色目录是 colors，且不在 themes 下）',
  !isDir(join(PKGS, 'views'))
);
check('src/theme-manifest.ts 不存在（装配已下沉 vite 插件 import 即自动装配）', !existsSync(join(ROOT, 'theme-manifest.ts')));
check('theme/themes/index.ts 不存在', !existsSync(join(PKGS, 'index.ts')), '注册表装配已提到 src 根');
check('theme/views/registry.ts 已下沉内核（机制在 skinsuite/vue）', !existsSync(join(VIEWS, 'registry.ts')));
check('theme/views/pages.ts 不存在（页面清单归 router 固定声明，不再由主题清单生成）', !existsSync(join(VIEWS, 'pages.ts')));
check(
  'theme/views/params.ts 已下沉内核（机制在 skinsuite，宿主无壳）',
  !existsSync(join(VIEWS, 'params.ts')) && existsSync(join(CORE, 'views', 'params.ts')),
  '`theme.<设备>` / `view.<设备>` 的取值链只应有一份实现，宿主不再留 re-export 壳'
);
check(
  'theme 根不再有 view-<page>.ts 平铺文件',
  !readdirSync(THEME).some(n => /^view-.+\.ts$/.test(n)),
  '契约与注册表已收进 theme/views/'
);
check(`已接入版式的页面 ≥ 1`, PAGES.length > 0, `实际 ${PAGES.length} 个：${PAGES.join(', ')}`);

console.log(`\n=== 2. 主题包（themes/<包>/）===`);
check('发现至少一个主题包', PACKAGES.length > 0, `实际 ${PACKAGES.length} 个`);
for (const pkg of PACKAGES) {
  const dir = join(PKGS, pkg);
  const entry = join(dir, 'index.ts');
  const scss = join(dir, 'theme.scss');

  check(`「${pkg}」目录名合法（[a-z0-9-]）`, ID_RE.test(pkg), '不合规会被注册表静默跳过');
  check(`「${pkg}」有 index.ts（包定义）`, existsSync(entry), '缺了会被静默跳过，整个包不注册');
  if (existsSync(entry)) {
    const src = read(entry);
    check(`「${pkg}」index.ts 有 default 导出`, /export\s+default\s/.test(src));
    check(`「${pkg}」index.ts 含 meta`, /\bmeta\s*:/.test(src));
    check(
      `「${pkg}」包定义是 MauthThemePackage（不再兼默认配色）`,
      /satisfies\s+MauthThemePackage/.test(src),
      '包根只声明 meta/views；配色必须落到 <设备>/<页面>/colors/ 下'
    );
    check(
      `「${pkg}」包定义不含 tokens（配色才给 token）`,
      !/\btokens\s*:/.test(src),
      '包根一旦带 tokens，就会重新变成"隐式默认配色"，与实体颜色目录重复'
    );
  } else {
    check(`「${pkg}」没有残留的 theme.scss（残缺目录）`, !existsSync(scss));
  }
}

console.log(`\n=== 3. 设备层（themes/<包>/<设备>/）===`);
for (const pkg of PACKAGES) {
  const devices = subdirs(join(PKGS, pkg));
  check(
    `「${pkg}」的设备目录都在白名单内（${DEVICES.join(' / ')}）`,
    devices.every(d => DEVICES.includes(d)),
    `实际：${devices.join(', ')} —— 不在白名单的目录会被注册表整个跳过`
  );
  // 2026-09-25 起：包可只覆盖部分设备。覆盖范围由包**自述**（coverage.devices），
  // 关卡据此推导该包应有的设备目录，不再写死 `pkg === 'compact'` 这类包名。
  const cov = coverageOf(pkg);
  for (const device of DEVICES) {
    if (!cov.devices.includes(device)) continue;
    check(
      `「${pkg}」有 ${device}/ 目录（设备层是包内的一级目录）`,
      isDir(join(PKGS, pkg, device)),
      '缺一个设备目录 → 该端在该包下没有任何版式与配色'
    );
  }
}

console.log(`\n=== 4. 配色（themes/<包>/<设备>/<页面>/colors/<配色>/）===`);
/**
 * 枚举「某包某设备某页面」下的配色目录。
 *
 * 🔴 2026-09-26 起只有一处位置：`<页面>/colors/`。
 *    旧形态（`<页面>/<版式>/colors/`）已删除 —— 一个主题包 = 一种版式。
 */
function colorDirOfPage(pkgDir, device, page) {
  const dir = join(pkgDir, device, page, COLORS_DIR);
  return isDir(dir) ? dir : null;
}

/** 每套配色一条记录：{ pkg, device, page, color } */
const paletteEntries = [];

/** 版本层（旧形态）违规定位：`{ where }` */
const variantDirHits = [];

for (const pkg of PACKAGES) {
  const pkgDir = join(PKGS, pkg);
  for (const device of DEVICES) {
    for (const page of PAGES) {
      const pageDir = join(pkgDir, device, page);
      if (isDir(pageDir)) {
        // 🔴 页面下只允许 `index.vue` + `colors/`：多出来的子目录 = 旧版式层或野目录
        const extra = subdirs(pageDir).filter(n => !PAGE_SUBDIRS.includes(n));
        for (const n of extra) variantDirHits.push(`${pkg}/${device}/${page}/${n}`);
      }
      const colorsDir = colorDirOfPage(pkgDir, device, page);
      if (!colorsDir) continue;
      const where = `${pkg}/${device}/${page}`;
      for (const color of subdirs(colorsDir)) {
        paletteEntries.push({ pkg, device, page, color });
        const dir = join(colorsDir, color);
        check(`「${where}/colors/${color}」目录名合法（[a-z0-9-]）`, ID_RE.test(color));
        const entry = join(dir, 'index.ts');
        check(`「${where}/colors/${color}」有 index.ts`, existsSync(entry), '缺了这套配色不出现');
        if (existsSync(entry)) {
          const src = read(entry);
          // 🔴 re-export 形态（2026-09-27 加设备演练）：见文件头 isReexport 说明。
          //    这里只验证 re-export 目标路径合法，meta/tone/tokens 由目标文件承担。
          const reexport = /export\s*\{\s*default\s*\}\s*from\s*['"]([^'"]+)['"]/.exec(src);
          if (reexport) {
            const target = reexport[1];
            const targetRe = new RegExp(
              `themes/${pkg}/(${DEVICES.join('|')})/${page}/colors/${color}/index$`
            );
            check(
              `「${where}/${color}」re-export 目标合法（同包 × 设备 × 页面 × 配色）`,
              targetRe.test(target),
              `目标「${target}」应指向同包(${pkg})同页(${page})同配色(${color})的另一设备目录`
            );
            continue;
          }
          check(`「${where}/${color}」有 default 导出`, /export\s+default\s/.test(src));
          check(`「${where}/${color}」含 meta`, /\bmeta\s*:/.test(src));
          check(
            `「${where}/${color}」是 MauthThemeColor（不是 Package）`,
            /satisfies\s+MauthThemeColor/.test(src),
            '配色契约已从 MauthThemePackage 拆出，写错会让 tokens 语义与文档不符'
          );
          check(
            `「${where}/${color}」tokens 是扁平值（无 light/dark 两档）`,
            !/\btokens\s*:\s*\{\s*(?:\/\*[^]*?\*\/\s*)?(?:light|dark)\s*:/.test(src),
            '2026-09-25 取消明暗档：tokens 就是一组 `--mauth-*: 值`，不再有 light/dark 子对象'
          );
          check(
            `「${where}/${color}」必填 tone（明暗 ≡ 色系）`,
            /\btone\s*:\s*['"](?:light|dark)['"]/.test(src),
            '每套配色必须声明自己属于白系还是黑系，否则明暗切换无卡可落'
          );
          check(
            `「${where}/${color}」文件头不带旧口径（配色挂在版式下 / view = base）`,
            !/挂在\*\*版式\*\*下/.test(src) &&
              !/view = `base`/.test(src) &&
              !/\[<版式>\/\]colors/.test(src),
            '一个主题包 = 一种版式：配色只挂在页面下，view 恒等于包名'
          );
        }
        const scss = join(dir, 'theme.scss');
        if (existsSync(scss) && read(scss).includes('data-mauth-theme')) {
          check(
            `「${where}/${color}」theme.scss 选择器用目录名 ${color}`,
            new RegExp(`data-mauth-theme\\s*=\\s*['"]${color}['"]`).test(read(scss)),
            '属性值必须等于目录名'
          );
        }
      }
    }
  }
}
console.log(
  `  （共 ${paletteEntries.length} 套配色记录，跨 ${PACKAGES.length} 包 × ${DEVICES.length} 设备）`
);

console.log(`\n=== 4b. 🔴 页面下没有「版式层」目录（一个主题包 = 一种版式）===`);
check(
  `页面目录下不存在多余子目录（只允许 ${PAGE_SUBDIRS.join(' / ')}）`,
  variantDirHits.length === 0,
  `${variantDirHits.slice(0, 5).join(', ')}${variantDirHits.length > 5 ? ` 等 ${variantDirHits.length} 处` : ''}` +
    ' —— 变体版式必须**新建主题包**（`themes/<新包>/<设备>/<页面>/`），不要建 `<页面>/<变体>/`'
);
for (const pkg of PACKAGES) {
  for (const device of DEVICES) {
    for (const page of PAGES) {
      const pageDir = join(PKGS, pkg, device, page);
      if (!isDir(pageDir)) continue;
      const entries = readdirSync(pageDir);
      check(
        `「${pkg}/${device}/${page}」只有 index.vue 与 ${COLORS_DIR}/`,
        entries.sort().join(',') === ['colors', 'index.vue'].sort().join(','),
        `实际：${entries.sort().join(', ')}`
      );
      break; // 每设备只抽第一页做条目级断言，全量由 4b 目录断言覆盖
    }
  }
}

console.log(`\n=== 5. 黑白是并列的实体颜色（自带底色，非"零 token 基线"）===`);
/**
 * 🔴 2026-09-25 改：`mono` 拆成 `black` / `white` 两个**独立**颜色，各写全 token
 * （自带底色，与明暗偏好无关）。这里断言：
 *   • 每个「包 × 设备 × 页面」下都同时有 black 与 white 两个实体目录
 *   • 两者都**不是**零 token（自带底色是本次改动的语义核心）
 *   • 两者 meta.id 与目录名字面一致
 */
let peerScopes = 0;
for (const pkg of PACKAGES) {
  const pkgDir = join(PKGS, pkg);
  const cov = coverageOf(pkg);
  for (const device of DEVICES) {
    for (const page of PAGES) {
      const colorsDir = colorDirOfPage(pkgDir, device, page);
      if (!colorsDir) continue;
      peerScopes += 1;
      const where = `${pkg}/${device}/${page}`;
      for (const color of cov.requiredColors) {
        const dir = join(colorsDir, color);
        check(
          `「${where}」有 colors/${color}/（黑白是与蓝青并列的实体颜色）`,
          isDir(dir),
          '黑白必须是实体目录且与彩色并列，否则它无法被显式选中、也不出现在列表里'
        );
        const entry = join(dir, 'index.ts');
        if (!existsSync(entry)) continue;
        const src = read(entry);
        // re-export 形态：底色 token 与 meta.id 由目标文件承担（见文件头 isReexport）
        if (isReexport(src)) continue;
        check(
          `「${where}/${color}」自带底色 token（不再是零 token 基线）`,
          /tokens\s*:\s*\{[\s\S]{0,240}?'--mauth-/.test(src),
          '自带底色是"选黑就是黑、选白就是白，与明暗偏好无关"的实现基础'
        );
        check(
          `「${where}/${color}」meta.id 为 ${color}`,
          new RegExp(`id:\\s*['"]${color}['"]`).test(src),
          'id 以目录名为准，写错会被目录名覆盖（但本关卡要求字面一致，便于阅读）'
        );
      }
    }
  }
}
console.log(`  （校验了 ${peerScopes} 个「包×设备×页面」作用域）`);

console.log(`\n=== 6. 配色 id 的唯一性作用域 = 同包同设备同页 ===`);
/*
 * ⚠️ 注册表用的 id 是**目录名**（`colorFromKey` 解析出的 `colorId`），不是 `meta.id`
 *    —— `meta.id` 只是被目录名覆盖掉的展示字段。所以唯一性必须按**目录名**判。
 * 唯一性作用域是「同包 × 同设备 × 同页」（2026-09-26 收窄：版式段消失，因为 view ≡ pkg）：
 * 跨页面 / 跨设备 / 跨包都可以同名（`black` 在每个作用域下各有一份是正常且必要的）。
 */
const scopeCounts = new Map();
for (const e of paletteEntries) {
  const key = `${e.pkg}/${e.device}/${e.page}`;
  if (!scopeCounts.has(key)) scopeCounts.set(key, []);
  scopeCounts.get(key).push(e.color);
}
let dupScopes = 0;
for (const [scope, colors] of scopeCounts) {
  const seen = new Set();
  const dups = colors.filter(c => (seen.has(c) ? true : (seen.add(c), false)));
  if (dups.length) {
    dupScopes += 1;
    check(
      `「${scope}」内配色 id 唯一`,
      false,
      `重复：${[...new Set(dups)].join(', ')} —— 同一页同名是真冲突（取值只给一个 id）`
    );
  }
}
check(
  '没有任何作用域内出现配色 id 重复',
  dupScopes === 0,
  `${dupScopes} 个作用域有重复`
);
const totalScopes = scopeCounts.size;
check(
  `每个作用域至少有一套配色`,
  [...scopeCounts.values()].every(list => list.length > 0),
  `共 ${totalScopes} 个作用域`
);

console.log(`\n=== 6b. 目录名与 meta.id 必须一致（id 以目录名为准）===`);
/*
 * 注册表把 `meta.id` 覆盖成目录名，所以两者不一致时：
 *   • 页面显示的名与 URL 里能用的 id 不是一个（`?theme=<meta.id>` 会解析失败）
 *   • `theme.scss` 的选择器若按 meta.id 写就永远落空
 * 两条都是静默故障，因此在关卡里要求字面一致。
 */
for (const e of paletteEntries) {
  const where = `${e.pkg}/${e.device}/${e.page}`;
  const entry = join(PKGS, e.pkg, e.device, e.page, COLORS_DIR, e.color, 'index.ts');
  if (!existsSync(entry)) continue;
  const entrySrc = read(entry);
  // re-export 形态：meta.id 由目标文件承担（见文件头 isReexport），跳过字面一致性检查
  if (isReexport(entrySrc)) continue;
  const declared = /id:\s*['"]([a-z0-9-]+)['"]/.exec(entrySrc)?.[1];
  check(
    `「${where}/${e.color}」meta.id 与目录名一致`,
    declared === e.color,
    declared === e.color
      ? ''
      : `文件里写的是 '${declared ?? '(缺)'}'，目录名是 '${e.color}' —— 注册表会以后者覆盖`
  );
}

console.log(`\n=== 7. 版式实现住在包内、按设备分区 ===`);
for (const pkg of PACKAGES) {
  const cov = coverageOf(pkg);
  for (const device of DEVICES) {
    const deviceDir = join(PKGS, pkg, device);
    if (!isDir(deviceDir)) continue;
    for (const page of PAGES) {
      // 2026-09-25 起：包可只覆盖部分页面。覆盖范围由包**自述**（coverage.pages），
      // 缺页面目录不算违规 —— 跨包路由由其它包或该端自带版式兜底。
      if (!cov.pages.includes(page)) continue;
      check(
        `「${pkg}/${device}」有 ${page}/index.vue（该包该设备的唯一版式）`,
        existsSync(join(deviceDir, page, 'index.vue')),
        '没有版式的包/设备在该页只能回落到容器的静态兜底'
      );
      check(
        `「${pkg}/${device}」${page}/base/index.vue 已不存在（去掉 base 层）`,
        !existsSync(join(deviceDir, page, 'base', 'index.vue')),
        '基础版式应直接是 <page>/index.vue，不应再有 base/ 目录'
      );
      // 🔴 2026-09-26：连"版式层目录"本身都不该存在
      const extra = subdirs(join(deviceDir, page)).filter(n => !PAGE_SUBDIRS.includes(n));
      check(
        `「${pkg}/${device}/${page}」下没有版式层目录`,
        extra.length === 0,
        `${extra.join(', ')} —— 换版式要新建主题包，不要建 <页面>/<变体>/`
      );
    }
    // 配色已下沉到页面下 → 设备层只允许出现页面目录
    const strays = subdirs(deviceDir).filter(n => !PAGES.includes(n));
    check(
      `「${pkg}/${device}」没有非法子目录`,
      strays.length === 0,
      `${strays.join(', ')} —— 配色住在 <页面>/colors/ 下，设备层不该再有其它目录`
    );
  }
}

console.log(`\n=== 7b. 每个版式都声明身份：data-mauth-view === 包名 ===`);
{
  // 版式根上的这个属性是**关卡与排查的唯一取值口**（Playwright 侧拿不到 store，
  // 只能从 DOM 读"现在渲染的是哪套 UI"）。规则文档要求**三端版式都带**它。
  // 🔴 值必须是**包名**：一个主题包 = 一种版式 ⇒ 版式 id ≡ 包名。
  //    写 'base' 是 2026-09-26 之前的旧口径 —— 那个名字在注册表里已经不存在了。
  for (const pkg of PACKAGES) {
    for (const device of DEVICES) {
      for (const page of PAGES) {
        const file = join(PKGS, pkg, device, page, 'index.vue');
        if (!existsSync(file)) continue;
        const src = read(file);
        // 🔴 版式 re-export（2026-09-27 加设备演练）：`import X from '…'; export default X;`
        //    （无 <template>）—— 该设备版式复用同包另一设备的版式（如 tablet 复用 standard），
        //    `data-mauth-view` 由目标版式承担（目标在同包另一设备目录，已被本段检查）。
        //    身份一致（都是 default 包），故放行，避免「加设备」时复制整份版式。
        if (!/<template>/.test(src) && /export\s+default\s+[A-Za-z_$][\w$]*\s*;?\s*<\/script>/.test(src)) {
          continue;
        }
        const m = /data-mauth-view="([^"]*)"/.exec(src);
        check(
          `「${pkg}/${device}/${page}」版式声明 data-mauth-view="${pkg}"`,
          Boolean(m) && m[1] === pkg,
          m ? `实际写了 "${m[1]}"` : '整份版式没有 data-mauth-view（关卡读不到身份）'
        );
      }
    }
  }
}

console.log(`\n=== 8. 版式跟随「主题包 × 设备」（实现口径）===`);
for (const page of PAGES) {
  const src = read(join(VIEWS, `${page}.ts`));
  check(
    `${page} 注册表版式 glob 跨全部主题包与设备`,
    src.includes(`themes/*/*/${page}/index.vue`),
    '版式在 <包>/<设备>/<页面>/index.vue，glob 必须带设备段'
  );
  check(
    `${page} 注册表**没有**旧的「变体版式」glob（多一层目录）`,
    !src.includes(`themes/*/*/${page}/*/index.vue`),
    '一个主题包 = 一种版式：多一层目录的 glob 会扫到 0 个文件，留着只会误导'
  );
  check(
    `${page} 注册表 glob 用 /src/ 根绝对路径（相对路径会静默扫不到）`,
    src.includes(`'/src/theme/themes/*/*/${page}/index.vue'`),
    '相对路径（../）在当前 Vite 版本下扫不到任何文件且不报错，必须用 /src/ 绝对路径'
  );
  check(
    `${page} 页面文件带上 page 名（defineThemePage 声明）`,
    new RegExp(`defineThemePage\\(\\{[\\s\\S]*?page:\\s*'${page}'`).test(src),
    '工厂靠 page 名从 glob 键里切出「包 / 设备」两段'
  );
  check(
    `${page} 页面文件**不再**声明 envView（部署级默认机制已取消）`,
    !/envView/.test(src),
    '部署级默认版式（VITE_<PAGE>_VIEW）已取消：换 UI 只靠换主题包或 URL 显式指定'
  );
  check(
    `${page} 选择器**不再**自己实现 asText / asPackage / asDevice`,
    !/function\s+asText/.test(src) && !/function\s+asPackage/.test(src) && !/function\s+asDevice/.test(src),
    '这三段曾是三页逐字重复的实现，漏改一处就是"三页不同形"'
  );
  check(
    `${page} 容器用 readDeviceParam 读设备维度参数（不从 route.query 直接取 view）`,
    read(join(ROOT, 'view', 'app', page, 'index.vue')).includes('readDeviceParam'),
    '`view.<设备>` / `view` 的取值链只应有一份实现（skinsuite 的 views/params.ts）'
  );
}
{
  // 版式**选择器**（取值链）——三页共用一份，所以这些都只断言一次
  // 2026-10-17 机制下沉内核 skinsuite/vue（view-picker.ts）
  const pickerSrc = implText(['vue/view-picker.ts']);
  check(
    '选择器工厂存在且导出 createViewPicker',
    /export\s+function\s+createViewPicker\(/.test(pickerSrc),
    '三页的取值链唯一实现（内核 skinsuite/vue 的 view-picker.ts）'
  );
  check(
    '选择器的输入含 device（第三段查找范围）',
    /device\?:\s*unknown/.test(pickerSrc),
    '设备是查找范围的第二段，不传就没法按端取版式'
  );
  check(
    '选择器有设备白名单归一（参数注入 asKnownDevice）',
    /asKnownDevice\(/.test(pickerSrc),
    '设备名是外部输入，必须落白名单；内核不认识设备词汇表，故参数注入'
  );
  check(
    '选择器把 source.theme 交给 registry.resolve（声明档，不自己判合法性）',
    /resolve\(\s*source\.theme,\s*pkg,\s*device\s*\)/.test(pickerSrc),
    '合法性只由注册表判：白名单、包 × 设备两段范围都在 resolve 里'
  );
  check(
    '选择器的 URL 分支：resolve(url,…) ?? pkg（非法值不回退到声明/环境变量档）',
    /if\s*\(url\)\s*return\s+registry\.resolve\(url,\s*pkg,\s*device\)\s*\?\?\s*pkg/.test(pickerSrc),
    'URL 显式给了值就不再回退；非法值落**当前包**（不是别的版式，更不是已废弃的 base）'
  );
  check(
    '选择器不再声称支持 `?pkg=` 参数（从未实现过）',
    !/\?pkg=/.test(pickerSrc),
    '切换包用 `?th=<目标包名>`，全仓没有任何地方读 query.pkg'
  );

  // 路由表固定声明（页面清单是宿主事实，不来自主题页面清单；预取已去掉）
  const routesSrc = read(join(ROOT, 'router', 'routes.ts'));
  check(
    '路由表固定声明主路由（PAGE_DEFS），不再由主题页面清单生成',
    /PAGE_DEFS/.test(routesSrc) && !/listPageViews/.test(routesSrc),
    'router 与主题分层：页面清单是宿主事实，路由表由 PAGE_DEFS 声明，不 import listPageViews'
  );
  check(
    '路由守卫不再预取版式 chunk（靠 <ThemeView> 挂载时加载）',
    !/withViewPreload/.test(routesSrc) && !/readDeclaredView/.test(routesSrc),
    '预取机制已移除：内置包 eager 零请求、非内置包由 <ThemeView> 挂载时 load'
  );
}
{
  const factory = implText(['vue/view-registry.ts']);
  check(
    '工厂只有一套键正则（无 variantKeyRe 残留）',
    factory.includes('baseKeyRe') && !factory.includes('variantKeyRe'),
    '一包一版式后没有"变体键"这种形态，留着就是死代码'
  );
  check(
    '工厂键正则含设备段',
    /themes\/\(\[\^\/\]\+\)\/\(\[\^\/\]\+\)\/\$\{page\}/.test(factory),
    '键正则必须有「包 / 设备」两段，否则设备维度会丢'
  );
  check('工厂按「包/设备」两段建表', factory.includes('${pkg}/${device}'), '不按两段分表就没法只查当前包当前设备');
  check(
    '工厂有设备白名单归一（参数注入 asKnownDevice）',
    /asKnownDevice\(/.test(factory),
    '设备名来自外部，必须归一；内核不认识设备词汇表，故参数注入'
  );
  check(
    '工厂只保留 bases 一张表（无 variants 残留）',
    /const\s+bases\s*=\s*new Map/.test(factory) && !/\bvariants\b/.test(factory),
    '一包一版式后"变体表"没有来源也没有消费者'
  );
  check(
    '工厂在内置包 + 默认设备时直接返回 null（交给容器静态引入）',
    /const\s+target\s*=\s*id\s*!==\s*pkg\s*&&\s*bases\.has\(scopeKey\(id,\s*device\)\)\s*\?\s*id\s*:\s*pkg/.test(
      factory
    ) && /if\s*\(target\s*===\s*builtinPackage\)\s*return\s+null/.test(factory),
    '这条是"默认路径零请求"的实现：不带 view 参数时 target === pkg === builtinPackage'
  );
  check(
    '工厂 resolve 把 `base` 归一成包名',
    /if\s*\(id\s*===\s*baseId\)\s*return\s+pkg/.test(factory),
    '`base` 现在只是逻辑 id，不是配色注册表的 view 取值：传 `base` 下去会让配色键全链落空'
  );
}

const themeIndexSrc = implText(['index.ts', 'registry.ts', 'constants.ts']);
const builtinPkg = /DEFAULT_THEME_PACKAGE\s*=\s*'([a-z0-9-]+)'/.exec(themeIndexSrc)?.[1];
check('DEFAULT_THEME_PACKAGE 常量存在（内核 skinsuite）', Boolean(builtinPkg), `值 = ${builtinPkg}`);
check(
  'theme/views/devices.ts 是设备取值集合的唯一来源（不再写死在常量里）',
  existsSync(DEVICES_FILE) && DEVICES.length > 0,
  `本关卡从 ${DEVICES_FILE} 读到设备：${DEVICES.join(' / ')}`
);
const devicesSrc = existsSync(DEVICES_FILE) ? read(DEVICES_FILE) : '';
check(
  'theme/views/devices.ts 用 defineThemeDevice 声明 + 从设备域派生（不再手写词汇表）',
  /defineThemeDevice/.test(devicesSrc) &&
    /fallbackDevice/.test(devicesSrc) &&
    !/const\s+DEVICE_IDS/.test(devicesSrc) &&
    !/export\s+const\s+THEME_DEVICES/.test(devicesSrc) &&
    !/export\s+type\s+ThemeDevice/.test(devicesSrc) &&
    !/DEFAULT_THEME_DEVICE\s*:/.test(devicesSrc),
  '设备清单由 defineThemeDevice 声明（自动注册设备域），id 清单与兜底设备从声明派生，不再手写 DEVICE_IDS/THEME_DEVICES/ThemeDevice/DEFAULT_THEME_DEVICE'
);

// ---- 🔴 判定归宿主（2026-10-19 定稿，2026-10-20 改 ThemeView props 告知）----
// 「当前是哪台设备」是业务口径：视口阈值 / UA / ?isMobile / ?from= / ?device= 都是本产品
// 的词汇。库只经 <ThemeView> 的 device prop 接收判定结果；库一旦自己 watch / 判定，
// 别的项目复用机制就被绑死了。
const deviceDomainSrc = implText(['vue/device-domain.ts']);
check(
  '设备判定归宿主：库的设备域只剩 URL 通道（不判设备、不 watch 任何东西）',
  /currentQuery/.test(deviceDomainSrc) &&
    !/export\s+function\s+currentPath/.test(deviceDomainSrc) &&
    !/matchMedia\s*\(/.test(deviceDomainSrc) &&
    !/detectMobileUA/.test(deviceDomainSrc) &&
    !/viewportIsMobile/.test(deviceDomainSrc) &&
    !/'isMobile'/.test(deviceDomainSrc) &&
    !/watch\s*\(/.test(deviceDomainSrc),
  '库内出现视口 / UA 判定或 watch 订阅 = 判定又下沉了（宿主的口径被写进通用机制）'
);
// 设备身份的**唯一告知入口** = <ThemeView> 的 device prop（分发器选容器、容器内告知，
// 两件事不会分家）；库不提供任何判定 composable / 注册槽。
const themeViewSrc = implText(['vue/ThemeView.vue']);
check(
  '<ThemeView> 用 device prop 告知主题 store（setActiveDevice，immediate）',
  /watch\(\s*\(\)\s*=>\s*props\.device/.test(themeViewSrc) &&
    /store\.setActiveDevice/.test(themeViewSrc) &&
    /immediate:\s*true/.test(themeViewSrc),
  'page/device props 即告知：分发器不碰主题，设备身份随容器渲染同帧进 store'
);
check(
  '<ThemeView> 不含判定词汇（不认视口 / UA / ?device=，只收 props）',
  !/matchMedia/.test(themeViewSrc) && !/detectMobileUA/.test(themeViewSrc),
  'ThemeView 只消费 props + store；任何判定词进库 = 宿主口径被写进通用机制'
);
// 🔴 theme/views 是**可整体迁移的纯声明目录**：只有 defineThemeDevice / defineThemePage。
//    判定（URL 词汇 / 视口 / UA）一旦写进去，就会被 virtual:theme 当声明副作用拉进包，
//    而且「主题域换个应用照搬」不再成立。
const resolverFile = join(ROOT, 'utils', 'device-resolve.ts');
const resolverSrc = existsSync(resolverFile) ? read(resolverFile) : '';
check(
  '宿主侧确有判定模块（utils/device-resolve.ts 的 resolveRenderDevice 纯函数）',
  /export\s+function\s+resolveRenderDevice\s*\(/.test(resolverSrc) &&
    !/from\s+'skinsuite/.test(resolverSrc),
  '判定是纯函数（query/path/mobile 显式入参）：零主题库 import、零闭包状态'
);
check(
  'theme/views/devices.ts 保持纯声明（不含判定实现与 URL 词汇）',
  !/resolveRenderDevice/.test(devicesSrc) &&
    !/isMobileViewport/.test(devicesSrc) &&
    !/'isMobile'/.test(devicesSrc) &&
    !/function\s+pathHasSegment/.test(devicesSrc),
  'theme/views 只放声明（defineThemeDevice）；判定要住 utils —— 主题域才可整体迁移'
);
// useRenderDevice = 薄封装（route + 视口信号 → 判定纯函数），同样零主题 import
// 🔴 视口信号名是**手抄判据**：信号升级必须同步这里（2026-10-24 mobileViewport 布尔
//    → viewportDevice 设备代码，平板三态）。判据红时先问「是信号改名了，还是接线真坏了」——
//    前者同步判据，后者修实现。手抄名不可怕，可怕的是落后了没人知道为什么红。
const useRenderDeviceFile = join(ROOT, 'composables', 'useRenderDevice.ts');
const useRenderDeviceSrc = existsSync(useRenderDeviceFile) ? read(useRenderDeviceFile) : '';
const useRenderDeviceCode = codeOnly(useRenderDeviceSrc);
check(
  'useRenderDevice 是薄封装（接线 route / 视口信号，不 import 主题库）',
  /export\s+function\s+useRenderDevice/.test(useRenderDeviceCode) &&
    /resolveRenderDevice/.test(useRenderDeviceCode) &&
    /viewportDevice/.test(useRenderDeviceCode) &&
    !/from\s+'skinsuite/.test(useRenderDeviceCode) &&
    !/setActiveDevice/.test(useRenderDeviceCode),
  '接线只做「把 route/视口接进纯函数」；告知主题是 ThemeView 的职责，不在这里'
);
// 装配层只传 router：判定不在 app.use(theme) 上注册（没有注册槽，也不需要）
const bootstrapFile = join(ROOT, 'bootstrap.ts');
const bootstrapSrc = existsSync(bootstrapFile) ? read(bootstrapFile) : '';
check(
  'bootstrap 主题装配只传 router（无判定注册槽）',
  /app\.use\(theme,\s*\{\s*router\s*\}\)/.test(bootstrapSrc) && !/deviceResolver/.test(bootstrapSrc),
  '设备判定不在装配层：宿主设备模块自管，主题 store 只经 ThemeView props 接收'
);
// 四个页面分发器：用宿主设备模块选容器（Map + 末条兜底），**不碰主题**
const dispatcherPages = ['login', 'register', 'forgot-password', 'not-found'];
for (const page of dispatcherPages) {
  const file = join(ROOT, 'view', 'web', page, 'index.vue');
  const src = existsSync(file) ? read(file) : '';
  const code = codeOnly(src);
  check(
    `分发器 view/web/${page}/index.vue 用 useRenderDevice 选容器（不碰主题）`,
    /useRenderDevice\(\s*\)/.test(code) &&
      /deviceComponents/.test(code) &&
      /fallbackDevice\(\)/.test(code) &&
      !/setActiveDevice/.test(code) &&
      !/useThemeStore/.test(code),
    '分发器只判设备选容器（Map + 末条兜底）；设备身份由容器内 <ThemeView device="…"> 告知 store'
  );
}
const kernelDeviceSrc = implText(['views/device.ts']);
check(
  '内核 views/device.ts 只剩清单与查询（无 match / pickDeviceId / deviceContext 实现）',
  !/export\s+function\s+pickDeviceId/.test(kernelDeviceSrc) &&
    !/export\s+function\s+deviceContext/.test(kernelDeviceSrc) &&
    !/match\s*\(ctx/.test(kernelDeviceSrc),
  '判定实现残留在内核 = 两套判定并存，ThemeView props 告知会被绕过'
);

// ---- 默认版式 / 默认配色（2026-09-26 用户定：default + white）----
const defaultColor = /DEFAULT_THEME_COLOR\s*=\s*'([a-z0-9-]+)'/.exec(themeIndexSrc)?.[1];
const defaultDarkColor = /DEFAULT_THEME_DARK_COLOR\s*=\s*'([a-z0-9-]+)'/.exec(themeIndexSrc)?.[1];
check(
  '默认配色是**显式常量**（不再靠"字母序第一"）',
  Boolean(defaultColor),
  'export const DEFAULT_THEME_COLOR = …；靠字母序时"默认外观"是命名巧合的副产品'
);
check(
  `默认配色就是 ${DEFAULT_PEER_COLORS[1]}（用户口径：默认版式 default + 默认配色 white）`,
  defaultColor === DEFAULT_PEER_COLORS[1],
  `值 = ${defaultColor}`
);
check(
  '暗系兜底是它的配对色（white ↔ black）',
  defaultDarkColor === DEFAULT_PEER_COLORS[0],
  `DEFAULT_THEME_DARK_COLOR = ${defaultDarkColor}`
);
check(
  'defaultColorIdOf 先取显式默认色，该范围没有才退回字母序第一',
  /if\s*\(ids\.includes\(DEFAULT_THEME_COLOR\)\)\s*return\s+DEFAULT_THEME_COLOR/.test(themeIndexSrc),
  '否则新增一个字母序更靠前的配色 id（如 amber）会静默改掉默认外观'
);
if (defaultColor) {
  const missingDefault = [];
  for (const pkg of PACKAGES) {
    for (const device of DEVICES) {
      for (const page of PAGES) {
        const colorsDir = colorDirOfPage(join(PKGS, pkg), device, page);
        if (!colorsDir) continue;
        if (!isDir(join(colorsDir, defaultColor))) missingDefault.push(`${pkg}/${device}/${page}`);
      }
    }
  }
  check(
    `每个「包 × 设备 × 页面」都有默认配色 colors/${defaultColor}/（默认色必须是处处可用的实体）`,
    missingDefault.length === 0,
    missingDefault.slice(0, 6).join(', ')
  );
}

for (const page of PAGES) {
  const container = read(join(ROOT, 'view', 'app', page, 'index.vue'));
  const imported = new RegExp(
    `@/theme/themes/([a-z0-9-]+)/mobile/${page}/index\\.vue`
  ).exec(container)?.[1];
  check(
    `${page} 容器静态引入内置包 × mobile 的版式`,
    Boolean(imported),
    '内置包的版式必须静态引入（首屏零请求）'
  );
  check(
    `${page} 容器引入的包 === DEFAULT_THEME_PACKAGE（${builtinPkg}）`,
    imported === builtinPkg,
    `容器写的是 ${imported}，两边不一致时"零请求"那条路径就断了`
  );
  check(
    `${page} 容器写死 THEME_DEVICE = 'mobile'（设备是页面身份）`,
    /const\s+THEME_DEVICE\s*=\s*'mobile'\s+as\s+const/.test(container),
    '移动端容器不跑视口判定，身份由文件位置决定'
  );
  check(
    `${page} 容器的切换 watch 依赖 themeStore.packageId`,
    /watch\(\s*\[viewId,\s*\(\)\s*=>\s*themeStore\.packageId\]/.test(container),
    '换包但 viewId 字符串没变时必须重新取组件'
  );
  check(
    `${page} 容器调 load 时传了 THEME_DEVICE`,
    new RegExp(`Views\\.load\\([^)]*THEME_DEVICE\\)`).test(container),
    '不传设备就查不到版式'
  );
}

console.log(`\n=== 8b. 三设备容器各自静态引入自己设备的版式（首屏零请求）===`);
{
  /** 每个设备在 `view/` 下的容器文件（设备三值化的落地形态） */
  const DEVICE_CONTAINERS = [
    ['mobile', p => join(ROOT, 'view', 'app', p, 'index.vue'), 'mobile'],
    ['standard', p => join(ROOT, 'view', 'web', p, 'Standard.vue'), 'standard'],
    ['mini', p => join(ROOT, 'view', 'web', p, 'Mini.vue'), 'mini']
  ];
  for (const [label, pathOf, deviceName] of DEVICE_CONTAINERS) {
    for (const page of PAGES) {
      const p = pathOf(page);
      if (!existsSync(p)) continue;
      const src = read(p);
      check(
        `${label}/${page} 容器静态引入 themes/${builtinPkg}/${deviceName}/${page}/index.vue`,
        src.includes(`@/theme/themes/${builtinPkg}/${deviceName}/${page}/index.vue`),
        `三个设备各自静态引入自己那份，load() 返回 null 才对所有设备都成立`
      );
      check(
        `${label}/${page} 容器写死 THEME_DEVICE = '${deviceName}'`,
        new RegExp(`const\\s+THEME_DEVICE\\s*=\\s*'${deviceName}'\\s+as\\s+const`).test(src),
        '容器身份取常量，不跑视口判定'
      );
    }
  }
}

console.log(`\n=== 9. 主题状态机接线（scope/intent/runtime，2026-10-19 下沉 skinsuite/vue）===`);
{
  // 🔴 2026-10-19 状态机 composable 下沉进 skinsuite/vue，宿主题 theme.ts 退化为壳，
  //    断言读库内三个文件拼接（内容不变，只是搬家）。
  const readVue = rel => {
    const p = join(CORE, 'vue', rel);
    return existsSync(p) ? read(p) : '';
  };
  const store = [readVue('theme-scope.ts'), readVue('theme-intent.ts'), readVue('theme-runtime.ts')].join('\n');
  const scopeSrc = readVue('theme-scope.ts');
  check('scope 有 activeDevice', /const\s+activeDevice\s*=\s*ref<string>/.test(scopeSrc));
  check('scope 有 setActiveDevice', /function\s+setActiveDevice/.test(scopeSrc));
  check(
    'token 注入 watch 依赖 activeDevice',
    /watch\(\s*\[\s*themeTokens,\s*externalTokens,\s*activeDevice,\s*isDark\s*\]/.test(store),
    '不依赖设备 → 从 /login 跳到 /m/login 时 token 不会重算'
  );
  check(
    'token 注入不再按明暗取档（tokens 已扁平化）',
    /applyThemeLayers\(\{\s*theme:\s*themeTokens\.value,\s*external:\s*externalTokens\.value\s*\}\)/.test(
      store
    ),
    '2026-09-25 取消 tokens 的 light/dark 两档 → applyThemeLayers 不再接收 isDark'
  );
  check(
    'runtime 的 tokens 是扁平 Record（无 light/dark 档）',
    /export\s+type\s+ThemeTokenOverrides\s*=\s*Record<string,\s*string>/.test(
      implText(['runtime.ts', 'tokens.ts'])
    ),
    'tokens 应是一组扁平值：`{ "--mauth-x": "…" }`'
  );
  check(
    '明暗标配对复用默认色常量（store 里不再硬编码 white / black）',
    /target\s*===\s*'dark'\s*\?\s*DEFAULT_THEME_DARK_COLOR\s*:\s*DEFAULT_THEME_COLOR/.test(store),
    '硬编码会让「默认色」出现两个真相源：改常量改不动明暗联动'
  );
  check(
    'data-mauth-theme watch 依赖 deviceTheme / activeDevice / activePage / activeView',
    /watch\(\s*\[\s*themeId,\s*deviceTheme,\s*activeDevice,\s*activePage,\s*activeView\s*\]/.test(store),
    '同一个 themeId 在四段归属不同的地方解析出的记录可能不同（不匹配时回落），' +
      '漏掉 deviceTheme 就漏掉"某设备单独指定了配色"这一类切换'
  );
  check(
    '回落档不写 data-mauth-theme 属性',
    /if\s*\(record\.meta\.id\s*===\s*id\)\s*root\.dataset\.mauthTheme\s*=\s*id/.test(store),
    '跑了回落档还写属性会让 theme.scss 选择器挂到一套没生效的配色上'
  );
  check(
    'themeRecordFor 按 pkg/device/page/view 解析（view ≡ pkg）',
    /function\s+themeRecordFor\(\s*pkg:\s*string\s*=\s*DEFAULT_THEME_PACKAGE/.test(store)
  );
  check(
    'store 有设备维度的 URL 意图（deviceTheme）',
    /deviceTheme\s*=\s*ref<DeviceThemeIntent>/.test(store),
    '`?theme.<设备>=` 的落点；没有它就只能全局一个 id'
  );
  check(
    'store 有按设备的 URL 锁（urlLockedThemeOf）',
    /function\s+urlLockedThemeOf/.test(store),
    'URL 锁必须按设备分开，否则手机端钉了配色会把电脑端的手动选择也锁死'
  );
  check(
    'themeRecordFor 取"设备专属 id 优先，否则全局 id"',
    /deviceTheme\.value\[device\]\s*\?\?\s*themeId\.value/.test(store),
    '这是"同一主题不同设备不同配色"与"三端共用同一主题"两条场景的唯一合流点'
  );
  check(
    '显式选色会清掉本设备的 URL 覆盖（URL 不压过用户操作）',
    /clearDeviceThemeOverride\(/.test(store),
    'setTheme / cycleMode / toggleTheme 清锁；setMode 不清（后端与父应用要留在 URL 之下）'
  );
}
{
  // 🔴 2026-10-17 起设备同步的**机制**下沉进主题库 `skinsuite/vue` 的 `setupTheme`，
  //    宿主的「接线」（设备来源 / 写入目标 / 清单路由）内联回 `bootstrap.ts`（装配层）。
  //    所以断言拆两块：机制读内核，接线读 bootstrap。
  const setup = implText(['vue/setupTheme.ts']);
  const bootstrap = read(join(ROOT, 'bootstrap.ts'));

  check(
    '内核导出了 setupTheme（主题域初始化的唯一机制入口）',
    /export\s+function\s+setupTheme\s*\(/.test(setup),
    '设备同步的机制必须收在库里，不能让每个宿主重演「watch 而非 afterEach」这套踩坑结论'
  );
  check(
    '设备同步用 watch(来源函数返回值) 而不是 afterEach',
    /watch\(\s*options\.deviceSource/.test(setup) || /watch\(\s*[\w.]+deviceSource/.test(setup),
    '⚠️ 写在 afterEach 里会让**首次**导航静默失效：app.use(router) 触发首导航时 ' +
      'Pinia 的 activeInstance 尚未建立，useThemeStore() 抛错被吞 → 电脑端永远按手机端渲染'
  );
  check(
    '设备同步 watch 带 immediate（覆盖首次导航）',
    /\{\s*immediate:\s*true\s*\}/.test(setup),
    '没有 immediate 就漏掉首屏那一次'
  );
  check(
    'bootstrap.ts 直接调 setupTheme（接线内联到装配层）',
    /setupTheme\s*\(\s*\{/.test(bootstrap),
    '设备来源 / 写入目标 / 清单路由三个宿主事实在装配层内联，新项目只需调一次'
  );
  check(
    '设备由 RouteMeta.device 判定（不是视口）',
    /currentRoute\.value\.meta\.device\s*===\s*'mobile'\s*\?\s*'mobile'\s*:\s*'standard'/.test(bootstrap),
    '用视口判会出现"分发器渲染移动端组件、路由说电脑端"的分裂'
  );
  check(
    '接线把设备写回主题 store 的 setActiveDevice',
    /setActiveDevice\s*\(/.test(bootstrap) && /themeManifest\.routes/.test(bootstrap),
    '写入目标 = 主题 store；清单路由 = 虚拟模块解析出的 manifest'
  );
  check(
    'bootstrap.ts 在 app.use(pinia) 之后调用 setupTheme',
    (() => {
      const piniaAt = bootstrap.indexOf('app.use(pinia)');
      const setupAt = bootstrap.indexOf('setupTheme(');
      return piniaAt !== -1 && setupAt !== -1 && setupAt > piniaAt;
    })(),
    '函数内部会 useThemeStore()，必须在 Pinia activeInstance 建立之后调用'
  );
  check(
    '路由守卫预取用 readDeviceParam 取版式（与容器同一取值链）',
    read(join(ROOT, 'router', 'routes.ts')).includes('readDeviceParam'),
    '守卫与容器各写一套取值链必然漂移（预取 `view.standard=compact` 会预取错包）'
  );
}

console.log(`\n=== 10. 注册表实现与文档口径一致（已退役）===`);
{
  // ⊘ 整节退役（2026-10-19）：本节断言的是「资产在宿主 `src/theme-manifest.ts` 里
  //   `import.meta.glob` → 装配注册表」这套旧装配。它已被两层取代：
  //     · 构建期：`skinsuite/vite` 的 `themeAssets()` 扫 `VITE_THEME_DIR`，产出
  //       `virtual:theme`（宿主零 glob、零装配代码）；
  //     · 运行期：`import 'virtual:theme'` 的副作用完成 installThemeViews /
  //       注册表 / 清单装配，宿主只剩一行 import。
  //   「目录真的被扫到」仍由 `e2e/verify-glob-device.mjs` 拿插件的真实扫描产物来验，
  //   覆盖面没有丢。
  console.log('  ⊘ 第 10 节整体退役：装配已迁到 skinsuite/vite + virtual:theme（见上）');
}

console.log('\n=== 11. 设备维度 URL 参数（theme.<设备> / view.<设备>）===');
{
  const params = implText(['views/params.ts']);
  check(
    'params.ts 导出 readDeviceParam',
    /export\s+function\s+readDeviceParam/.test(params),
    '版式侧的设备维度取值入口'
  );
  check(
    'params.ts 先取 `<名>.<设备>`，再回退通用 `<名>`',
    /query\?\.\[\s*`\$\{name\}\.\$\{device\}`\s*\]/.test(params) && /return\s+query\?\.\[name\]/.test(params),
    '顺序反了会让设备专属参数永远不生效'
  );
  check(
    'params.ts 把空串当"未指定"（不吞掉回退链）',
    /function\s+isPresent/.test(params),
    '`?view.mobile=&view=compact` 里 mobile 侧应回退到通用的 compact'
  );

  // ⚠️ 配色侧的 URL 解析逻辑已随状态机下沉进 `skinsuite/vue` 的 theme-persistence.ts
  //    （纯函数层）。断言读库内实现，否则下沉后本组读空。
  const store = [
    read(join(ROOT, 'stores', 'theme.ts')),
    existsSync(join(CORE, 'vue', 'theme-persistence.ts'))
      ? read(join(CORE, 'vue', 'theme-persistence.ts'))
      : ''
  ].join('\n');
  check(
    '配色侧按设备读 `theme.<设备>` / `skin.<设备>`',
    /params\.get\(\s*`theme\.\$\{device\}`\s*\)/.test(store) &&
      /params\.get\(\s*`skin\.\$\{device\}`\s*\)/.test(store),
    '「分别配置」那条场景的落点：每个设备各自一个 id'
  );
  check(
    '设备维度参数不写 localStorage（它是访问意图，不是用户选择）',
    !/setItem\(\s*`theme[-.]\$\{?device/.test(store),
    '把"这次访问的意图"持久化会让下一次访问莫名带着上次的 URL 指派'
  );
  check(
    '配色侧也把空串当"未指定"（与 readDeviceParam 同形）',
    /function\s+present|const\s+present\s*=\s*\(/.test(store) &&
      /present\(\s*params\.get\(\s*`theme\.\$\{device\}`\s*\)/.test(store) &&
      /present\(\s*params\.get\(\s*'theme'\s*\)/.test(store),
    'URLSearchParams.get() 对 `?theme.mobile=` 返回空串（不是 null），' +
      '`\'\' ?? anyScope` 仍是空串 → 通用键也一起失效，与"留空 = 不特殊指定"相反'
  );
}

console.log('\n=== 12. 版式声明：三页纯副作用 defineThemePage + 容器 <ThemeView> ===');
{
  /**
   * 页面名 → 契约文件名。页面文件是**纯声明**：契约类型 + 一句 `defineThemePage({ page })`
   * （副作用注册进页面域）。版式组件清单由内核从 virtual:theme 装好的单例**惰性解析**，
   * 容器只用 `<ThemeView page>` 渲染、不自己 pick —— 所以这里不再有 pick / preload / envView。
   */
  const PAGE_FILES = [
    ['login', 'login.ts'],
    ['register', 'register.ts'],
    ['forgot-password', 'forgot-password.ts']
  ];
  for (const [page, file] of PAGE_FILES) {
    const src = read(join(VIEWS, file));
    check(
      `${file} 用 defineThemePage({ page }) 副作用声明（无 envView / loaders / themeViews）`,
      new RegExp(`defineThemePage\\(\\{\\s*page:\\s*'${page}'\\s*\\}\\)`).test(src) &&
        !/envView/.test(src) &&
        !/loaders/.test(src) &&
        !/themeViews/.test(src),
      '页面文件退化成「契约类型 + 一次声明」；版式清单由内核 virtual:theme 装单例后惰性解析'
    );
    check(
      `${file} 不再导出 pick / preload / 页面对象（容器走 <ThemeView> 的 pageOf）`,
      !/export\s+const\s+(loginPage|registerPage|forgotPasswordPage|pick\w+ViewId|preload\w+View|\w+Views)/.test(src),
      '版式加载/回退/选择全在 <ThemeView> 内，容器不再按 pickLoginViewId / preloadLoginView 取'
    );

    const container = read(join(ROOT, 'view', 'app', page, 'index.vue'));
    check(
      `${page} 容器用 <ThemeView page="${page}"> 渲染（不手动 pick）`,
      new RegExp(`<ThemeView\\s+page="${page}"`).test(container),
      '版式加载/回退/选择全在 <ThemeView> 内，容器只组装 ctx'
    );
  }
}

console.log('\n=== 13. theme-core 包契约（依赖方向 + 公开面 + 壳无逻辑）===');
{
  /**
   * 为什么要有这一节：抽包把"内核"从进程内的一块目录变成了**可被别的宿主消费的包**，
   * 于是「内核不知道宿主」这条原则（立项文档 §〇）必须从口头约定变成机械断言 ——
   * 否则三个月后必然出现"包内偷偷 import 宿主"，那时包再也拿不出去，只能回滚。
   *
   * ⚠️ 源码里的**块注释与整行注释先剔掉再看**：注释是给人读的，提到 DOM 不等于用了 DOM。
   *    行尾 `//` 注释保留（它们是正则的注解，本身也不含禁用词）。
   */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  if (!isDir(CORE)) {
    check(
      `内核包实现目录存在（${MONOREPO_FORM ? 'packages/theme-core/src' : 'node_modules/skinsuite/src'}）`,
      false,
      `未找到 ${CORE} —— 抽包后退化成"没有内核包"，本节的其余断言失去意义`
    );
  } else {
    const coreFiles = [];
    (function walk(dir) {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        // `src/vue/` 是**独立的 Vue 绑定入口**（`skinsuite/vue`），职责本来就是碰 vue
        // 与 window —— "零依赖纯内核"这条约束只对除它以外的 src 生效。
        // （包自己的 tsconfig 也把 `src/vue/**` 排除在外，理由同构：`.vue` 只能由宿主的
        // vue-tsc 检查，不该被内核的 tsc 纳入。）
        if (isDir(p)) {
          if (n !== 'vue') walk(p);
        } else if (/\.ts$/.test(n)) coreFiles.push(p);
      }
    })(CORE);
    check('内核包有源码文件', coreFiles.length > 0, `${coreFiles.length} 个 .ts`);
    check(
      '框架耦合集中在 src/vue（本轮扫描刻意跳过的那一层）',
      isDir(join(CORE, 'vue')),
      '目录结构变了的话，"跳过 src/vue" 这条就失去了对象，必须回来重新确认约束边界'
    );

    const banned = [
      ['import.meta（构建器耦合）', /\bimport\.meta\b/],
      ['window / document（DOM）', /\b(?:window|document)\s*\./],
      ['localStorage（存储）', /\blocalStorage\b/],
      ['非 import type 的 vue（框架耦合）', /import\s+(?!type\b)[^;\n]*from\s+['"]vue['"]/],
      ['vue-router（应用世界观）', /from\s+['"]vue-router['"]/],
      ['axios / fetch（网络）', /\baxios\b|\bfetch\s*\(/],
      ['@/ 别名（宿主路径）', /from\s+['"]@\//]
    ];
    for (const [label, re] of banned) {
      const hits = coreFiles
        .filter(f => re.test(strip(read(f))))
        .map(f => f.slice(CORE.length + 1).replace(/\\/g, '/'));
      check(`内核不依赖：${label}`, hits.length === 0, hits.join(', '));
    }

    const barrel = read(join(CORE, 'index.ts'));
    const REQUIRED = [
      'DEFAULT_THEME_COLOR',
      'DEFAULT_THEME_DARK_COLOR',
      'readDeviceParam',
      'normalizeTone',
      'normalizeMode',
      'isSafeTokenEntry',
      'sanitizeOverrides'
    ];
    // 设备取值集合已下沉到宿主（2026-09-27）：内核**不该**导出 THEME_DEVICES /
    // DEFAULT_THEME_DEVICE / asThemeDevice —— 那是应用的词汇表，不是机制。
    const MUST_NOT_EXPORT = ['THEME_DEVICES', 'DEFAULT_THEME_DEVICE', 'asThemeDevice'];
    const leaked = MUST_NOT_EXPORT.filter(n => new RegExp(`\\b${n}\\b`).test(barrel));
    check(
      '内核不再导出设备取值集合（THEME_DEVICES / DEFAULT_THEME_DEVICE / asThemeDevice）',
      leaked.length === 0,
      `泄漏：${leaked.join(', ')} —— 设备清单随应用走（oauth21/src/theme/devices.ts），内核只认"设备名是个字符串"这条形态`
    );
    const missing = REQUIRED.filter(n => !new RegExp(`\\b${n}\\b`).test(barrel));
    check(
      '内核公开面（src/index.ts）含全部关键导出',
      missing.length === 0,
      `缺：${missing.join(', ')}`
    );
    check(
      '内核公开面用显式具名导出（不用 `export *`）',
      !/export\s+\*\s+from/.test(barrel),
      '`export *` 会把"包承诺了什么"变成隐式清单：加一个内部导出就悄悄扩大了对外承诺'
    );
  }

  /**
   * 壳：`@/theme/*` 的导入面靠它们保持不变，所以壳本身**不许有实现**。
   * 判定方式：先剔注释，再把**整条** `export {…} from '…';` 语句删掉
   * （⚠️ 按行判会误伤多行花括号导出 —— 续行不以 `export` 开头），剩下的必须是空。
   *
   * 🔴 2026-10-17 下沉：`tone.ts` / `mode.ts` / `types.ts` 已**彻底删除**（不是留壳）
   *    —— 它们的导出全并进 `theme/index.ts` 的内核 re-export（`from 'skinsuite'`），
   *    导入面 `@/theme` 不变，所以不再要求同名壳文件存在。`views/params.ts` 也一并删除
   *    —— `readDeviceParam` 纯函数（不碰 vue-router，只收 `Record<string, unknown>`）
   *    已在内核，宿主直接 `from 'skinsuite'`，不再留 re-export 壳。
   */
  const SHELLS = [];
  const REMOVED_SHELLS = ['tone.ts', 'mode.ts', 'types.ts', join('views', 'params.ts')];
  for (const rel of REMOVED_SHELLS) {
    const label = rel.replace(/\\/g, '/');
    check(
      `壳 ${label} 已删除（导出并入 theme/index.ts 的内核 re-export）`,
      !existsSync(join(THEME, rel)),
      '抽包后这些纯类型/纯函数的导出走 `@/theme` 的内核转发即可，留壳反而造出两份真相'
    );
  }
  for (const rel of SHELLS) {
    const p = join(THEME, rel);
    const label = rel.replace(/\\/g, '/');
    if (!existsSync(p)) {
      check(`壳 ${label} 存在`, false, '抽包后应用侧应留同名转发壳，导入面才不变');
      continue;
    }
    const logic = strip(read(p))
      .replace(/export\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    check(`壳 ${label} 里只有转发（无逻辑）`, logic.length === 0, logic.slice(0, 2).join(' | '));
    check(
      `壳 ${label} 从内核包转发`,
      /from\s+['"]skinsuite['"]/.test(read(p)),
      '转发源必须是包名（而不是相对路径指回包内源码），否则 alias/paths 一改就静默错位'
    );
  }
}

const total = pass + failures.length;
console.log(
  `\n===== ${failures.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过，${retired} 项已退役 =====`
);
if (failures.length) {
  console.log('失败项：');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
