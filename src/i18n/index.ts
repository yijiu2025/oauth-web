/**
 * i18n 装配层 —— **只做装配，不放任何文案**
 *
 * === 文件组织规则（见 docs/standards/frontend-standards.md §10）===
 * · 一个领域 = 一个文件（`login.ts` / `auth.ts` / `register.ts` / `forgot.ts` /
 *   `validation.ts` / `not_found.ts` / `app_missing.ts`），文件名即 namespace（key 前缀）；
 * · 每个领域文件双语（`zh_cn` / `en`）收在一起，`en` 用 `Record<keyof typeof zh, string>`
 *   强制与 `zh` 的 key 对齐（漏译 / 多译编译报错）；
 * · **新增领域**：新建一个领域文件 + 在下面 `messages` 的 zh_cn / en 两处各注册一行，
 *   不要往本文件里塞文案。
 *
 * @author yijiu2025
 * @since 2026-10-19（文案按领域拆出，本文件退化为装配层）
 */
import { createI18n } from 'vue-i18n';
import login from './login';
import auth from './auth';
import register from './register';
import forgot from './forgot';
import validation from './validation';
import not_found from './not_found';
import app_missing from './app_missing';

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  fallbackLocale: 'en',
  messages: {
    zh_cn: {
      login: login.zh_cn,
      auth: auth.zh_cn,
      register: register.zh_cn,
      forgot: forgot.zh_cn,
      validation: validation.zh_cn,
      not_found: not_found.zh_cn,
      app_missing: app_missing.zh_cn
    },
    en: {
      login: login.en,
      auth: auth.en,
      register: register.en,
      forgot: forgot.en,
      validation: validation.en,
      not_found: not_found.en,
      app_missing: app_missing.en
    }
  }
});

export default i18n;
