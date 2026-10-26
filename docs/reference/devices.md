# 设备版式

oauth-web 有四套设备版式：web（桌面）/ app（移动端）/ tablet / mini，按视口与 URL 参数选容器。

## 一、设备是宿主的事实

设备清单、判定口径、容器布线都是**宿主 oauth-web 自己的机制**（`src/device/`），不是 skinsuite 的
导出。设备身份只经容器里的 `<ThemeView device="…">` props 告知主题侧。

```text
src/device/
├── index.ts                # 设备模块装配（判定接线 + 页面装配）
├── types.ts                # 设备词汇类型
├── tools.ts                # 工具
├── runtime.ts              # 运行时
├── useDeviceDetect.ts      # 组合式判定
└── resolve/
    ├── viewport.ts         # 视口判定
    └── render-device.ts    # 组合判定（视口 / URL / iframe 来源 → 设备 id）
```

## 二、四套版式

| 设备 | 目录 | 说明 |
| --- | --- | --- |
| `standard`（web） | `view/web/<page>/` | 桌面卡片，`StandardLogin` / `StandardRegister` … |
| `mobile`（app） | `view/app/<page>/index.vue` | 移动端，`index.vue` 为入口 |
| `tablet` | `view/tablet/<page>/index.vue` | 平板，`index.vue` 为入口 |
| `mini` | `view/web/<page>/Mini*.vue` | 紧凑版（iframe 嵌入），**独立设备**，不是 mobile 缩写 |

## 三、设备判定链

分发器（`view/web/<page>/index.vue`）用 `useRenderDevice` 判定当前设备，判定链：

```
?device= 锁定  >  ?isMobile  >  ?from=  >  视口  >  兜底 standard
```

`?device=<id>` 是**设备锁定**：锁定后视口 / UA / `?from=` 全部让位。

## 四、设备清单声明

`src/view/devices.ts` 声明设备清单（id / label / urlKey + 容器布线），主题侧只投影词汇三字段
（`id` / `label` / `urlKey`）注入 store——`containers` 等设备侧事实不进主题。

::: tip 设备机制与主题机制分离
设备侧与主题侧彻底分离：设备清单文件不 import 任何主题库的东西；主题侧只注入一份词汇投影。
完整分工见 [skinsuite 文档站 · 设备与容器](https://yijiu2025.github.io/theme/guide/devices.html)。
:::

## 五、页面分发

每个页面的 `view/web/<page>/index.vue` 是**分发器**（路由组件）：按设备 id 从 `DEVICES` 清单里
查容器组件（`defineAsyncComponent` 惰性加载），未命中回落末条兜底设备。分发器只负责选容器，
不碰主题。
