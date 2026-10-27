import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { themeAssets } from 'skinsuite/vite';
import { aliases } from './config/aliases.js';

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    // 主题域扫描插件（扫主题目录 → 虚拟模块 virtual:theme）+ Vue SFC 编译。
    // themeAssets() 零参：目录由插件在 configResolved 用 Vite 自己加载的 env
    // （VITE_THEME_DIR，缺省 src/theme）与权威 config.root 解析 —— 无 mode 传递、
    // 无 cwd 陷阱。单测侧经 mergeConfig 继承本文件，不另声明（见 vitest.config.ts）。
    themeAssets(),
    vue(),
    AutoImport({
      // 注意：不放 '@vueuse/core' —— 本仓零使用，且其 useCountdown 与本地
      // src/composables/useCountdown.ts 重名，会触发 Duplicated imports 警告
      imports: ['vue', 'vue-router', 'pinia', 'vue-i18n'],
      dts: 'src/auto-import.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true
    }),
    Components({
      extensions: ['vue'],
      include: [/\.vue$/, /\.vue\?vue/],
      dts: 'src/components.d.ts'
    })

    // ⛔️ 这里刻意**没有** `VitePWA` —— 2026-09-27 整体移除。
    //
    // 判断依据不是"收益不高"，而是**登录页根本不适用**：内容型应用适合 PWA，
    // 纯登录页（oauth21 用完即走、安装价值低）**不适用**。也就是说此前的集成是
    // **违反自家规范**的 —— 这条移除是把实现改回规范，不是改规范迁就实现。
    //
    // 为什么"收益低"就足以移除：登录页是入口闸门，SW 的首访成本必须每次重付
    // （全新浏览器 / 无痕 / 清了缓存 / 新用户），而它换来的复用收益恰恰付在最不需要快的地方
    // （用户不会反复冷启同一个 origin，一次登录能用很久）。
    //
    // 直接原因是两条**已实测**的危害，任一都足以定案：
    //   ① 未配 denylist 的 `NavigationRoute` 会把一切同源 GET 导航顶成预缓存的 index.html
    //      ⇒ 后端设备码授权页 `/oauth2.1/device`（`verification_uri`，只能靠浏览器导航打开）
    //        必然不可用。A/B 对照实验坐实：屏蔽 SW 拿到设备页，装过 SW 变成 SPA 骨架。
    //   ② 预缓存把整棵 dist 写进 `sw.js` 清单，首访多下 780 KB —— 页面自身按需只要 214 KB，
    //      78% 的流量是这次根本用不到的东西。
    //
    // ⚠️ 想加回来之前，先想清楚「如何移除」：光删配置**清不掉**已经装过 SW 的浏览器
    //    （它会一直用旧 SW、永远不回源），必须留一次自毁迁移。
    //    本仓那次迁移就是 `oauth21/public/sw.js`（它的顶部注释写了何时可以删）。
  ],
  resolve: {
    // 别名**单一来源** = `config/aliases.ts`（vite / vitest / tsconfig 三处共用，关卡守一致性）。
    // 此处不再手写，避免与 vitest.config.ts 漂移。
    alias: aliases
  },
  server: {
    host: '0.0.0.0', // 允许内网 IP 访问（手机调试）
    port: 5174,
    strictPort: true, // 端口被占直接报错，不自动换端口（避免手机连错端口）
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      },
      '/verify': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/user': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/oauth2.1': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/variables.scss" as *;`,
        // 静默 Sass 的 @import deprecation warning：
        // main.scss 里 `@import 'tailwindcss'` 是 Tailwind v4 的官方引入方式
        // （透传给 @tailwindcss/postcss 展开），不是给 Sass 处理的 —— Sass 对
        // @import 的 deprecation 在这里是「误报」，改成 @use 反而会破坏 Tailwind
        // 的引入（Tailwind v4 不兼容 Sass 预处理，@use 会把 tailwindcss 当
        // Sass 部分文件解析而失败）。故静默 `import` 这一条，其余 deprecation 照报。
        silenceDeprecations: ['import']
      }
    }
  },
  build: {
    // === 为什么**不**显式设 build.target ===
    // Vite 8 的默认值就是 'baseline-widely-available'（vite dist/node/chunks 内
    // ESBUILD_BASELINE_WIDELY_AVAILABLE_TARGET，约 chrome107 / edge107 / ff104 /
    // safari16），即"不需要为存量浏览器付转译成本"的官方基线。此前手写 'es2020'
    // 反而比它更宽（es2020 不含 safari16 才稳定的若干特性），写死只会让配置
    // 落后于上游默认值。此处刻意留空，跟随默认。
    //
    // 生产不输出 .map 文件（防源码泄露到 dist）
    // 需要调试时单独配 sourcemap: true 单独 build
    sourcemap: false,
    // 关闭 Vite 默认注入的 modulepreload polyfill（构建产物里一段 ~0.4KB 的
    // inline script：检测 link.relList.supports('modulepreload')）。
    // 权衡（2026-10-15 定）：原生 modulepreload = Chrome 66+ / Edge 79+ /
    // Firefox 68+ / Safari 16.4+（2023-03 发布）。不支持的浏览器分两类：
    //   ① 连 ESM 都不支持的（IE11 / 极老 UC 内核）—— 入口的 type="module"
    //      本就跑不起来，polyfill 无从救起；
    //   ② Safari 16.3 及以下 —— 失去的只是"预加载加速"，动态 import 仍可
    //      现场拉取，功能不受影响。
    // 登录页"用完即走"的形态下，为第二类 <1% 的存量浏览器在每次访问都多付
    // 0.4KB + 一段同步执行，不划算。
    // ⚠️ 若未来要覆盖 iPadOS 老机型 / 企业内网旧 Safari，把这里改回 true 即可，
    //    不影响其它配置。
    modulePreload: {
      polyfill: false
    },
    // chunk 大小警告阈值：回落 Vite 默认 500 KB。
    // 实测最大 chunk 仅 170.91 KB，远未触及 500 KB 默认线 —— 此前抬高到 1024 无实际收益，
    // 反而会掩盖未来的真实膨胀，故回落默认值，让体积告警重新生效。
    chunkSizeWarningLimit: 500,
    // 生产删除 console 调用（防 Error 堆栈 / 内部标识泄露到浏览器 DevTools）。
    // 关键错误通过 bootstrap.ts 装配的 useErrorReporter 上报到后端（/api/v1/client-error），
    // 不依赖客户端 console 留痕。
    //
    // 🔴 2026-09-28 修正：此处原写作 `build.esbuild.drop: ['console']` —— **在 Vite 8 下完全无效**。
    //    Vite 8 改用 Rolldown + Oxc，`build.esbuild` 不再是合法字段（顶层 `esbuild` 也已 deprecated、
    //    内部转成 `oxc`），Oxc 的 console 删除开关是 **minifier 的 `compress.dropConsole`**。
    //    之所以长期没被发现：vite.config 当时是 `.js`，从不参与 `vue-tsc -b` 类型检查，
    //    写错也不会报错、只是静默不生效（实测当时产物里残留 28 处 console.*）。
    //    ⇒ 这与「前端类型闸门必须是真检查」是同一类问题：**配置文件的类型检查缺失 = 配置写错无声**。
    //
    //    `output.minify` 接受 `MinifyOptions`（rolldown 绑定），其中 `compress.dropConsole` 等价于
    //    esbuild 的 `drop: ['console']`、terser 的 `drop_console`。
    //    ⚠️ 不要改成 `build.minify: 'terser'` + terserOptions —— 那会把默认的 Oxc minifier 换掉
    //    （Oxc 比 terser 快 30~90x，见 build.minify 文档），只为删 console 不值得。
    rolldownOptions: {
      output: {
        // 见上方注释：Vite 8 / Oxc 下删 console 的唯一入口。
        // dropDebugger 若为真会更精简：Vite 8 的 Oxc minifier 里它是**默认开**，
        // 这里显式写出来只是为了把语义钉死（不依赖上游默认值变动）。
        minify: {
          compress: {
            dropConsole: true,
            dropDebugger: true
          }
        },
        // vendor 分包：把「几乎每次发版才变一次」的稳定依赖从入口 chunk 拆出去，
        // 使业务代码改动不再让整个入口 hash 失效 —— 长缓存命中率提升。
        // 三组刻意按「变更频率 + 体积」切：
        //   vue-vendor  ：vue / pinia / vue-router / vue-i18n（框架层，最稳定）
        //   form-vendor ：zod / vee-validate / @vee-validate/zod（表单校验层）
        //   net-vendor  ：axios（网络层）
        // 不在清单里的包（qrcode / dayjs 等）仍按动态 import 自然切分，不必全收。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/vue/') || id.includes('/pinia/') || id.includes('/vue-router/') || id.includes('/vue-i18n/') || id.includes('/@intlify/')) {
            return 'vue-vendor';
          }
          if (id.includes('/zod/') || id.includes('/vee-validate/')) {
            return 'form-vendor';
          }
          if (id.includes('/axios/')) {
            return 'net-vendor';
          }
          return undefined;
        }
      }
    }
  }
}));
