# 主题热更新部署设计 {#theme-hot-update}

> **设计文档（尚未实现）。** 本文给出「不重新发前端版本就能换主题」的完整部署设计：
> 三层模型、产物契约、运行时加载器代码、部署拓扑、灰度回滚与分期路线。
> 落地按第七节路线走，每期独立可回滚；未落地前对现有行为**零影响**
> （未配置 manifest 端点时整个机制不发请求，与 `src/theme/remote.ts` 同一口径）。
>
> 相关文档：主题机制总规范 `docs/theme-replacement.md`（根仓 `docs/standards/` 有主本）；
> 实例数据 `docs/multi-theme.md`；env 变量清单见根目录 `.env.example`。

---

## 一、背景：两条已有路径与一个缺口

换主题的诉求按"改动多大"分三档，前两档**现在已经支持**，第三档是本文要补的缺口：

| 档位 | 诉求 | 现状 | 靠什么 |
| --- | --- | --- | --- |
| L1 | 换几个色值 / 圆角 | ✅ 已支持 | 后端下发 token 覆写（`VITE_THEME_ENDPOINT`，见 `src/theme/remote.ts`） |
| L2 | 在内置配色之间切换 | ✅ 已支持 | 后端下发 `theme` id（**只能选构建期已登记的**） |
| L3 | 换一整套设计（新配色 + 新结构 + 新版式） | ❌ **要重新发版** | 本文设计 |

缺口的根源：主题注册表是**构建期**的 —— `src/theme/registry.ts` 用
`import.meta.glob('./themes/*/*/*/colors/*/index.ts', { eager: true })` 把
`src/theme/themes/` 下的一切编译进 bundle。目录里没有的包，运行时不可能出现；
后端下发一个未登记的 id 只会被 `resolveThemeId` 判非法、静默回落。

L3 的目标：**部署方把新主题包作为独立产物发到 CDN，前端运行时拉下来注册**，
同一份前端构建服务任意多套设计，换设计不发版。

---

## 二、三层热更新模型

```
                 ┌────────────────────────────────────────────┐
   部署方后台 ──▶ │ L1 tokens（CSS 变量覆写）       换色，零部署 │
   （按 client_id）│ L2 theme id（已登记配色）       换配色，零部署 │
                 │ L3 manifest + 主题包产物         换设计，发 CDN │
                 └────────────────────────────────────────────┘
                                      │
   前端 ── 内置注册表（构建期 glob）◀──┤── 运行时热更注册表（L3，优先级更高）
                                      │
                               URL ?theme= / 本地偏好（仍最高，见 theme-replacement.md）
```

设计原则：

1. **三层可叠加**：L3 提供"新包"，L2 按租户选包内配色，L1 在选中配色上再覆写
   token。三层互不替代 —— 让"只换一个主色"的诉求永远走最便宜的 L1。
2. **热更是增量不是替换**：内置包永远是兜底。manifest 拉不到 / 包加载失败 /
   形状不合法，一律回落到内置包，登录流程零感知（与 `remote.ts` 的失败策略一致）。
3. **manifest 即开关**：下架一个主题 = 从 manifest 里删掉它；回滚 = 把 entry
   指回上一个版本。不需要动前端、不需要清 CDN 缓存（旧版本产物留着即可）。

---

## 三、L3 主题包热更新 —— 完整设计

### 3.1 产物契约

主题包独立构建，产物部署在 CDN / 对象存储 / 任意静态托管上：

```
themes-dist/                        # 构建产物，独立于前端 dist/ 发布
├── manifest.json                   # 唯一入口：有哪些包、各是什么版本
└── packages/
    ├── ocean@1.2.0/
    │   ├── index.4f2a.js           # ESM：default export 包定义（见下）
    │   ├── colors.9c1e.css         # 该包全部配色的 theme.scss 编译产物（拼接）
    │   └── views.a83b.js           # 可选：版式组件异步入口（P1 再上，见 3.7）
    └── brand-x@0.1.0/
        └── …
```

`manifest.json`：

```jsonc
{
  "version": 3,                    // manifest 自身结构版本，加载器只认已知版本
  "generatedAt": "2026-10-15T10:00:00Z",
  "packages": [
    {
      "id": "ocean",               // 主题包 id；与内置包同名 = 覆盖内置包（见 3.6）
      "version": "1.2.0",
      "entry": "packages/ocean@1.2.0/index.4f2a.js",
      "styles": ["packages/ocean@1.2.0/colors.9c1e.css"],
      "integrity": "sha384-Base64…",   // 对 entry + styles 逐文件校验（SRI）
      "minFrontend": "1.0.0",       // 要求的最低前端版本；不满足跳过该包
      "devices": ["mobile", "standard", "mini"]  // 该包覆盖的设备（声明不全按缺失处理）
    }
  ]
}
```

