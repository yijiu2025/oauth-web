/**
 * oauth-web 启动编排器。
 *
 * 按序初始化：viewport 自救 → 设备 ID 同步 → createApp → 全局错误处理 → pinia → router
 * → i18n → 主题域初始化 → H5 签名 Token 预发 → 等待路由就绪 → 挂载。
 *
 * 🔴 为什么入口要拆成 `main.ts + bootstrap.ts`（与 retroweb / posecraft / firewall / admin 同构）：
 *    `main.ts` 只当"门牌"（文件头 + 样式 + `import './bootstrap'`），**启动顺序**全部收在
 *    这里。读代码的人不必在样式 import 与装配语句之间来回跳；"启动流程"也成为可被单独
 *    阅读、单独讨论的单元。规范：fullstack-rules → references/entry-conventions.md。
 *
 * ── 本文件的边界：只做「装配」，不做「实现」──
 *   它知道有十个步骤、知道先后顺序，但**不知道任何一个部件内部怎么工作**：
 *   · 不碰任何 HTTP 细节（第 8 步只发一个 fire-and-forget 预取，失败路径见其注释）；
 *   · 不处理业务分支。
 *   判据很简单：**删掉本文件换一种装配方式，业务一行不该变。**
 *   例外：主题域初始化要传两个宿主事实 —— `router`（设备域从它读 `query/path`）与
 *   `resolveDevice`（**怎么判定当前设备**，宿主的口径）。这是「装配胶水」而非「业务实现」：
 *   机制在 `skinsuite/vue`，判定在 `theme/views/devices.ts`。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { refreshDevice, theme } from 'skinsuite/vue';
import i18n from './i18n';
import request from './utils/request';
import { initDeviceSync } from 'stable-deviceid';
import { reportError } from './composables/useErrorReporter';
import { setupViewportFix } from './utils/viewport-fix';
import { watchViewport } from './utils/device';
// 设备判定（宿主口径）：库只提供注入点，判定与它的词汇都在宿主 utils 层
// （不放 theme/views —— 那是对外可迁移的纯声明目录）
import { resolveCurrentDevice } from './utils/device-resolve';
// 设备声明（副作用：注册进设备域）。必须在 `app.use(theme)` 之前 —— 判定函数要查已注册清单
import './theme/views/devices';

// ---------------------------------------------------------------------------
// 0. 挂载前的两项全局初始化（必须在 createApp / mount 之前）
// ---------------------------------------------------------------------------
// 布局视口自救：必须在 Vue 挂载前执行 —— 内核丢弃 viewport meta 时（实测夸克），
// 整页会被当成 980px 桌面布局等比缩小，这里用 zoom 把比例拉回设备宽度。
// 详见 src/utils/viewport-fix.ts 与 mobile-auth.scss §13。
setupViewportFix();

// 设备 ID 全局同步初始化（跨标签页 storage 事件监听 + 变更回调注册）
initDeviceSync();

const app = createApp(App);
const pinia = createPinia();

// ---------------------------------------------------------------------------
// 1. 全局错误处理：上报到后端监控，dev 环境 console.warn 留痕
//    （不直接 console.error 防生产堆栈泄露）
// ---------------------------------------------------------------------------
app.config.errorHandler = (err, _instance, info) => {
  // 异步上报不阻塞（fire-and-forget，fetch 失败静默）
  reportError(err, String(info || ''));
};

// ---------------------------------------------------------------------------
// 2. 插件注册（顺序：pinia → router → i18n → theme）
// ---------------------------------------------------------------------------
app.use(pinia);
app.use(router);
app.use(i18n);

// 设备域启动：传 router + **宿主自己的判定函数** `resolveCurrentDevice`。
// 库只做三件事：链接变动时把 `query / path / fullPath` 递进来、记住返回的设备 id、
// 通知订阅方（宿主 store 从设备域订阅）。它不认识视口阈值 / UA / `?device=` / `?from=`
// 这些词汇 —— 全在 `utils/device-resolve.ts` 里（含 `?device=<id>` 一次性锁定）。
// 不再写 `deviceSource`、不标 `meta.device`、不手动 `setActiveDevice`。
//
// ⚠️ 必须在 `app.use(pinia)` 之后：主题 store 实例化（App.vue 接线壳组装 host 时）依赖
//    Pinia 的 activeInstance 已建立；设备判定本身不依赖 pinia，但 store 订阅它。
app.use(theme, {
  router,
  resolveDevice: resolveCurrentDevice
});

// 宿主自己的视口信号 → 让设备域重判（库不订阅 matchMedia：「什么算变了」是宿主口径）。
// 跨 768 / 1024 两个断点才回调，不产生 scroll/resize 级别的抖动。
watchViewport(() => refreshDevice());

// ---------------------------------------------------------------------------
// 3. 预发 H5 签名 Token（拿 _m_h5_tk cookie，后续请求拦截器才能算签名）
// ---------------------------------------------------------------------------
// 未登录场景（QR 生成等公开端点）也需要签名防爬，cookie 预取后所有请求都能签名
// fire-and-forget：不阻塞挂载；失败时首个请求会被后端自动下发 cookie 并放行
request.get('/auth/v1/h5-token').catch(err => {
  // 不阻塞主流程，但留痕便于排查（fire-and-forget 不上抛）
  reportError(err, '[H5Token] 预取失败（首次请求会由后端自动下发）');
});

// ---------------------------------------------------------------------------
// 4. 异步挂载（确保路由就绪）
// ---------------------------------------------------------------------------
router.isReady()
  .then(() => {
    app.mount('#app');
  })
  .catch(err => {
    // 路由初始化失败（极少见：路由表循环、配置错误），降级直接挂载避免白屏
    reportError(err, '[Router] router.isReady 失败，降级挂载');
    app.mount('#app');
  });
