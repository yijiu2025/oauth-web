# Git 提交与发版

oauth-web 是独立 git 仓（`yijiu2025/oauth-web`），发版走 `scripts/release-web.mjs`（两通道：
git tag / GitHub Release）。

## 一、发版脚本

```bash
node scripts/release-web.mjs            # 预览（默认 dry-run，不做任何写操作）
node scripts/release-web.mjs --apply    # 执行：打 tag + 推 main 与 tag + 建 Release
node scripts/release-web.mjs --from v1.0.0   # 复盘 / 补发
node scripts/release-web.mjs --apply --allow-dirty   # 有并行任务遗留改动时放行
```

## 二、发版判据（Conventional Commits）

| 提交类型 | 是否发版 | 版本递增（以最近 tag 为基线） |
| --- | --- | --- |
| 破坏性变更（footer 形式 `BREAKING CHANGE:` 或 `!:`） | 发 | major |
| 含 `feat` | 发 | minor |
| 仅 `fix` / `perf` | 发 | patch |
| 仅 `chore` / `docs` / `test` / `style` / `ci` / `refactor` | **不发** | — |

> 🔴 破坏性变更**只认 footer 形式**（行首 + 冒号），不可退化成子串匹配——正文里"提到"
> 这个关键词会把 minor 误升成 major，真实仓库上发生过。

## 三、关键边界

- **版本源是 git tag**，`package.json` 的 `version` 单向跟随——不要反过来拿它推版本号；
- tag 推送判定用 `git ls-remote`，**不信退出码**（超时不等于失败，重试安全）；
- 发版只允许在 `main` 上进行；`--apply` 时有未提交改动且无 `--allow-dirty` 会拒绝执行；
- 嵌套仓的提交 / 推送**必须在本仓目录做**（`cd oauth21 && git …`），在根仓 `git commit` 对它无效。

## 四、完整规范

以上是 oauth-web 自身发版的要点。完整的提交 / 版本 / 分支 / 发版统一规则见仓库内
`docs/git-release-rules.md`（master 在 CoreFlow `docs/standards/`）。
