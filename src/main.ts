/**
 * oauth-web 入口文件（门牌）。
 *
 * 🔴 只做两件事：**引样式** + **转交启动编排**（`./bootstrap`）。
 *    启动顺序（viewport 自救 → 设备 ID 同步 → createApp → 错误处理 → pinia → router
 *    → i18n → 主题设备同步 → H5 签名预发 → 路由就绪 → mount）全部在 bootstrap.ts，
 *    本文件刻意保持极简 —— 与 retroweb / posecraft / firewall / admin 的入口形态一致。
 *    规范：fullstack-rules → references/entry-conventions.md。
 *
 * 样式两段，同属"本项目自己的全局样式"（本仓不引组件库全量 css，故无第二段）：
 *   · `assets/styles/main.scss` —— reset / 设计 token / 通用类
 *   · `assets/styles/mobile-auth.scss` —— 移动端认证页（/m/login、/m/register）共享样式，
 *     两页视觉的单一来源
 *
 * @author yijiu2025
 * @since 2026-10-17（门牌化改造；原单体入口的装配整体搬入 bootstrap.ts）
 */
import './assets/styles/main.scss';
// 移动端认证页（/m/login、/m/register）共享样式：两页视觉的单一来源
import './assets/styles/mobile-auth.scss';

// 启动编排（顺序与决策记录见 bootstrap.ts）
import './bootstrap';
