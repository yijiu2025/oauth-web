export default {
  plugins: {
    // Tailwind v4：PostCSS 插件已拆到独立包 @tailwindcss/postcss
    // （v3 时代直接用 tailwindcss 本体作插件，v4 起会报错）
    '@tailwindcss/postcss': {},
    autoprefixer: {}
  }
};
