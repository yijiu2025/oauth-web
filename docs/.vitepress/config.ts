import { defineConfig } from 'vitepress';

/** 文档站导航 / 侧边栏的唯一来源 —— 改目录先改这里 */

// 指南：登录 / 授权能力主线
const guide = [
  { text: '简介', link: '/guide/introduction' },
  { text: '快速上手', link: '/guide/getting-started' },
  { text: '目录结构', link: '/guide/directory' },
  { text: '登录流程', link: '/guide/login' },
  { text: '注册与找回密码', link: '/guide/register-forgot' },
  { text: 'OAuth 2.1 授权', link: '/guide/oauth-authorize' },
  { text: '扫码登录', link: '/guide/qr-login' },
  { text: 'iframe SSO 嵌入', link: '/guide/iframe-sso' }
];

// 参考：请求安全 / 国际化 / 路由 / 设备版式
const reference = [
  { text: '请求安全（H5 签名）', link: '/reference/sign' },
  { text: '国际化', link: '/reference/i18n' },
  { text: '路由与页面注册表', link: '/reference/routing' },
  { text: '设备版式', link: '/reference/devices' }
];

// 工程：发版 / 测试 / 性能
const engineering = [
  { text: 'Git 提交与发版', link: '/engineering/release' },
  { text: '性能调优', link: '/engineering/performance' }
];

export default defineConfig({
  lang: 'zh-CN',
  title: 'oauth-web',
  description: '企业统一身份认证（OAuth 2.1）登录 / 授权前端：登录、注册、扫码、授权、iframe SSO',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/oauth-web/logo.svg' }]],

  // GitHub Pages 把站点挂在仓库子路径下 —— 资源 URL 全靠它前缀
  base: '/oauth-web/',
  // GitHub Pages 无服务器重写，无扩展名路由会 404
  cleanUrls: false,

  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: '参考', link: '/reference/sign', activeMatch: '/reference/' },
      { text: '工程', link: '/engineering/release', activeMatch: '/engineering/' },
      {
        text: '主题机制',
        link: 'https://yijiu2025.github.io/theme/'
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: guide
        }
      ],
      '/reference/': [
        {
          text: '参考',
          items: reference
        }
      ],
      '/engineering/': [
        {
          text: '工程',
          items: engineering
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/yijiu2025/oauth-web' }],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',

    footer: {
      message: '基于 GPL-3.0 许可发布',
      copyright: 'Copyright © 2026 yijiu2025'
    }
  }
});
