# OAuth Web · Enterprise Identity Frontend (OAuth 2.1 Login / Authorization)

**简体中文** | [English](README.en.md)

The **pure frontend** of an enterprise unified identity (SSO) system: a complete set of pages for
login, registration, password recovery, QR-code login and the OAuth 2.1 app authorization flow
(`authorize` / `consent`), plus multi-theme, multi-device layouts, zh/en i18n and dark mode.
The backend account & authorization service lives in a separate repository,
[CoreFlow (nodeservers)](https://github.com/yijiu2025/CoreFlow).

**What it solves**: sub-apps (retroweb / posecraft / firewall …) don't each build their own login
page — they send users here to log in and grant consent, then receive an OAuth 2.1 authorization
code. This repo can be deployed standalone as the authorization center, or embedded into other apps
via iframe (`/mini-login` compact login).

> Stack: Vue 3.5 (Composition API) + TypeScript 6 + Vite 8 (Rolldown + Oxc) + Pinia 3 + Vue Router 5
> + vue-i18n 11 + Tailwind CSS 3.4 + SCSS + VeeValidate 4 + Zod 3 + axios + Vitest 4
> Port: **5174** (`strictPort`; `/api` is proxied to the backend at `localhost:3000`)
> License: [GPL-3.0](LICENSE)

## Features

| Feature | Description |
| --- | --- |
| Password login | Full flow: login / register / email verification code / forgot & reset password |
| QR-code login | Backend issues a QR token, frontend polls status, auto-login after scan |
| OAuth 2.1 authorization | `/authorize` page + `/consent` page, authorization-code flow with PKCE |
| iframe login | `/mini-login` compact route for host-app popups; `postMessage` only after parent-origin allowlist check |
| Multi-device layouts | web (desktop) / app (mobile) / tablet / mini — URL is never rewritten by viewport |
| Multi-theme | package × device × palette, three orthogonal axes; dark/light toggle, no first-paint flash |
| i18n | vue-i18n; Simplified Chinese (`zh_cn`) default, English (`en`) fallback |
| Request signing | H5 signature (SHA-256 over appKey + timestamp + nonce + url + body), anti-crawl |
| Form validation | Declarative VeeValidate + Zod schemas shared with the backend rules |

## Quick Index

| I want to… | Section |
| --- | --- |
| Run it locally | [1. Getting Started](#1-getting-started) |
| Know where to start reading the code | [2. Project Structure](#2-project-structure) |
| See all pages and routes | [3. Pages & Routes](#3-pages--routes) |
| Integrate with the backend (API / signing / SSO) | [4. Backend Integration](#4-backend-integration) |
| Extend themes / layouts / languages | [5. Themes, Layouts & i18n](#5-themes-layouts--i18n) |
| Check constraints before hacking | [6. Known Constraints](#6-known-constraints) |

---

## 1. Getting Started

Prerequisites: Node.js 18+ (20+ recommended), npm 9+. Start the backend service (CoreFlow)
separately — see [4. Backend Integration](#4-backend-integration).

```bash
git clone https://github.com/yijiu2025/oauth-web.git
cd oauth-web
npm install
npm run dev            # http://localhost:5174
```

### Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 5174 (`strictPort` — fails loudly instead of silently switching ports) |
| `npm run build` | `vue-tsc -b` type-check, then `vite build` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Vitest unit tests (`__tests__/` and `e2e/`) |
| `npm run lint` / `lint:fix` | ESLint check / auto-fix |
| `npm run type-check` | Type-check only (`vue-tsc -b`) |

### Environment Variables

Copy `.env.example` to `.env` (dev reads `.env.development`; never commit real secrets):

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL; in dev, `/api` is proxied by vite | `http://localhost:3000` |
| `VITE_APP_TITLE` | Page title | `Enterprise Identity System` |
| `VITE_RECAPTCHA_ENABLED` | Enable captcha (must match backend `RECAPTCHA_ENABLED`) | `false` |
| `VITE_RECAPTCHA_SITE_KEY` | hCaptcha site key (site keys are public by design) | — |
| `VITE_PASSWORD_RESET_MODE` | `code` (verification code) / `link` (email link) | `code` |
| `VITE_ALLOWED_PARENT_ORIGINS` | Comma-separated parent origins allowed to embed via iframe | Local dev origins |
| `VITE_SIGN_APP_KEY` | H5 signing appKey (shared with backend; weak anti-crawl — real security is session + permissions) | — |
| `VITE_SOCIAL_ENDPOINT` | Social-login authorize endpoint — **relative in-site paths only** (absolute URLs are deliberately rejected) | empty |
| `VITE_SOCIAL_PROVIDERS` | Default visible providers (`wechat,alipay,qq,weibo,github,apple`) | empty |

## 2. Project Structure

```text
oauth-web/
├── src/
│   ├── api/             # Request layer (auth.ts: login / authorization / QR / verification)
│   ├── assets/          # Static assets (icons / global styles)
│   ├── components/      # Business components + ui atoms (SvgIcon, …)
│   ├── composables/     # Composition functions (useAuth / useTheme …)
│   ├── i18n/            # i18n (zh_cn default / en fallback)
│   ├── layouts/         # Layout components
│   ├── router/          # Routes & guards (page routes are auto-generated)
│   ├── stores/          # Pinia store modules
│   ├── theme/           # Theme system: package × device × palette (orthogonal)
│   ├── types/           # Global TypeScript types
│   ├── utils/           # Utilities (request wrapper / validation / storage)
│   └── view/            # Pages: web desktop / app mobile / tablet layouts
├── config/aliases.ts    # Single source of truth for path aliases
├── docs/                # Project docs (frontend generation guide, Git release rules, …)
├── scripts/             # Release script (release-web.mjs: commit-driven tag + GitHub Release)
├── __tests__/           # Unit tests (Vitest)
├── e2e/                 # End-to-end tests
├── public/              # Static files copied as-is
└── vite.config.ts       # Vite config (proxy / aliases / auto-import / SVG sprite)
```

Suggested reading order: `main.ts` (entry) → `router/routes.ts` (how routes are generated) →
`view/web/login/index.vue` (dispatcher) → `theme/README.md` (theme system overview).

## 3. Pages & Routes

| Route | Page | Notes |
| --- | --- | --- |
| `/login` | Login | Password + QR login; `?from=mini` for compact form |
| `/m/login` | Login (mobile) | Same dispatcher as `/login`; narrow viewport renders the mobile layout, **URL unchanged** |
| `/mini-login` | Compact login | Standalone route for host-app iframe embedding |
| `/register` | Register | Email verification code registration |
| `/forgot-password` | Forgot password | Code / email-link modes (`/reset-password?token=` redirects here, query preserved) |
| `/authorize` | App authorization | OAuth 2.1 authorization-code + PKCE entry |
| `/consent` | Consent confirmation | authorize flow carries `session_id`, login flow carries `consent_key` |

Routes are **auto-generated** from the page registry (`theme/views/pages.ts`): adding a page =
contract file + dispatcher directory + theme directory, no route-table edits.

## 4. Backend Integration

This repo is frontend-only; all account / authorization capabilities come from the backend
[CoreFlow (nodeservers)](https://github.com/yijiu2025/CoreFlow). For local integration:

1. Run the backend on `localhost:3000` (Fastify + Sequelize + Redis) with migrations applied;
2. `npm run dev` here — `/api` and `/oauth2.1` are proxied to the backend by vite;
3. `VITE_SIGN_APP_KEY` in this repo's `.env` must equal the backend's `SIGN_APP_KEY`, or H5
   signature verification fails;
4. Keep `VITE_RECAPTCHA_ENABLED` ↔ backend `RECAPTCHA_ENABLED` and `VITE_PASSWORD_RESET_MODE` ↔
   backend `PASSWORD_RESET_MODE` in sync.

Main frontend endpoints (`src/api/auth.ts`):

| Endpoint | Purpose |
| --- | --- |
| `POST /oauth2.1/login` | Password login |
| `POST /oauth2.1/login/consent/confirm` | Confirm consent |
| `POST /oauth2.1/login/verify-email` | Email verification code |
| `GET /oauth2.1/authorize` | Fetch authorization page info |
| `POST /oauth2.1/authorize/consent` | Submit consent |
| `GET /oauth2.1/qr/generate` | Generate QR-login code |
| `GET /oauth2.1/qr/status` | Poll QR-scan status |

### iframe SSO (embedding into other apps)

Host apps (same pattern as retroweb / posecraft / firewall) embed `/mini-login` in an iframe:

- Handshake via `postMessage` with **origin + source double validation** (`SSO_READY` / theme sync);
- Messages are sent only when the parent origin matches `VITE_ALLOWED_PARENT_ORIGINS` — a
  misconfiguration shows as the host popup waiting the full 3s fallback timeout;
- Popup width/height match the iframe inner port 1:1.

## 5. Themes, Layouts & i18n

- **Three orthogonal theme axes**: token baseline → skin package → layout; directory name is the
  id, the registry discovers packages automatically;
- **Peer-level devices**: `mobile | standard | mini | tablet` — mini is an independent device
  dimension (not a shorthand for mobile);
- **URL params**: `?theme=` / `?skin=` are device-independent; `?view=<page>` overrides the
  declared layout, invalid values do not fall back;
- **Dark mode**: theme is pre-applied inline in `index.html` — no first-paint flash;
- **i18n**: `src/i18n/index.ts`, default `zh_cn`, `en` fallback; add a messages object for a new
  language.

## 6. Known Constraints

- **Backend required**: without CoreFlow, login / authorization / QR all fail (pages render, APIs
  error out);
- **Port is pinned to 5174**: `strictPort` — startup fails if taken, deliberately, so phones don't
  connect to the wrong port;
- **`.env` is not committed**: only `.env.example` and `.env.development` are; real secrets go
  through deployment env vars;
- **H5 signing is weak anti-crawl**: the frontend can be de-compiled, so the appKey is obtainable —
  the real security boundary is backend session + permission checks;
- **Social-login endpoints accept relative in-site paths only**: an externally settable endpoint
  would turn "redirect users anywhere" from a vulnerability into a configuration option.

## License

[GNU General Public License v3.0](LICENSE) — consistent with the backend CoreFlow: you may freely
use, modify and redistribute this code, but derivative works must be open-sourced under the same
license.
