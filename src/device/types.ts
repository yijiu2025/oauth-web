/**
 * 设备模块类型 —— 机制层的契约形状（库级别；宿主事实经工厂注入）
 *
 * @author yijiu2025
 * @since 2026-10-24（从 wiring/useDevicePage 内联类型转正为模块级契约）
 */
import type { Component } from 'vue';

/** 容器加载器（与 import.meta.glob 的取值形态一致） */
export type DeviceContainerLoader = () => Promise<{ default: Component }>;

/** 设备词汇形状（宿主纯数据三字段；缺字段在 createDeviceModule 装配处编译期报错） */
export interface HostDeviceVocab {
  /** 设备 id = 主题包内目录名，只允许 `[a-z0-9-]` */
  id: string;
  /** 中文名（调试面板 / 日志用） */
  label: string;
  /** 缩写名（URL 专属参数后缀：`?th_<urlKey>` / `?th_color_<urlKey>`） */
  urlKey: string;
}

/** 宿主声明形态：词汇 + 该设备的容器布线构建器（一份声明，无平行结构） */
export interface HostDeviceInput extends HostDeviceVocab {
  /** 构建该设备的「页面 → 容器加载器」表（glob 模式必须是字面量；工厂装配时调用一次） */
  containers: () => ReadonlyMap<string, DeviceContainerLoader>;
}

/** 一台设备的完整形状（词汇 + 已构建的容器表；createDeviceModule 的装配产物） */
export interface HostDeviceDef extends HostDeviceVocab {
  /** 「页面 → 容器加载器」表 */
  containers: ReadonlyMap<string, DeviceContainerLoader>;
}
