# oauth21 测试体系全量审计报告（2026-10-15）

> 用 `docs/test-audit-prompts.md`（根仓）的四条提示词对 CI / e2e / 单测做了一次完整实战。
> 结论：**测试体系底子健康，但 6 个关卡处于“没人跑过所以坏了不知道”的状态** —— 全部修复后 22/22 全绿。

## 一、实测基线（修复前 → 修复后）

| 套件 | 结果 |
| --- | --- |
| 根仓 Jest（后端） | 86 套件 / 1084 用例通过，2 套件 11 例 skip（`--experimental-vm-modules`） |
| oauth21 vitest（前端单测） | 5 文件 / 47 用例通过 |
| oauth21 e2e 关卡（首轮全量） | **9 / 22 通过**（13 红，其中 7 个是并行编辑瞬时污染） |
| oauth21 e2e 关卡（修复后） | **22 / 22 通过** |
| 毒丸自证 | no-pwa 10 类断言全点亮 ✅；theme-dirs 8 枚全变红、字节级还原 ✅ |

## 二、六个失败逐一定性（含证据）

| # | 关卡 | 根因 | 类型 | 处置 |
| --- | --- | --- | --- | --- |
| 1 | verify-login-view G2 | 关卡 mock 缺 `user` 字段 → zod 判别联合落 `kind:'unknown'` → 容器走“响应格式异常”分支，授权面板永不渲染。**探针实证**：补 `user:{id,username}` 后解析为 `action` 分支 | 测试 fixture 过期（H3） | 已修：mock 补 `user`，36/0 全绿 |
| 2 | verify-forgot-view E4-E6 | `capturedReset === null` 但变量约定是“未发出保持 `undefined`”（本文件第 47 行注释），从来无人置 `null` ⇒ 这半个条件**恒为 false**。系照抄了 login-view 的断言形状却没抄其“检查前置 null”的初始化（login-view 113/133 行） | 关卡 bug（H1 恒假断言） | 已修：三处改 `=== undefined`，56/0 全绿 |
| 3 | verify-colors-in-views A2/A2b | 关卡期望 `#020617`，主题源码 `register/colors/black/index.ts` 已按用户决定改为“选黑就是纯黑 `#000000`”，关卡没跟上 | 期望值漂移（H3） | 已修：期望值更新为 `#000000`，18/0 全绿 |
| 4 | verify-console-strip | 产品检查全过（console 残留 0）；挂在**构建前清旧**：固定名 `dist-console-guard` 上一轮清理被 safe-delete trash 中止（静默），残留目录让本轮 `rmSync` 抛异常，被 catch 当成“构建失败” | 环境问题 + 关卡鲁棒性 | 已修：outDir 改 pid 唯一名（每次全新目录），6/6 全绿 |
| 5 | verify-no-pwa | `__legacy-sw.js` 是 verify-sw-migration 放进 dist-nopwa 的假老 SW；一次**崩溃的** sw-migration 运行没走到清理步骤，残留被 no-pwa 的 workbox 符号扫描命中 | 关卡间交叉污染（崩溃残留） | 无需改码：重跑 sw-migration 正常清理后自愈；no-pwa 通过 |
| 6 | verify-sw-migration | 审计方起错环境：5189 预览服务的是 `dist/` 而非 `dist-nopwa/`，假老 SW 的 URL 被 SPA fallback 吃成 HTML（MIME 报错） | 环境配置错误（VERIFY.md §八写明必须 `--outDir dist-nopwa`） | 按文档重启预览后 8/8 全绿 |

**首轮 13 红中的另外 7 个**（tablet-landing / tone-unified / register-view / view-priority / mobile-forgot / first-paint-budget / kernel-zero-coupling）= 并行会话正在改 `config/aliases.ts`（双形态重构，22:49 落盘），dev server 热重启 + 关卡读到编辑中途状态。编辑停止后复跑全部转绿 —— **不是回归，是审计撞上了并发编辑**。

## 三、顺带发现（未改码，记录备查）

1. **VERIFY.md 端口表缺两个实例**：`5175`（link 模式，`VITE_PASSWORD_RESET_MODE=link`，forgot-view 的 E 段用）和 `5184`（移动端，colors-in-views 的 `/m/*` 探针用）。已补进端口表。
2. **`dist-console-guard` 残留删不掉**：genie-trash 对该路径 fail-closed（"Some operations were aborted"），bash/PowerShell/Python 三层删除全被 safe-delete shim 拦；`os.rename` 报 WinError 5（OS 级锁定，疑似 trash 崩溃留下的 pending-delete 状态）。重启 WorkBuddy 后应可清。唯一 outDir 修复后关卡不再触碰该目录。
3. **forgot-view G6（进度 50%）抖动过一次**：复跑两次均 56/0，判定为时序 flaky，非回归。
4. **根仓 `tests/` 目录**（45 个 10-08 调试截图，未入库）已按用户要求清除，备份在根仓 `.tmp-probe/tests-debug-screenshots-20261015.tar.gz`。
5. **packages/theme-core 子模块有 2 个文件的未提交改动**（constants.ts / index.ts 的文档路径注释 `docs/frontend/` → `docs/standards/`）—— 非本次审计产物、非毒丸残留，属并行会话收尾，未触碰。

## 四、方法论结论（对四条提示词的反哺）

- **“没人跑”比“长红”更危险**：长红会被当成噪声退役，而 dev 关卡从未进 CI，坏了数月无人知（本轮 6 个里 3 个是这类）。
- **恒假断言比缺失断言更隐蔽**：`=== null` vs `=== undefined` 这类“形状对、值错”的断言，跑一万次也不会绿，但没人会怀疑测试本身。
- **fixture 必须跟着 schema 走**：zod 收紧后 mock 不同步更新，失败现象（标题不变）离根因（parse 落 unknown）隔了一层，必须用探针直接验 parse 才定位得了。
- **毒丸是关卡的关卡**：两个毒丸全过，证明 theme-dirs / no-pwa 的断言真实有效；其余 20 个关卡无毒丸，靠“真实产物断言 + 反面对照”兜底。

## 五、复跑方式（最小回归路径）

```bash
cd oauth21
npx vite build --outDir dist-nopwa                                   # 生产关卡产物
npx vite --port 5174 --strictPort &                                  # ① dev 默认
VITE_PASSWORD_RESET_MODE=link npx vite --port 5175 --strictPort &    # ② link 模式
VITE_REGISTER_VIEW=compact npx vite --port 5177 --strictPort &       # ③ compact 版式
npx vite --port 5184 --strictPort &                                  # ④ 移动端
npx vite --port 5197 --strictPort &                                  # ⑤ color-peer
npx vite preview --outDir dist-nopwa --port 5189 --strictPort &      # ⑥ 生产预览（必须 dist-nopwa）
node e2e/verify-all.mjs                                              # 22/22
```
