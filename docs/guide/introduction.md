# 简介

oauth-web 是企业统一身份认证（SSO）体系的**纯前端**部分：登录、注册、找回密码、扫码登录、
OAuth 2.1 应用授权页（authorize / consent）一整套页面，外加多设备版式、中英文国际化与深色模式。

后端账号与授权服务在另一个仓库 [CoreFlow（nodeservers）](https://github.com/yijiu2025/CoreFlow)。

## 它解决什么问题

子应用（retroweb / posecraft / firewall …）不各自建登录页，统一把用户送到这里登录、授权，
拿回 OAuth 2.1 授权码。本仓库既可以作为授权中心独立部署，也可以被其他应用以 iframe 方式
嵌入（`/mini-login` 快捷登录）。

## 能力一览

| 能力 | 说明 |
| --- | --- |
| 账号密码登录 | 登录 / 注册 / 邮箱验证码 / 找回密码 / 重置密码全流程 |
| 扫码登录 | 后端发二维码 token，前端轮询状态，扫码后自动登录 |
| OAuth 2.1 授权 | `/authorize` 授权页 + `/consent` 授权确认页，支持授权码 + PKCE 流程 |
| iframe 嵌入登录 | `/mini-login` 紧凑版路由，供宿主应用弹窗嵌入；父 origin 白名单校验后才 `postMessage` |
| 多设备版式 | web（桌面）/ app（移动端）/ tablet / mini 四套版式，URL 不被视口改写 |
| 国际化 | vue-i18n，简体中文（`zh_cn`）为默认语言，英文（`en`）兜底 |
| 请求安全 | H5 签名（appKey + timestamp + nonce + url + body 的 SHA-256），弱防爬 |
| 表单校验 | VeeValidate + Zod 声明式 schema，前后端同规则 |

## 技术栈

Vue 3.5（Composition API）+ TypeScript 6 + Vite 8（Rolldown + Oxc）+ Pinia 3 + Vue Router 5
+ vue-i18n 11 + Tailwind CSS 4 + SCSS + VeeValidate 4 + Zod 3 + axios + Vitest 4。

端口 **5174**（`strictPort`，`/api` 代理到后端 `localhost:3000`）。

## 主题机制属于另一个仓库

本仓库的「多主题 / 多版式」能力由独立库 [skinsuite](https://github.com/yijiu2025/theme) 提供。
主题包目录契约、设备词汇、URL 参数键、配色 / 版式替换等**全部机制文档**都在 skinsuite 的文档站：

👉 **[skinsuite 文档站](https://yijiu2025.github.io/theme/)**

本仓库只负责**接入**：`src/theme/` 放主题资产，`src/stores/theme.ts` 是接入壳。登录 / OAuth 授权
这套业务逻辑才是本仓库的主线，本文档站只讲这条主线。

## 文档结构

- **指南**：从「跑起来」到「看懂登录与授权怎么走」，主线流程一篇一主题；
- **参考**：请求签名、国际化、路由、设备版式的实现细节；
- **工程**：发版规则与性能调优。
