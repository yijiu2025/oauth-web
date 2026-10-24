/**
 * 设备模块运行时工厂 —— `createDeviceModule({ devices })`（库级别）
 *
 * === 与主题库同一注入语言 ===
 * 设备的**事实**（一份声明 = 词汇 + 容器布线）全部在宿主；本工厂只收契约 —— 与
 * `createThemeState({ devices })` 同一装配语言。宿主调一次得到模块实例，
 * 分发器经实例消费 `useDevicePage(page)`，主题 store 拿同一份清单注入。
 *
 * === 职责 ===
 *   · 布线组装：调用每条自带的容器构建器（词汇与布线同源，结构上不可能漂移）
 *   · 派生查询：deviceIds / fallbackDevice / resolveContainerOf（私有）
 *   · 词汇校验收口：useRenderDevice 保证输出 ⊆ 词汇表（`?device=` 非法值落末条 +
 *     dev 警告一次）—— 消费侧 Map 必中，无需各自兜底
 *   · 页面装配：useDevicePage（判定 + 容器 Map + 挂载预热）
 *
 * @author yijiu2025
 * @since 2026-10-24（从 wiring/useRenderDevice + useDevicePage 两文件收拢为注入工厂；
 *            宿主事实移出 device 模块，机制层零宿主数据）
 */
import { computed, defineAsyncComponent, onMounted } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRoute } from 'vue-router';
import { resolveRenderDevice } from './resolve/render-device';
import { viewportDevice } from './resolve/viewport';
import { lookupContainer } from './tools';
import type { Component } from 'vue';
import type { DeviceContainerLoader, HostDeviceDef, HostDeviceInput } from './types';

/** createDeviceModule 的注入契约（宿主事实的形状：一份声明 = 词汇 + 布线） */
export interface DeviceModuleOptions {
  /**
   * 设备清单（数组序 = 优先级，**末条 = 兜底设备**）。
   * 每条自带容器布线构建器 —— 词汇与布线一份声明，无平行结构可漂移。
   */
  devices: readonly HostDeviceInput[];
}

/** 设备模块实例（宿主持有一个，分发器经它消费） */
export interface DeviceModule {
  /**
   * 当前该渲染的设备 id —— **保证 ⊆ 词汇表**
   * （判定纯函数原样穿透 `?device=`，词汇合法性在此收口：非法值落清单末条 +
   * dev 警告一次；消费侧 Map 必中，无需各自兜底）
   */
  useRenderDevice(): Readonly<Ref<string>>;
  /**
   * 设备页装配：判定 + 容器 Map + 挂载预热
   * @param page 页面名（= 容器文件上一级目录名，如 'login'）
   */
  useDevicePage(page: string): ComputedRef<Component | undefined>;
}

export function createDeviceModule(options: DeviceModuleOptions): DeviceModule {
  /* -- 布线组装：调用每条自带的构建器（词汇与布线同源，结构上不可能漂移） ------ */
  const DEVICE_DEFS: readonly HostDeviceDef[] = options.devices.map(
    ({ id, label, urlKey, containers }) => ({ id, label, urlKey, containers: containers() })
  );

  /* -- 派生查询（私有）----------------------------------------------------- */
  const deviceIds = (): string[] => DEVICE_DEFS.map(d => d.id);
  const FALLBACK_ID = DEVICE_DEFS[DEVICE_DEFS.length - 1]?.id ?? '';
  const KNOWN_IDS = new Set(DEVICE_DEFS.map(d => d.id));
  const resolveContainerOf = (id: string, page: string): DeviceContainerLoader =>
    lookupContainer(DEVICE_DEFS, id, page);

  /** dev 下同一非法 id 只警告一次（路由反复重判不刷屏） */
  const warnedUnknown = new Set<string>();

  function useRenderDevice(): Readonly<Ref<string>> {
    // useRoute 在分发器 setup 上下文内调用（useDevicePage 内部），合规
    const route = useRoute();
    return computed(() => {
      const raw = resolveRenderDevice(route.query, route.path, viewportDevice().value);
      if (KNOWN_IDS.has(raw)) return raw;
      if (import.meta.env.DEV && !warnedUnknown.has(raw)) {
        warnedUnknown.add(raw);
        console.warn(
          `[device] ?device=${raw} 不在设备清单内，已落兜底「${FALLBACK_ID}」` +
            `（清单：${[...KNOWN_IDS].join(' / ')}）`
        );
      }
      return FALLBACK_ID;
    });
  }

  function useDevicePage(page: string): ComputedRef<Component | undefined> {
    const device = useRenderDevice();

    // 异步按需加载不同形态的容器：设备 id → 该页容器，映射从约定派生（不写死三选一）
    const deviceComponents = new Map(
      deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, page))])
    );

    // 判定 → 选容器（Map 必中：useRenderDevice 已保证输出 ⊆ 词汇表）
    const activeComponent = computed<Component | undefined>(() => deviceComponents.get(device.value)!);

    // 挂载即预热全部设备的该页容器（拉异步 chunk），避免跨视口切换设备时闪屏
    onMounted(() => {
      for (const id of deviceIds()) {
        void resolveContainerOf(id, page)().catch(() => {});
      }
    });

    return activeComponent;
  }

  return { useRenderDevice, useDevicePage };
}
