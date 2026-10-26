# Pull Request

## 改动类型

- [ ] `feat` 新功能
- [ ] `fix` 缺陷修复
- [ ] `perf` 性能优化
- [ ] `refactor` 重构（行为不变）
- [ ] `style` 样式 / 格式（不影响逻辑）
- [ ] `test` 测试
- [ ] `docs` 文档
- [ ] `chore` 构建 / 工具 / 杂项
- [ ] `ci` CI 配置
- [ ] `revert` 回滚

## 关联 Issue

closes #<!-- issue 编号，无则删掉本节 -->

## 动机与背景

<!-- 解决什么问题；不写「是什么」，写「为什么」。 -->

## 主要改动

<!-- 按模块列，避免逐行复述 diff：
- src/theme/…：…
- e2e/verify-…mjs：…
-->

## 测试证据

本地跑过的命令与结果（CI 会重复一遍，但本地先绿是对 reviewer 的基本尊重）：

- [ ] `npm run type-check`（vue-tsc -b）
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `node e2e/verify-all.mjs --only static`
- [ ] `npm run build`（改了构建配置 / 依赖时必跑）

UI 改动请附截图或录屏，**桌面 + 移动 + 深色**三态：

<!-- 拖图到这里 -->

## 自检清单

- [ ] env 变量如有增减，**四个文件同序同注释**已同步（`.env` 除外，它不入库）
- [ ] 未提交 `.env`、`dist/`、`.tmp-probe/` 等应被忽略的文件
- [ ] 主题 / 版式改动符合 [skinsuite 目录约定](https://yijiu2025.github.io/theme/guide/directory.html)（目录名即 id；`view ≡ pkg`；设备平级）
- [ ] 如改别名，只改了 `config/aliases.ts` 单一来源
- [ ] 无新增 `console.*`（静态关卡会拦）
- [ ] 无新增 `any` 债务（静态关卡会拦）
- [ ] iframe / postMessage 相关改动保留了 origin + source 双校验
- [ ] 表单类改动满足无障碍清单（错误关联 `aria-describedby`、焦点管理、键盘可达）
- [ ] 提交信息遵循 Conventional Commits，一次提交只做一件事

## Breaking change

- [ ] 无破坏性变更
- [ ] 有破坏性变更（请在下方说明迁移路径，并在提交信息的 footer 写 `BREAKING CHANGE:` —— 这会触发 major 发版）

<!-- 迁移说明 -->

## 给 Reviewer 的提示

<!-- 你最没把握的点、希望重点看的部分；没有就删掉本节。 -->
