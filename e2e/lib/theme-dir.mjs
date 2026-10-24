/**
 * e2e 关卡的**主题目录**解析（单一来源 = env `VITE_THEME_DIR`）
 *
 * === 为什么要有这个模块 ===
 * 主题根目录的位置是**可配的**（`VITE_THEME_DIR`，见 `skinsuite/vite` 的 `themeAssets`），
 * 缺省才是 `src/theme`。此前各关卡把它写死成 `<仓根>/src/theme`：谁按 env 把目录挪走，
 * 关卡就会扫到 0 个文件 —— `requireScanDir` 会红，但**红得没道理**（目录是真的，位置而已）。
 * 换前端时更直接：新前端的主题目录未必叫这个名。
 *
 * 所以解析收成一处，与构建期读同一个 env，不再各关卡各写一份路径。
 *
 * === 只读 `.env` 的取舍 ===
 * Vite 的加载顺序是 `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`，
 * 但静态关卡不跑在 Vite 里、**没有 mode 概念**（本地 / CI 都不带）。
 * 本仓四个 env 文件的 `VITE_THEME_DIR` 值一致，且由 `verify-env-files` 关卡守卫同序，
 * 所以读 `.env` 一处即可覆盖全部形态。哪天出现了「只有某个 mode 才生效」的写法，
 * 那个 case 本身就该被 env 关卡拦下。
 *
 * @author yijiu2025
 * @since 2026-10-21
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** 缺省主题目录（与 `skinsuite/vite` 插件的缺省值逐字一致） */
export const DEFAULT_THEME_DIR = 'src/theme';

/** 取 `--dir <路径>` 入参（没有 / 后面没值时返回 null） */
function flagValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  return v && !v.startsWith('-') ? v : null;
}

/** 从仓根 `.env` 读 `VITE_THEME_DIR`（读不到返回 null） */
function readEnvThemeDir(repoRoot) {
  const file = join(repoRoot, '.env');
  if (!existsSync(file)) return null;
  const m = /^\s*VITE_THEME_DIR\s*=\s*(.+?)\s*$/m.exec(readFileSync(file, 'utf8'));
  return m ? m[1] : null;
}

/**
 * 解析主题目录的**绝对路径**
 *
 * 优先级：`--dir` 入参 > env `VITE_THEME_DIR` > 缺省 `src/theme`。
 * 三者都按「相对仓根」解析（env 里写绝对路径也认）。
 *
 * @param {{ repoRoot: string, argv?: string[], fallback?: string }} opts
 */
export function resolveThemeDir({ repoRoot, argv = process.argv, fallback = DEFAULT_THEME_DIR }) {
  const raw = flagValue(argv, '--dir') ?? readEnvThemeDir(repoRoot) ?? fallback;
  return isAbsolute(raw) ? raw : resolve(repoRoot, raw);
}