包模块（`index.*.js`）的导出形状**必须与 `MauthThemePackage` 一致**（契约见
`packages/theme-core/src/types.ts`，本仓 `src/theme/types.ts` 是 re-export 壳）：

```ts
// 构建产物里 default export 的形状
export default {
  meta: { id: 'ocean', name: '深海', description: '…', preview: { primary: '#0e7490' } },
  views: { login: 'ocean', register: 'ocean' }   // 可选；版式 id ≡ 主题包名
} satisfies MauthThemePackage
```

🔴 **配色不进 entry**：配色的 tokens / tone / 附加样式走 `styles` 里的 CSS
（`html[data-mauth-theme='ocean'] { --mauth-primary: … }`），加载器用
`<link>` 注入。理由：token 是纯数据、可过白名单校验，而 JS 是代码 ——
**能不发代码就不发代码**，把热更面尽量收窄成"数据 + 少量注册胶水"。
整包 JS 化（含 .vue 版式组件）是 P1 的可选项，不是 P0 必做项。

### 3.2 构建：`scripts/build-themes.mjs`

```js
// 伪代码 —— 遍历 src/theme/themes/*，每包一个 vite lib 构建
// 关键点：external 掉 vue/pinia 等 peer（热更包与宿主共享同一份框架实例，
// 绝不能各打一份 vue 进 bundle —— 与 packages/theme-core 的"内核零外部 import"
// 是同一条红线）；css 单独产出不内联。
for (const pkg of readdirSync('src/theme/themes')) {
  await viteBuild({
    root: 'src/theme/themes/' + pkg,
    build: {
      outDir: `themes-dist/packages/${pkg}@${version}`,
      lib: { entry: 'index.ts', formats: ['es'], fileName: 'index' },
      rollupOptions: { external: ['vue', 'pinia', /^skinsuite/] },
      cssCodeSplit: true
    }
  });
}
// 收尾：扫产物算 content hash 改名、生成 manifest.json（含 integrity）
```

版本号来源：包目录内 `package.json` 的 `version`，或 `git describe --tags` 派生；
**必须进 manifest** —— 加载器靠它判断"要不要更新"。

### 3.3 运行时：注册表扩展 + 加载器

**注册表扩展**（`src/theme/registry.ts`，additive，不动现有 glob 逻辑）：

```ts
/** 运行时热更注册的包（L3）。查询函数先查这里，再回落到构建期 glob 表 */
const runtimePackages = new Map<string, MauthThemePackage>();

export function registerRuntimeTheme(pkg: MauthThemePackage): void {
  if (!pkg?.meta?.id || !THEME_ID_RE.test(pkg.meta.id)) {
    console.warn('[theme-hot] 拒绝注册：id 缺失或不合法', pkg);
    return;
  }
  runtimePackages.set(pkg.meta.id, pkg);   // 同名覆盖 = 热更包赢（见 3.6）
}

export function getRuntimeTheme(id: string): MauthThemePackage | undefined {
  return runtimePackages.get(id);
}
```

所有查询函数（`listThemePackages` / `resolveThemeId` / `getThemePackage` …）的
入口处加一句"运行时表优先"即可 —— 每个函数只加一行 `??` 兜底，改动面控制在
`src/theme/index.ts` 的 12 个导出函数内，且**全部有现成单测覆盖**。

**加载器**（`src/theme/hot.ts`，新文件）：

