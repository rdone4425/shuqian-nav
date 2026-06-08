# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

书签导航 (Bookmark Navigator) — a single-admin bookmark workspace running on **Cloudflare Pages + Pages Functions + D1**. The frontend is static (no build step); the backend is file-routed Functions; D1 (SQLite) is the only datastore. UI text and most code comments are in Chinese — match that when editing.

## Repo shape: two npm packages

- **Root `package.json`** — dev/test tooling only (eslint, prettier, wrangler, puppeteer-core) plus `jose`. All quality commands run from here.
- **`pages/package.json`** — the deployment wrapper. This is the wrangler that actually runs `dev`/`deploy` (pinned to wrangler v4; the root's wrangler v3 is only for tooling). D1 binding lives in `pages/wrangler.toml`.

Install requires **both**: `npm install` _and_ `npm --prefix pages install`.

## Commands

```bash
npm run dev            # local Pages dev server (proxies to pages/, persists D1 to ../.wrangler/state)
npm run dev:local      # same, forces wrangler --local
npm run lint           # eslint over public/js, pages/functions, scripts, tests
npm run lint:fix
npm run format:check   # prettier --check (CI gate)
npm run format         # prettier --write
npm test               # audit-loading-matrix.mjs + node --test + lint + format:check  (full CI gate)
npm run deploy         # manual deploy via pages/ (CI normally does this on push to main)
```

Run a single test: `node --test tests/api-core.test.js`, narrow with `--test-name-pattern "login endpoint issues"`.

The frontend audit alone (fast, no network): `node scripts/audit-loading-matrix.mjs` — must be run from the repo root (it resolves `public/` via `process.cwd()`).

The other `scripts/` are **not** wired into `npm test`/CI — run them by hand when needed: `audit-buttons.mjs` (standalone button/markup audit) and `screenshot-admin.mjs` (puppeteer admin screenshots).

### Local setup notes

`scripts/setup-config.cjs` and `scripts/reset.cjs` do not exist in the repo. The root package intentionally exposes only the working D1 initializer:

- `.dev.vars` (gitignored) and `pages/wrangler.toml` (committed) are already present; create/edit them by hand. `.dev.vars` needs `ADMIN_PASSWORD`, `JWT_SECRET`, `ENVIRONMENT=development`.
- Local D1 lives in the gitignored `.wrangler/state`. Run `npm run db:init:local` from the repo root to apply `db/schema.sql` with the `pages/` wrangler.

## Backend: Pages Functions (`pages/functions/`)

File-based routing: `api/**/*.js` → `/api/**`; handlers export `onRequestGet/Post/Put/Delete`; `[id].js` is a dynamic segment read from `context.params`. `_middleware.js` runs on every request (security headers + CORS; allows only same-origin HTTPS / `chrome-extension:` origins, or localhost in dev; blocks `curl` UA in production).

**Two patterns are load-bearing — follow them in every endpoint:**

1. **All responses go through `ResponseHelper`** (`utils/response-helper.js`). Standard envelope: `{ success, data?, message?, error?, timestamp }`. Use `.success() / .error() / .unauthorized() / .validationError() / .notFound() / .businessError()`. Tests assert on this shape.
2. **Writes require auth; specific reads are public.** Gate mutating handlers with `authenticateRequest(request, env)` from `api/auth/verify.js` at the top of the handler (returns `{ authenticated, error, user }`). Public/no-auth endpoints are deliberately: bookmark list GET, category list GET, bookmark `/visit` POST, and analytics summary + visit recording. `tests/api-core.test.js` enforces this exact boundary — don't lock down a public read or open up a write.

Other shared utils: `DatabaseHelper` (D1 query/execute/paginate/insert/update over `env.BOOKMARKS_DB`, throws `DatabaseError`), `Validator`, `deleted-bookmarks` (soft-delete archival into `deleted_bookmarks`), `bookmark-analytics`, `backup-manager`, `link-checker-protection`/`-status`. Handlers are written to tolerate an empty/missing DB (e.g. list endpoints return an empty result on `no such table`).

### Auth model

Single admin, password-based. Password resolution order: D1 `system_config.admin_password` (if changed from the default) → `env.ADMIN_PASSWORD` → `admin123`. Login (`/api/auth/login`) issues a 7-day `jose` HS256 JWT with `type: "web-session"`. The signing secret is resolved by `JWTKeyManager`: `env.JWT_SECRET` → in-memory cache → D1 `system_config.jwt_secret` → auto-generated and persisted (set `JWT_SECRET` in prod for stable sessions across cold starts).

Two other token paths share the same secret: **API tokens** (`type: "api-token"`, created at `/api/auth/token` for the Chrome extension; disable the UI with `PUBLIC_API_TOKEN_MANAGEMENT=disabled`) and the **cron** endpoint (`/api/cron/weekly-check`, authenticated with `env.CRON_SECRET` as the Bearer token).

## Frontend: static `public/` (no framework, no bundler)

Plain HTML + vanilla JS attached to `window` globals (`API`, `Auth`, `SiteMenu`, `AdminUI`, `AdminShell`, …), loaded via `<script src>` with `?v=nav-*` cache-busting strings.

**Module ownership is strictly enforced by `scripts/audit-loading-matrix.mjs`** (part of `npm test`):

- `public/js/home/*` — homepage (`index.html`) only; **public and must not reference `Auth`**.
- `public/js/admin/*` — one module per admin page; each must call `AdminUI.requireAuth()` before protected work (and exposes an `init(params)`/`destroy()` view API for the SPA router — see below).
- `public/js/shared/*` — `api.js` (fetch client w/ retry+timeout, auto-logout on 401), `auth.js` (session/login, localStorage `bookmark_nav_token`, cached verification), `site-menu.js` (the single source of truth for header/nav, injects `/components/header.html`), `admin-menu.js` + `admin-router.js` (admin nav data + SPA router — see below), `admin-common.js` (`AdminUI` + shared confirm dialog), `admin-shell.js` (admin sidebar).
- `public/js/` root may contain **only** `login.js`.

The audit also pins, per page: exact script **load order**, required cache-busting **version strings** (some files have an expected `?v=nav-...` value baked into the audit), no inline `onclick`, no inline business-logic `<script>` on admin pages, no private confirm modals (use `AdminUI.confirm`), and that the homepage exposes no admin controls. If you add/rename/move a frontend script or change load order, you must update the audit expectations **and** `docs/refactor-loading-matrix.md` (the audit checks that doc too), and bump the `?v=nav-*` version.

Pages declare identity through `data-*` on a `[data-site-header]` host element: `data-page-key` (matches a `SiteMenu` item key) and `data-require-auth` (`"false"` = public homepage). `SiteMenu.init()` injects the header, then calls `Auth.init({ requireAuth })`; `AdminShell` renders the sidebar on protected pages.

### Admin nav data + in-progress SPA

`admin-menu.js` (`window.AdminMenu`) is the **single source of truth for admin navigation/routing**: an ordered `routes` list, each entry keyed by `key` and carrying its sidebar `group`, view `module` global name (e.g. `BookmarkManagePage`), and SPA `fragment` path. `admin-shell.js` renders the sidebar from `AdminMenu.getAdminMenuGroups()` — don't hardcode admin links anywhere else.

The admin area is **mid-migration from multi-page to a single hash-routed SPA**, and `admin-menu.js` is built to serve both: `AdminMenu.hrefFor(key)` emits `/<key>.html` (legacy) outside the shell, `#/<key>` inside it. `admin-router.js` (`window.AdminRouter`, run only by the SPA shell) parses `#/<key>?<query>`, fetches the route's `fragment`, injects it into `#adminViewContent`, then calls the view module's `init(params)` — running `destroy()` on the previous view, `onParams()` for query-only changes, and `AdminUI.requireAuth()` on every route. **Current live state:** the per-page `<key>.html` files still ship and `public/admin.html` + `public/fragments/*.html` do **not** exist yet, so the multi-page structure is what deploys and what the loading-matrix audit enforces today. When building out the SPA, add the shell + fragments and keep `admin-menu.js` the only place that enumerates routes.

## Data & deploy

- **Schema is one file: `db/schema.sql`** — keep it idempotent (`CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE` seeds). CI re-applies it on every deploy, so all schema changes go here, not into migration code.
- **Deploy** (`.github/workflows/frontend_pagefunction_deploy.yml`, on push to `main`): npm ci → `npm test` gate → ensure-D1-and-Pages-project (idempotent Cloudflare API script that also patches env vars from secrets) → apply `db/schema.sql` to remote D1 → `wrangler pages deploy ../public`. The `database_id` in `pages/wrangler.toml` is a placeholder (`0000…0`) that CI patches with the resolved D1 id at deploy time.
- Required secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Pages: Edit + D1: Edit). Optional: `PAGES_ADMIN_PASSWORD`, `PAGES_JWT_SECRET`, `PAGES_CRON_SECRET`, and the `PUBLIC_API_TOKEN_MANAGEMENT` repo var.
- Several legacy entry points (`/setup-password`, `/diagnose`, `/api/system/reset-database`, …) were removed and now 301 to live routes via `public/_redirects`; don't reintroduce them.

## Companion: `chrome/`

A Manifest V3 extension ("书签同步助手") that pushes Chrome bookmarks to the server using an API token. Independent of the Pages build; its `host_permissions` point at the deployed `*.pages.dev` origin and localhost.
