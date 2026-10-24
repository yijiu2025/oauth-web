/**
 * 设备事实（宿主）—— 一份声明 = 词汇 + 容器布线 + 模块装配（2026-10-24 定稿）
 *
 * === 与 src/device/ 的分工 ===
 * `device/` 是**库级别机制**（类型 / 纯工具 / 判定纯函数 / 装配工厂，零宿主事实）；
 * 本文件是**宿主事实**的唯一住处：有哪些设备、叫什么、顺序如何、容器组件在哪 ——
 * 全部是本产品的决定，与机制无关。每台设备一条声明（containers 内联），经
 * `createDeviceModule` 注入成模块实例，分发器经实例消费；同一份 `DEVICES`
 * 注入主题 store。
 *
 * === 数据口径 ===
 *   · DEVICES 数组序 = 优先级，**末条 = 兜底设备**（不写死 'standard' 名字）
 *   · 容器位置约定：页面名 = 容器文件的**上一级目录名**
 *     （`view/web/login/MiniLogin.vue` → 页面 `login`）；web 家族（mini/standard）
 *     共用 view/web 同一份 glob、靠文件名前缀区分；tablet / mobile 各自目录树
 *     以 `index.vue` 为入口
 *
 * @author yijiu2025
 * @since 2026-10-24（device 模块升级为纯机制层，宿主事实归位 view/ 装配文件）
 */
import type { Component } from 'vue';
import { createDeviceModule, pageContainers } from '@/device';
import type { HostDeviceInput } from '@/device';

/** 设备清单：一条 = 词汇（id/label/urlKey）+ 该设备的容器布线（序 = 优先级，末条 = 兜底） */
export const DEVICES: readonly HostDeviceInput[] = [
  {
    id: 'mini',
    label: '紧凑版',
    urlKey: 'mini',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'), /^Mini/)
  },
  {
    id: 'tablet',
    label: '平板',
    urlKey: 'tab',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/tablet/*/index.vue'), /^index\.vue$/)
  },
  {
    id: 'mobile',
    label: '手机端',
    urlKey: 'mobile',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'), /^index\.vue$/)
  },
  {
    id: 'standard',
    label: '桌面端',
    urlKey: 'std',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'), /^Standard/)
  }
];

/** 设备模块实例（判定接线 + 页面装配）—— 四个页面分发器经此消费 */
export const device = createDeviceModule({ devices: DEVICES });