```ts
/**
 * 主题包热更新加载器（L3）
 *
 * 契约与失败策略的总口径：manifest 拉不到 / 结构不符 / 包形状不合法 / 超时
 * —— 一律静默降级到内置包。主题是锦上添花，不能挡住登录（与 remote.ts 一致）。
 * 未配置 VITE_THEME_MANIFEST_URL 时整个机制关闭，零请求。
 */
const ENDPOINT = import.meta.env.VITE_THEME_MANIFEST_URL as string | undefined;
const TIMEOUT_MS = 3000;
const LOADED_KEY = 'theme-hot-loaded';   // localStorage：已加载的 "id@version" 集合

export async function loadHotThemes(): Promise<void> {
  if (!ENDPOINT) return;                       // 未启用
  const manifest = await fetchManifest();      // no-cache + ETag/304
  if (!manifest) return;

  const loaded = new Set<string>(JSON.parse(localStorage.getItem(LOADED_KEY) ?? '[]'));
  const changed: string[] = [];

  for (const entry of manifest.packages) {
    const stamp = `${entry.id}@${entry.version}`;
    if (loaded.has(stamp)) continue;           // 这个版本已加载过 → 跳过
    if (!(await loadOne(entry))) continue;     // 失败不阻塞其余包
    changed.push(stamp);
  }

  // manifest 里没有的旧包 = 已下架 → 清掉加载记录（下次访问不再加载）
  const live = new Set(manifest.packages.map((e) => `${e.id}@${e.version}`));
  for (const stamp of loaded) if (!live.has(stamp)) changed.push(stamp);

  if (changed.length) localStorage.setItem(LOADED_KEY, JSON.stringify([...live]));
}

/** 单个包：校验 minFrontend → 校验 integrity → 动态 import → 形状校验 → 注册 */
async function loadOne(entry: ManifestEntry): Promise<boolean> {
  if (!checkIntegrity(entry)) return false;    // sha384 逐文件比对（fetch + SubtleCrypto）
  try {
    const mod = await import(/* @vite-ignore */ resolveUrl(entry.entry));
    const pkg = mod.default;
    if (!isThemePackageShape(pkg)) { console.warn('[theme-hot] 形状不符，丢弃', entry.id); return false; }
    for (const href of entry.styles ?? []) injectLink(resolveUrl(href));
    registerRuntimeTheme(pkg);
    return true;
  } catch {
    return false;                              // 网络/解析失败：静默
  }
}
```

三个实现要点：

- **`/* @vite-ignore */`**：动态 import 的地址是运行时才有的 CDN URL，必须绕开
  Vite 构建期分析，否则构建直接报错。
- **manifest 走 `cache: 'no-cache'`，包内容走 content-hash 长缓存**：
  换包必须下次访问就生效（manifest 不能被 CDN 缓存住），而包本体内容不变
  永远可长缓存 —— 这正是产物名带 hash 的原因。
- **localStorage 只记"已加载的 id@version"**：刷新后跳过已加载包，
  `import()` 不再发起；部署方更新 manifest 后，新 version 不在集合里 → 自动加载。

### 3.4 启动接线

`src/main.ts` 里 `app.mount()` 之前（与 router.isReady 同级的那段编排里）：

```ts
// 热更主题：最多等 3s，超时也照常挂载 —— 首屏不等人
await Promise.race([loadHotThemes(), sleep(TIMEOUT_MS)]);
```

注意顺序：必须在**首次渲染选主题之前**完成注册，否则会先按内置包渲染一帧、
再跳成热更包（闪一下）。这也是超时要短、失败要静默的原因。

### 3.5 优先级与降级

```
URL ?theme=（显式指定，最高，theme-replacement.md 的四入口优先级不变）
  ＞ 后端 L2 下发的 theme id
    ＞ 运行时热更包里解析出的默认（getDefaultThemeId 先查 runtimePackages）
      ＞ 内置包兜底
```

- 热更包与内置包**同名**：热更包赢（`runtimePackages` 先查）。
  这是"修复内置包的一个难看默认值"的标准姿势，不需要改前端代码。
- 热更包里**没有**该设备/页面的配色 → 按既有规则回落（同系别首套 → 兜底），
  与"URL 指定了一个设备上没有的配色"走同一条路，不新增特殊分支。

### 3.6 安全边界（部署方必读）

🔴 **热更 JS 是代码注入面，不是配置。** 谁掌握 manifest + CDN，谁就能在前端
执行任意代码 —— 信任模型必须写进部署文档：

1. **同源或受信域**：`VITE_THEME_MANIFEST_URL` 指向的 origin 应与前端同源，
   或列入部署方自己的 CORS 白名单；`credentials: 'omit'`，不带cookie。
2. **SRI 强校验**：manifest 里每个产物带 `integrity`（sha384），加载器逐个
   比对 —— CDN 被投毒时至少要知道"内容与 manifest 承诺的不一致"。
   更强的做法是 manifest 本身也签名（部署方后台签发），P3 再上。
3. **token 白名单不放松**：热更包 CSS 里的 token 仍受 `src/theme/runtime.ts`
   的 sanitize 约束（`--mauth-` 前缀 + 颜色/长度/关键字取值），这条线与
   L1 后端下发完全一致，不为热更开特例。
