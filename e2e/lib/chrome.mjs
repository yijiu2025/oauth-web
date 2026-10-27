/**
 * Chrome / Chromium 可执行文件路径解析 —— e2e 关卡的**单一来源**
 *
 * 优先 `CHROME_PATH` 环境变量（CI / 非默认安装路径显式指定），否则按平台试常见
 * 安装路径。此前 15 个 e2e 脚本各自硬编码 `C:/Program Files/Google/Chrome/...`，
 * Linux / macOS 上直接挂 —— 收口到一处后，改探测逻辑只改这里。
 *
 * 找不到返回 undefined，调用方必须显式报错退出（别静默拿 undefined 去 launch）。
 */
import { existsSync } from 'node:fs';

export function resolveChromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          'C:/Program Files/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const p of candidates) if (existsSync(p)) return p;
  return undefined;
}
