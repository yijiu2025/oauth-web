/// <reference types="vite/client" />

/**
 * `virtual:theme` 的类型声明来自 `skinsuite/vite`（包内 `src/vite/theme.d.ts`）。
 *
 * 🔴 必须是 `import`，不能写成 `/// <reference types="skinsuite/vite" />`：
 *    后者解析不到包的**子路径**入口，`vue-tsc -b` 会报
 *    `TS2882: Cannot find module or type declarations for side-effect import of 'virtual:theme'`，
 *    而 `vite build` 与浏览器照常工作 —— 很容易被误判成编辑器问题。
 *    在 `.d.ts` 里 `import` 不产生运行时代码，只把 `src/vite/index.ts` 上的
 *    `/// <reference path="./theme.d.ts" />` 带进 TS 程序。
 */
import 'skinsuite/vite';