4. **scope 收窄**：P0 只热更"配色数据 + 包注册"，**不热更 .vue 版式组件**；
   版式组件意味着完整的前端代码分发，留给需要时再评估（P1）。

### 3.7 部署拓扑

```
┌─────────────────────┐        ┌──────────────────────────┐
│ 前端静态托管          │        │ CDN / OSS（themes-dist） │
│ dist/（含内置主题）   │        │ manifest.json + packages │
│ VITE_THEME_MANIFEST_URL ─────▶ │ 独立发布，与前端发版解耦  │
└─────────────────────┘        └──────────────────────────┘
                                             ▲
                                  ┌──────────┴───────────┐
                                  │ 部署方后台（按 client_id│
                                  │ 生成/切换 manifest；   │
                                  │ 或直接用 L1/L2 端点）  │
                                  └──────────────────────┘
```

三种典型部署：

| 场景 | 用法 |
| --- | --- |
| 单租户自用 | 静态托管 `themes-dist/`，manifest 手改，换主题 = 重新跑 `build-themes.mjs` + 上传 |
| 多租户 SaaS | 后台按 `client_id` 路由到不同 manifest（`/themes/<client_id>/manifest.json`），前端用同一份 env 基址 + 运行时拼接 |
| 纯换色需求 | 不用 L3，后端 L1/L2 端点就够了（零部署） |

### 3.8 灰度与回滚

- **灰度**：manifest 里放两个版本，按 `client_id` 或部署方后台的百分比开关
  决定给哪个 —— 前端无感知，灰度逻辑全在 manifest 分发侧。
- **回滚**：manifest 的 entry 指回旧版本产物（旧产物**不要删**，长缓存 + 可回退）。
  已加载新包的用户下次访问会自动加载旧版（version 变了，不在
  `theme-hot-loaded` 集合里）。
- **紧急止损**：把 manifest 整个撤掉（404）→ 全部用户静默回落内置包。
  这是"热更出事"的最快止血方式，也是 manifest 单独一个入口文件的原因。

---

## 四、分期落地路线

| 期 | 内容 | 风险/收益 |
| --- | --- | --- |
| **P0** | 注册表 `registerRuntimeTheme` + `hot.ts` 加载器 + main.ts 接线 + 单测；**只热更包定义 + CSS 配色** | 改动集中在 registry/index 的查询入口与一个新文件；静态关卡与单测全绿即可合 |
| **P1** | `scripts/build-themes.mjs` + 产物契约落地 + 一个示例包（如 `ocean`）的真实构建 | 构建侧新脚本，不动运行时 |
| **P2** | 版式组件（.vue）热更评估；manifest 签名 | 需要重新审视"代码热更"的信任模型后再做 |
| **P3** | 按 `client_id` 的 manifest 路由 + 灰度开关（部署方后台侧） | 纯后端/部署侧，前端零改动 |

每期独立可回滚；任一期叫停，前端行为回到"仅内置主题"，与今天完全一致。

---

## 五、验收清单

落地后按此验收（对应到本仓既有守门体系）：

- [ ] 未配置 `VITE_THEME_MANIFEST_URL` → 网络面板零请求、行为与今天逐像素一致
- [ ] manifest 404 / 超时 / JSON 损坏 → 内置包照常渲染，无控制台错误风暴
- [ ] 热更包与内置包同名 → 热更包生效（`?debug=theme` 面板可见来源）
- [ ] 包 `default export` 形状不合法 → 丢弃 + `console.warn`，其余包不受影响
- [ ] 同一版本二次访问 → 不再发起 `import()`（localStorage 记录生效）
- [ ] manifest 下架某包 → 下次访问该包不再加载，回落内置
- [ ] `integrity` 不匹配 → 拒绝加载并告警
- [ ] `npm run type-check / lint / test` + `node e2e/verify-all.mjs --only static` 全绿
- [ ] 首屏预算关卡（`verify-first-paint-budget`，需 dev server）不回归

---

## 六、与现有机制的关系（避免重复造轮子）

- **L1/L2 已在 `src/theme/remote.ts` 实现**，本文不改动它；L3 的 manifest 机制
  与它是**并列的两个 env 开关**（`VITE_THEME_ENDPOINT` / `VITE_THEME_MANIFEST_URL`），
  可分别启用。
- **注册表构建层（glob）保持不动**：热更是叠加在构建期表之上的运行时层，
  不做"把 glob 改成异步加载"这种伤筋动骨的改造。
- **URL 参数与本地偏好优先级不变**：热更只影响"包里有什么"，不影响"选哪个"。
