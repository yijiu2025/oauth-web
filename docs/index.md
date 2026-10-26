---
layout: home

hero:
  name: oauth-web
  text: 企业统一身份认证前端
  tagline: OAuth 2.1 登录 / 注册 / 扫码 / 授权确认一整套页面，外加 iframe SSO 嵌入与多设备版式。纯前端，与 CoreFlow 后端协同。
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/getting-started
    - theme: alt
      text: 为什么是 oauth-web
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/yijiu2025/oauth-web

features:
  - icon: 🔐
    title: 完整登录链路
    details: 账号密码登录、邮箱验证码注册、找回 / 重置密码，VeeValidate + Zod 声明式表单校验，前后端同规则。
  - icon: 🔗
    title: OAuth 2.1 授权
    details: /authorize 授权页 + /consent 授权确认页，支持授权码 + PKCE 流程；子应用统一跳转登录、拿回授权码。
  - icon: 📱
    title: iframe SSO 嵌入
    details: /mini-login 紧凑路由供宿主应用弹窗嵌入，origin + source 双校验的 postMessage 握手，父 origin 白名单兜底。
  - icon: 🖼️
    title: 多设备版式
    details: web / app / tablet / mini 四套版式，按视口与 URL 参数选容器，URL 不被视口改写。
  - icon: 🌐
    title: 国际化
    details: vue-i18n，简体中文默认、英文兜底；新增语言加一个 messages 对象即可。
  - icon: 🛡️
    title: 请求安全
    details: H5 签名（appKey + timestamp + nonce + url + body 的 SHA-256）弱防爬，敏感操作靠后端登录态 + 权限校验。
---
