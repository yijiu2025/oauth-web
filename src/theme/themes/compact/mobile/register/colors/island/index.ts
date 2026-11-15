/**
 * 「岛屿米」配色（island）—— 注册页 · 手机端
 *
 * 与同目录的 `white` / `black` 是**并列的一个颜色选项**：只换颜色 / 圆角 / 背景图，不动 DOM。
 *
 * 色板取自 animal-island-ui（MIT）：奶油米底 + 可可棕字 + 松石绿主操作 + 大圆角。
 * 🔴 主色刻意压深到 `#0b7f74`：原作那个亮松石 `#19c8b9` 在奶油底上只有 **2.1:1**，
 *    当链接 / 按钮上的小字看不清（它那边只把亮松石当大面积填充用）。
 *    深档对奶油底 4.4:1、对白面 4.8:1，正文与链接都读得清。
 *
 * @author yijiu2025
 * @since 2026-11-15
 */
import type { MauthThemeColor } from 'skinsuite';

export default {
  meta: {
    id: 'island',
    name: '岛屿米',
    description: '奶油米底 + 可可棕字 + 松石绿主操作，大圆角',
    preview: { primary: '#f6f2e3', accent: '#0b7f74' },
    author: 'oauth21'
  },
  tone: 'light',
  tokens: {
    '--mauth-canvas': '#fffdf4',
    '--mauth-bg': '#f6f2e3',
    '--mauth-surface': '#fffdf4',
    '--mauth-surface-2': '#f2ecda',
    '--mauth-surface-3': '#ece5d1',
    '--mauth-surface-press': '#e5dcc3',
    '--mauth-text': '#4a3320',
    '--mauth-text-strong': '#4a3320',
    '--mauth-text-body': '#6b4526',
    '--mauth-text-mid': '#856340',
    '--mauth-text-faint': '#94856e',
    '--mauth-icon': '#8a7a62',
    '--mauth-border': '#e3d8bf',
    '--mauth-border-strong': '#c9b995',
    '--mauth-border-focus': '#0b7f74',
    '--mauth-focus-ring': 'rgba(25, 200, 185, 0.18)',
    '--mauth-primary': '#0b7f74',
    '--mauth-primary-fg': '#ffffff',
    '--mauth-accent': '#0b7f74',
    '--mauth-emphasis-fg': '#0b7f74',
    '--mauth-field-bg': '#fbf8ec',
    '--mauth-field-bg-focus': '#fffdf4',
    '--mauth-field-border': '#e3d8bf',
    '--mauth-field-border-focus': '#0b7f74',
    '--mauth-danger': '#cf4b46',
    '--mauth-danger-bg': '#fdeeec'
  }
} satisfies MauthThemeColor;
