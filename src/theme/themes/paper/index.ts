/**
 * 票据主题包（paper）—— **包定义**
 *
 * 与 `default` 平级的第三套设计，当前只覆盖 **mini × login**（iframe 内那 854×484 的
 * 弹窗）：把「宽卡片 + 左右品牌栏」换成「窄幅单列票据」—— 抬头一条强调线、字标在左上、
 * 表单与页脚竖直排布，适合把登录框塞进更窄的宿主区域。
 *
 * 切换：`?th=paper`（版式 ≡ 包名，与 `?th_color=` 正交）。
 * 覆盖不到的设备/页面（mobile / standard / register …）自动回退 default 包。
 *
 * === 与 default 的关系 ===
 * 表单字段、二维码、授权确认、邮箱二次验证这些**业务块**沿用同一批共享组件与
 * `mlogin-*` 样式，只有外壳与尺寸不同 —— 版式差异不该带来行为差异。
 * 配色（colors/）是从 default 的 mini/login 复制来的同一组色值：本包只换版式，
 * 若要独立色板，直接改本包 `colors/<id>/index.ts` 的 tokens 即可（互不影响）。
 *
 * @author yijiu2025
 * @since 2026-11-10
 */
import type { MauthThemePackage } from 'skinsuite';

export default {
  meta: {
    id: 'paper',
    name: '票据',
    description: '窄幅单列：强调线 + 字标抬头，把登录框收进更窄的宿主区域',
    preview: { primary: '#2563eb', accent: '#0ea5e9' }
  },
  coverage: {
    devices: ['mini'],
    // 版式只有 login，但**配色必须覆盖 mini 的全部页面**：`getThemeRecord` 只在
    // "同包同设备同页"里找配色，找不到返回空记录 ⇒ `?th=paper` 停在注册/找回密码页
    // 时 token 一个都注入不了，页面会退化成无样式。版式可以缺，配色不能缺。
    pages: ['login', 'register', 'forgot-password', 'not-found']
  }
} satisfies MauthThemePackage;
