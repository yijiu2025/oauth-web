/**
 * 设备清单 —— **设备维度的唯一声明处**（机制已全部下沉到 `skinsuite`）
 *
 * === 本文件只剩「声明」，没有任何机制 / 转发（2026-10-18 收口）===
 * 每台设备一条 `defineThemeDevice({...})`（id / label / urlKey / containers 三参数 /
 * routePath / 声明式 match），工厂内部自动 `pageContainers` 建容器表、声明式 match 转判定、
 * 自动注册进设备域。查询 / 派生（`deviceIds` / `fallbackDevice` / `pickDeviceId` /
 * `resolveContainerOf`）与判定（`deviceContext`）都已下沉到 `skinsuite` / `skinsuite/vue`
 * （用设备域单例，不再「传 defs」），消费方直接从库 import —— 本文件不再转发任何函数。
 *
 * === 判定顺序就是声明顺序（先命中先用），最后一条必须 `fallback` ===
 * mini → tablet → mobile → standard（standard 是兜底）。`explicitMobile` 是全局最高优先信号
 * （库内一条优先级规则：`explicitMobile=true` 时跳过带 from/fromLogin/pathSegment 的条目）。
 *
 * ⚠️ 加一种设备要做什么：加一条 `defineThemeDevice({...})` + 写容器 + 主题包加设备目录。
 * ⚠️ 本文件是**副作用模块**（声明即注册进设备域）：由 `stores/theme.ts` 以副作用 import 加载。
 *
 * @author yijiu2025
 * @since 2026-09-27（2026-10-17 机制下沉内核；2026-10-18 改用 defineThemeDevice 自动注册 + 删硬编码词汇表 + 删转发层）
 */
import type { Component } from 'vue';
import { THEME_ID_RE } from 'skinsuite';
import { defineThemeDevice } from 'skinsuite/vue';

defineThemeDevice({
  id: 'mini',
  label: '紧凑版',
  urlKey: 'mini',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'),
    fileRe: /^Mini/,
    idRe: THEME_ID_RE
  },
  routePath: page => `mini/${page}`,
  match: { from: ['mini'], fromLogin: ['mini'], pathSegment: 'mini' }
});

defineThemeDevice({
  id: 'tablet',
  label: '平板',
  urlKey: 'tab',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/tablet/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  },
  routePath: page => `tablet/${page}`,
  match: { from: ['tablet'] }
});

defineThemeDevice({
  id: 'mobile',
  label: '手机端',
  urlKey: 'mobile',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  },
  routePath: page => `m/${page}`,
  match: { explicitMobile: true, viewportMobile: true }
});

defineThemeDevice({
  id: 'standard',
  label: '桌面端',
  urlKey: 'std',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'),
    fileRe: /^Standard/,
    idRe: THEME_ID_RE
  },
  routePath: page => page,
  match: { fallback: true }
});
