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
 *   例外：主题域初始化要传一个宿主事实 —— `router`（版式意图同步从它读 `query`）。
 *   这是「装配胶水」而非「业务实现」：机制在 `skinsuite/vue`。设备判定**不在**这里 ——
 *   归宿主设备模块（`utils/device-resolve.ts`，页面分发器经 `useRenderDevice` 消费），
 *   主题 store 只经 `<ThemeView>` 的 device prop 接收。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { theme } from 'skinsuite/vue';
import i18n from './i18n';
import request from './utils/request';
import { initDeviceSync } from 'stable-deviceid';
import { reportError } from './composables/useErrorReporter';
import { setupViewportFix } from './utils/viewport-fix';
// 设备声明（副作用：注册进设备域）。必须在 `app.use(theme)` 之前 ——
// 分发器与 store 的设备清单 / 兜底设备（fallbackDevice）来自这里
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

// 主题域装配：只传 router（版式意图同步从它读 `query`）。设备判定**不在库内**：
// 宿主设备模块（`utils/device-resolve.ts`：视口 + URL 词汇）由页面分发器经
// `useRenderDevice` 消费并选容器；设备身份由容器内的 `<ThemeView device="…">` props
// 告知主题 store —— 库不认识任何判定词汇，也不 watch 路由 / 视口。
//
// ⚠️ 必须在 `app.use(pinia)` 之后：主题 store 实例化（App.vue 接线壳组装 host 时）依赖
//    Pinia 的 activeInstance 已建立。
app.use(theme, { router });

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
