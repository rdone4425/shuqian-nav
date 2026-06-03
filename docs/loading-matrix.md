# Home and Admin Loading Matrix

This project keeps the public homepage and protected admin pages in the same
Cloudflare Pages app, but their business scripts stay separate.

## Shared Contract

- `public/components/header.html` is the only shared header source.
- `public/js/shared/auth.js` handles token lifecycle for all surfaces.
- `public/js/shared/site-menu.js` injects the shared header and routes protected links.
- `public/js/shared/api.js` is the shared API client where a page needs API helpers.

## Public Pages

| Page               | Auth                                | Allowed scripts                                                                                            |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/` (`index.html`) | Public, `data-require-auth="false"` | `/js/home/i18n.js`, `/js/shared/auth.js`, `/js/shared/api.js`, `/js/shared/site-menu.js`, and `/js/home/*` |
| `/login.html`      | Public                              | `/js/shared/auth.js`, `login.js`                                                                           |

The homepage must not load `admin-common.js` or any admin page module. Only
`index.html` may load `/js/home/*`, and old homepage paths such as
`/js/i18n.js`, `/js/bookmarks.js`, or `/js/utils/sorting.js` must stay
migrated under `/js/home/`. The homepage controller must initialize `Auth` with
`requireAuth: false`.

## Protected Admin Pages

| Page                      | Required module                      |
| ------------------------- | ------------------------------------ |
| `/admin-settings.html`    | `/js/admin/admin-settings.js`        |
| `/bookmarks-manage.html`  | `/js/admin/bookmark-manager-page.js` |
| `/categories.html`        | `/js/admin/category-manager.js`      |
| `/deleted-bookmarks.html` | `/js/admin/deleted-bookmarks.js`     |
| `/import.html`            | `/js/admin/import.js`                |
| `/link-checker.html`      | `/js/admin/link-checker-page.js`     |
| `/notifications.html`     | `/js/admin/notifications-page.js`    |
| `/token.html`             | `/js/admin/token-page.js`            |

Every protected admin page must load its `/js/admin/...` page module plus `/js/shared/auth.js`,
`/js/shared/site-menu.js`, and `/js/shared/admin-common.js`, carry `data-site-header` and `data-page-key`, avoid
`data-require-auth="false"`, keep page business logic in external modules, and
call `AdminUI.requireAuth()` in its page module before protected work starts.
It must also render the shared `workspace-section-heading` shell so protected
pages keep a consistent title, description, and primary context area.
`/js/shared/admin-common.js` owns the protected-page `Auth.init({ requireAuth: true })`
guard.

`admin-dashboard.html` remains a redirect stub to `/admin-settings.html` and
does not load scripts.

## Script Directory Contract

The `public/js/` root is reserved for page scripts that have no product-surface
namespace. Today only `public/js/login.js` may live there. Homepage scripts must
live under `public/js/home/`, protected admin page modules must live under
`public/js/admin/`, and shared runtime code must live under `public/js/shared/`.

## Script Order Contract

HTML pages load plain scripts without a bundler, so dependency order is part of
the contract. The homepage loads i18n first, then auth/storage/API/home helpers,
then the shared menu, and finally `home/app.js`. Protected admin pages load
`shared/api.js` when needed, then auth, menu, `admin-common.js`, and finally the
page module. `token.html` skips the API client and loads auth, menu,
`admin-common.js`, then `admin/token-page.js`. The login page only loads shared
auth before `login.js`.

## Cache Busting

Every local JavaScript file referenced from HTML with a `/js/...` path must
include a `?v=nav-...` query string. This includes shared runtime scripts,
homepage scripts, login scripts, and admin page modules.

This keeps deployed admin shell, menu, API client, and page behavior changes
from being hidden by stale browser or edge caches.

CSS files that carry page or shell UI changes must also use `?v=nav-...` in
HTML references. The base `/css/styles.css` file is the only stable stylesheet
that may be referenced without a query string.

`/js/shared/site-menu.js` must derive its `Auth.init` `requireAuth` value from the
`data-require-auth` attribute so the homepage stays public while admin pages
remain protected.

## Menu Contract

`/js/shared/site-menu.js` is the single global menu source. Its groups must preserve the
roadmap information architecture: overview, content management, quick create,
data tools, maintenance tools, and account/security. Every protected admin page
must have a matching menu item whose key matches the page `data-page-key`, and
every menu item except `home` must require authentication.

## Event Binding

Frontend JavaScript should bind interactions with `addEventListener`. The CI
audit rejects `onclick="..."` HTML strings and `.onclick = ...` assignments in
`public/js` so page behavior stays in JavaScript modules instead of generated
markup.

## CI Guard

`npm test` runs `node scripts/audit-loading-matrix.mjs` before the API tests,
lint, and Prettier checks. The audit fails if the homepage starts loading admin
scripts, an admin page starts loading homepage scripts, or a protected admin page
loses its shared admin shell, workspace heading, or module-level auth guard, or
old homepage script paths return, if admin page modules return to the `/js/` root, if extra JavaScript files appear directly under `public/js/`, or if page scripts are loaded out of their required order. It also fails if the shared auth entry points
stop honoring the public-home/protected-admin boundary, if the shared menu loses
its roadmap grouping or protected-entry auth markers, if public JavaScript
reintroduces inline click handlers, or if local JavaScript files or non-base
CSS files are referenced without cache-busting query strings.
