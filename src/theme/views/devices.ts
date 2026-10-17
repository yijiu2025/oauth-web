/**
 * 设备清单 —— **设备维度的唯一声明处**（机制已下沉到 `skinsuite`）
 *
 * === 本文件现在只做「声明」，不做「机制」（2026-10-17 下沉）===
 * 「怎么从清单判定设备、怎么归一化、怎么取容器」这些通用机制已收进内核：
 *   · 纯逻辑半边（`deviceContext` / `pickDeviceId` / `deviceLabel` / `asDeviceId` /
 *     `containersOf`）→ `skinsuite`（`views/device`）；
 *   · 组件半边（`pageContainers` / `containerOf` / `resolveContainerOf`）→ `skinsuite/vue`
 *     （`device-containers`）；
 *   · 装配工厂（`createDeviceRegistry`）→ `skinsuite` —— 一份清单调一次工厂，全套
 *     判定机制（`deviceLabel` / `asThemeDevice` / `pickDeviceId` / `containersOf` /
 *     `containerOf` / `resolveContainerOf`）就位，宿主不再逐个转发。
 * 本文件只保留**宿主事实**：设备清单声明 `THEME_DEVICE_DEFS`（id / label / routePath /
 * match / containers glob）。这是「路由设备信息」—— 新项目要写的就是这份清单。
 *
 * === 加一种设备要做什么（三步，缺一会被关卡拦下）===
 *   1. 本文件加一条 `ThemeDeviceDef`（id / label / routePath / match / containers）
 *   2. 写它的容器：`view/<设备 id>/<页面>/index.vue`
 *   3. 在主题包里加该设备的目录：`themes/<包>/<设备>/<页面>/{index.vue,colors/}`
 *
 * ⚠️ **判定顺序就是本清单的顺序**（先命中先用），**最后一条必须无条件成立** —— 兜底设备。
 *
 * @author yijiu2025
 * @since 2026-09-27（2026-10-17 机制下沉内核，本文件退化为清单声明）
 */
import type { Component } from 'vue';
import { THEME_ID_RE, createDeviceRegistry } from 'skinsuite';
import {
  containerOf as coreContainerOf,
  pageContainers,
  resolveContainerOf as coreResolveContainerOf
} from 'skinsuite/vue';
import type { DeviceContainerLoader } from 'skinsuite/vue';
import type { DeviceDef, DeviceMatchContext } from 'skinsuite';

/* ---------------------------------------------------------------------------
 * 设备容器 glob（宿主事实：容器放在哪、叫什么，是本应用的目录约定）
 * ------------------------------------------------------------------------- */

/** 手机端容器：`view/app/<页面>/index.vue`（本应用最早的形态，保持不动） */
const mobileContainers = pageContainers(
  import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'),
  /^index\.vue$/,
  THEME_ID_RE
);

/** 桌面 / 紧凑端容器：`view/web/<页面>/<Xxx><Page>.vue`（同一个目录，靠文件名前缀区分设备） */
const webContainers = import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue');

/** 路由 path 里是否出现了该设备的路径前缀（`mini-login` 这类，按**整段**匹配） */
function pathHasDeviceSegment(path: string, prefix: string): boolean {
  return path
    .split('/')
    .filter(Boolean)
    .some(seg => seg === prefix || seg.startsWith(`${prefix}-`));
}

/* ---------------------------------------------------------------------------
 * 设备清单声明（**加一种设备就在这里加一条**）
 * ⚠️ 顺序即优先级；最后一条 `standard` 是兜底（无条件命中），别在它后面加东西。
 * ------------------------------------------------------------------------- */

const THEME_DEVICE_DEFS = [
  {
    id: 'mini',
    label: '紧凑版',
    containers: pageContainers(webContainers, /^Mini/, THEME_ID_RE),
    routePath: (page: string) => `mini-${page}`,
    match: (ctx: DeviceMatchContext) =>
      !ctx.explicitMobile &&
      (ctx.from === 'mini' ||
        ctx.fromLogin === 'mini' ||
        pathHasDeviceSegment(ctx.path, 'mini'))
  },
  {
    id: 'tablet',
    label: '平板',
    containers: pageContainers(
      import.meta.glob<{ default: Component }>('/src/view/tablet/*/index.vue'),
      /^index\.vue$/,
      THEME_ID_RE
    ),
    routePath: (page: string) => `tablet/${page}`,
    match: (ctx: DeviceMatchContext) => !ctx.explicitMobile && ctx.from === 'tablet'
  },
  {
    id: 'mobile',
    label: '手机端',
    containers: mobileContainers,
    routePath: (page: string) => `m/${page}`,
    match: (ctx: DeviceMatchContext) => ctx.explicitMobile || ctx.viewportIsMobile
  },
  {
    id: 'standard',
    label: '桌面端',
    containers: pageContainers(webContainers, /^Standard/, THEME_ID_RE),
    routePath: (page: string) => page,
    match: () => true
  }
] as const satisfies readonly DeviceDef<DeviceContainerLoader>[];

/** 兜底设备 */
const DEFAULT_THEME_DEVICE: ThemeDevice = 'mobile';

/* ---------------------------------------------------------------------------
 * 装配：一份清单 → 全套机制（内核 `createDeviceRegistry`）
 * ------------------------------------------------------------------------- */

const registry = createDeviceRegistry(THEME_DEVICE_DEFS, {
  defaultDevice: DEFAULT_THEME_DEVICE
});

/** 设备 id 联合类型（由清单派生：加一条声明就多一个合法取值） */
export type ThemeDevice = (typeof THEME_DEVICE_DEFS)[number]['id'];

/** 设备 id 清单（顺序即优先级）—— 词汇表的**唯一来源**（字面量联合，`as const` 推导） */
export const THEME_DEVICES = THEME_DEVICE_DEFS.map(def => def.id) as readonly ThemeDevice[];

/** 兜底设备 */
export { DEFAULT_THEME_DEVICE };

export type { DeviceContainerLoader } from 'skinsuite/vue';
export type { DeviceDef, DeviceMatchContext } from 'skinsuite';

/** 设备 id → 中文名 */
export const deviceLabel = registry.deviceLabel;

/** 归一化外部传入的设备名（白名单来自本清单） */
export const asThemeDevice: (raw: unknown) => ThemeDevice | null = raw =>
  registry.asKnownDevice(raw) as ThemeDevice | null;

/** 从外部输入判定「本次访问属于哪台设备」 */
export function pickDeviceId(ctx: DeviceMatchContext): ThemeDevice {
  return registry.pickDeviceId(ctx) as ThemeDevice;
}

/** 取某设备的容器表；未知设备返回空表 */
export const containersOf: (id: string) => ReadonlyMap<string, DeviceContainerLoader> =
  registry.containersOf;

/** 取某设备在某页的容器加载器；该设备没写这一页时返回 undefined */
export function containerOf(id: string, page: string): DeviceContainerLoader | undefined {
  return coreContainerOf(THEME_DEVICE_DEFS, id, page);
}

/** 取某设备在某页的容器加载器，**没写时兜底到 standard 设备** */
export function resolveContainerOf(id: string, page: string): DeviceContainerLoader {
  return coreResolveContainerOf(THEME_DEVICE_DEFS, id, page);
}

export { deviceContext } from 'skinsuite';
