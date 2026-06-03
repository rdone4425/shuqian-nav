# Admin (后台) UI Unification Plan — shuqian-nav

A concrete, no-build plan to unify the 9 admin pages on the roadmap's target CSS architecture (`tokens.css` / `base.css` / `components.css` / `admin.css`), building on the existing `AdminShell` + `AdminUI` + `SiteMenu` + `components/header.html` runtime. `home.css` is out of scope.

---

## 1. Executive summary — what is inconsistent & the root causes

**Symptoms (verified against the audit + source):**

- **Three+ competing brand palettes for one product.** Tool pages (`deleted-bookmarks`, `import`, `link-checker`, `notifications`, `token`) render on purple `#667eea`; `admin.css` uses blue `#2764e7`; `subpages.css` uses near-black `#111111` / blue `#2563eb`; `management.css` borrows `--wr-*` (≈`#2f6fed`). "Primary button" is purple, black, or blue depending on which sheet wins the cascade.
- **`AdminUI.showToast` renders UNSTYLED on 3+ pages.** `admin-common.js:44-48` emits `class="message-toast {type}"`, but `.message-toast` is defined **only** in `management.css` (lines 295-320, confirmed). `deleted-bookmarks.html`, `import.html`, `link-checker.html`, `notifications.html`, `token.html` do **not** link `management.css`, so every toast on those pages is an unstyled block. This is the single most visible runtime break.
- **`.btn-sm` is used but defined nowhere.** Every row button in `deleted-bookmarks.js` uses `btn btn-sm <variant>`; `.btn-sm` exists in no CSS file (confirmed: `styles.css` has `.btn`, `.btn-primary/secondary/outline/soft/success/danger/full/close` but **no** `.btn-sm` and **no** `.btn-warning`).
- **JS-emitted class names drift from the CSS.** `deleted-bookmarks.js` emits `.record-favicon`/`.record-time`/`.reason-manual` (CSS defines the differently-named `.record-icon`/`.record-date`); `import.js` emits `.item-title`/`.item-url`/`.import-result`/`.result-icon` (CSS defines `.preview-item-title` and never defines `.import-result`). The most important output of each page (the recycle-bin rows; the import result panel) renders largely unstyled.
- **Bespoke duplicates of shared widgets.** `categories.html` hand-rolls `#deleteCategoryModal` (`.management-modal*`, used by no other page) and runs a redundant two-step double-modal; `deleted-bookmarks.html` hand-rolls `#restoreModal` while using `AdminUI.confirm` for delete on the same page; `import.js` hand-rolls `showMessage` as a near-copy of `AdminUI.showToast`.
- **~260 lines of byte-identical token blocks + 6 redundant `.btn` kits + 5 duplicate `@keyframes spin`** across the `-enhanced` files (per the CSS audit).

**Root causes:**

1. **No shared design-system home exists.** Of the 5 roadmap files, only `admin.css` exists; `tokens.css`/`base.css`/`components.css`/`home.css` do **not** (verified by `ls`). With nowhere to put shared tokens/components, every page invented its own.
2. **The one clean sheet is orphaned.** `management.css` has the best table/form/modal/toast/pagination, but it consumes `--wr-*` tokens defined in `workspace-refresh.css` (the out-of-scope home sheet), so it can't be reused standalone.
3. **Per-page stylesheets redefine globals.** The `-enhanced` files redeclare `:root`, `*`, `body`, `.container`, `.header`, and `.btn` — turning appearance into a cascade/load-order lottery instead of a system.
4. **The active-state and class contract is convention-only.** `SiteMenu.markActive` (dropdown) and `AdminShell.renderItem` (sidebar) each independently read `data-page-key`; the confirm dialog and toast depend on generic class names (`.modal`, `.btn`, `.form-group`, `.message-toast`) that have no guaranteed home.

**Strategy:** Create the missing shared layer, **seeded from the files that already back the live JS contract** (`styles.css` for `.btn*`/`.modal*`, `management.css` for table/form/toast), re-point everything to one token vocabulary, link the same 4-file bundle on all 9 pages, then delete the `-enhanced` files. Touch **zero** runtime JS contracts except the documented per-page fixes (class renames, swapping bespoke modals for `AdminUI.confirm`, routing feedback through `AdminUI.showToast`).

---

## 2. Unified design system

### 2.1 `tokens.css` — variables only

Scope to `:root` so both home and admin inherit. Values chosen to match the two cleanest admin sheets (`admin.css`, `management.css`) and the audit's `recommendedTokens`.

```css
/* public/css/tokens.css */
:root {
  /* ---- Color ---- */
  --c-bg: #f5f7f8;            /* app canvas  (= admin.css --admin-bg) */
  --c-surface: #ffffff;        /* card/panel; flat, no glass blur */
  --c-surface-soft: #f8fafc;   /* table header strips, inset tiles */
  --c-border: #d9e1ea;         /* default 1px border */
  --c-border-soft: #edf1f5;    /* hairline row/cell divider */
  --c-text: #3f4b5d;           /* body text */
  --c-ink: #18212f;            /* headings / strong */
  --c-muted: #768294;          /* labels, captions, urls */

  --c-primary: #2f6fed;        /* ONE brand blue (kills purple #667eea) */
  --c-primary-hover: #2a63d6;
  --c-primary-weak: #edf4ff;   /* active nav item / info chip bg */
  --c-primary-focus: rgba(47, 111, 237, 0.18); /* the ONE focus ring */

  --c-danger: #d93b3b;  --c-danger-weak: #fee2e2;
  --c-warning: #d88716; --c-warning-weak: #fef3c7;
  --c-success: #0f9f6e; --c-success-weak: #dcfce7;
  --c-info: #2f6fed;    --c-info-weak: #edf4ff;

  /* ---- Spacing (4 · 8 · 12 · 16 · 24 · 32) ---- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;

  /* ---- Radius ---- */
  --radius: 8px;        /* card/button (= --wr-radius = --admin-radius) */
  --radius-sm: 6px;     /* inputs, chips */
  --radius-pill: 9999px;/* badges/counts — ONE badge shape */

  /* ---- Shadow ---- */
  --shadow: 0 10px 24px rgba(24, 33, 47, 0.07);
  --shadow-pop: 0 18px 38px rgba(24, 33, 47, 0.12);

  /* ---- Typography ---- */
  --fs-xs: 0.75rem;   /* captions, badges, table headers */
  --fs-sm: 0.875rem;  /* secondary text, form labels, list urls */
  --fs-base: 1rem;    /* body / button label */
  --fs-lg: 1.125rem;  /* list-row titles (fixes --font-size-lg typo) */
  --fs-xl: 1.25rem;   /* panel titles */
  --fs-2xl: 1.5rem;   /* page/card titles */
  --fs-3xl: 1.875rem; /* hero metric numbers */

  --transition: 150ms ease;
}
```

Replaces the 6 scattered `:root` blocks: the 4 byte-identical `--primary-color` blocks in `deleted-bookmarks-enhanced.css` / `link-checker-enhanced.css` / `notifications-enhanced.css` / `token-enhanced.css`, the `--admin-*` block in `admin.css`, and the `--wr-*` block (home-only) consumed by `management.css`.

### 2.2 `base.css` — reset + shared shell

Consolidates the duplicated `* { box-sizing }` / `body` / `.container` / `.hidden` / `.text-*` rules (5 `-enhanced` files each ship their own).

| Selector | Consolidate FROM | Notes |
|---|---|---|
| `*, *::before, *::after { box-sizing }` | any `-enhanced` (identical) | one copy |
| `body` | `admin.css` body bg + Inter/Noto stack | `background: var(--c-bg)` |
| `.container` | standardize to `max-width: 1400px` | kills 1200/1400 conflict |
| `.hidden { display:none !important }` | `subpages.css`/styles | one copy (6 dupes today) |
| `.text-center/.text-left/.text-right`, `.muted-text` | `deleted-bookmarks-enhanced` / `management.css` | utilities |
| `.page-heading` (kicker/title/copy) | rename of `.workspace-section-heading` from `workspace-refresh.css:1132+` | so admin pages drop the home sheet |

### 2.3 `components.css` — the shared component catalog

> **Hard contract:** `components.css` MUST define exactly the class names the existing shared JS emits, or `AdminUI.confirm` / `AdminUI.showToast` break on every page simultaneously. Verified contract from `admin-common.js`: `.modal`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-actions`, `.admin-confirm-dialog`, `.form-group`, `.form-input`, `.form-help`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.message-toast`, `.message-toast.error/.warning`, `.hidden`. From `header.html`: `.action-btn-icon`, `.btn-icon` (these stay header-owned, but the icon-button base lives here).

| Canonical class | Variants | Consolidate FROM | Notes |
|---|---|---|---|
| `.btn` | `.btn-primary` `.btn-secondary` `.btn-outline` `.btn-soft` `.btn-success` `.btn-danger` **`.btn-warning`(NEW)** `.btn-sm`(NEW) `.btn-full` | **`styles.css:165-242`** (real current home) | Drop the invalid `.btn::before{background:transparent, transparent)}` shimmer. Map primary→`--c-primary`. **Add `.btn-sm`** (`min-height:32px; padding:var(--space-1) var(--space-3); font:var(--fs-sm)`) — closes the undefined-class bug. **Add `.btn-warning`** (`token`/`notifications` reference it). Delete all 5 `-enhanced` `.btn` kits + import's triple-def. |
| `.btn-icon` | `.btn-icon-sm` (32×32) | `deleted-bookmarks-enhanced` `.action-btn-icon` (44×44) + `styles.css` `.btn-close` | **Fix the `var(--font-size-lg)` typo → `var(--fs-lg)`.** Replaces `.action-btn-icon`, `.btn-close`, bespoke `.restore-btn`/`.keep-btn`/`.delete-single-btn`. |
| `.form-input` `.form-select` `.form-textarea` `.form-group` `.form-label` `.form-help` | — | `management.css` (`.management-input` 1px/38px/`--radius-sm`) + `styles.css` (`.form-input`/`.form-group`/`.form-help` used by confirm dialog) | **Standardize border to 1px** (kill the 2px in `.form-input`/`.form-select` from token/link-checker). Adopt `subpages.css` `.sp-filter-select` SVG chevron for selects. Focus ring → `--c-primary-focus`. Keep `.management-input` as an alias so management markup is untouched. |
| `.toolbar` `.filter-group` `.toolbar-fields` `.toolbar-actions` | — | `management.css` `.management-toolbar` (grid 1fr/auto panel) + `subpages.css` `.sp-filter-bar` (flat flex) | Collapse near-identical `.filter-group`(deleted/notifications) and `.control-group`(link-checker) into one `.filter-group`. |
| `.data-table` | `.data-table-wrap` (overflow-x:auto, min-width:760px) | `management.css` `.management-table` (th `--fs-xs` muted, td padding `12px 10px`, border `--c-border-soft`) | Replaces `.preview-table` (import). |
| `.data-list` `.data-row` | status stripes `.is-ok/.is-bad/.is-warn/.is-info/.is-muted`, `.data-row-title/-url/-meta/-actions` | `subpages.css` `.sp-list`/`.sp-row` (cleanest; 3px `::before` stripe, named states, has `.sp-list-header`) | Replaces `.record-item`(deleted), `.bookmark-item`(link-checker — also deletes its ~50 `!important` grid overrides), `.notification-item`(notifications), `.token-item`(token). Stripe colors → `--c-success/-danger/-warning/-primary/-muted`. |
| `.card` | `.card-header` `.card-title` | `management.css` `.management-*` panel (1px border, `--radius`, solid surface, real `--shadow`) + `subpages.css` `.sp-card-header` | Drop `backdrop-filter:blur` + `box-shadow:none`. Replaces `.content-section`/`.notification-card`/`.token-card`/`.sp-card`/`.admin-dashboard-card` (dashboard keeps its own in `admin.css`). |
| `.badge` | `.badge-ok/-bad/-warn/-info/-muted` | `subpages.css` `.sp-badge` (pill) | **ONE shape: pill (`--radius-pill`).** bg/text → `--c-*-weak`/`--c-*`. Replaces `.status-*`(notifications), `.token-status`(token), `.endpoint-method`(token), `.category-pill`(management), `.bookmark-category`(link-checker). |
| `.modal` | `.modal-content` `.modal-header` `.modal-body` `.modal-actions` `.modal-close` `.admin-confirm-dialog` `.modal-large` | **`styles.css:267+`** (the home the confirm dialog already uses) + `management.css` `.management-modal*` overlay | Overlay `rgba(15,23,42,.42)`, `--radius`, `--shadow-pop`, `.hidden` toggle. Fold `.management-modal*` into `.modal` here so `categories.html` markup is untouched. Keep `.btn-close`→`.modal-close`. |
| `.message-toast` | `.message-toast.error/.warning/.success` | `management.css:295-320` (the canonical skin) | **Move into the always-linked layer** — this single move fixes the unstyled toast on 5 pages. Fixed bottom-right; matches what `AdminUI.showToast` emits. |
| `.alert` | `.alert-success/-error/-warning/-info` | `import-enhanced.css` `.message/.message-*` (inline banner, 4px left border) | Inline status, **separate** from `.message-toast`. Fold `link-checker .safety-notice` + `token .security-notice` into `.alert-warning`. |
| `.empty-state` | `.empty-icon` `.empty-title` `.empty-description` | `deleted-bookmarks-enhanced.css` | Delete the identical copies in link-checker/notifications and `management.css` `.management-empty`. |
| `.spinner` | `.is-loading::after` (button overlay) | `deleted-bookmarks-enhanced.css` `.loading-spinner` | **ONE `@keyframes spin`** (5 dupes today). |
| `.pagination` | `.pagination-btn` `.page-numbers` `.page-btn` | `notifications-enhanced.css` (full 40×40 widget) | `management.css`'s bare `.management-pagination` uses this instead of its own flex row. |
| `.stat-card` | `.stat-value` `.stat-label` `.stat-card--accent` | `subpages.css` `.sp-stat-card` (clean nth-child top bar) + `admin.css` `.metric-card` (dashboard hero) | The duplicated `nth-child(1..4)::before` 4-color bar becomes one rule keyed to `--c-danger/-warning/-primary/-success`. |

### 2.4 `admin.css` — shell skin only (kept, retargeted)

Stays the admin-only layer per roadmap ("后台壳、表格、工具条"). Keep `.admin-sidebar*`, `.admin-mobile-toggle`, `.admin-sidebar-backdrop`, container offset, header override, and the genuinely page-specific dashboard block (`.metric-card`, `.admin-dashboard-grid/-action/-list/-row`, `.admin-row-mark`). **Change:** delete the local `--admin-*` block and re-point those rules to `tokens.css` `--c-*` (e.g. `--admin-blue`→`--c-primary`, `--admin-bg`→`--c-bg`, `--admin-radius`→`--radius`).

### 2.5 Optional roadmap follow-up (not required for unification)

The roadmap proposes splitting `AdminUI` into `confirm-dialog.js` + `toast.js`. **Defer** — `admin-common.js` already works and the CSS unification is independent of it. Revisit only after the CSS lands.

---

## 3. Target CSS file layout

### Always linked on every admin page (in this order, with `?v=` bump)
```
/css/tokens.css        (NEW)  ← variables
/css/base.css          (NEW)  ← reset, body, .container, .hidden, utilities, .page-heading
/css/components.css    (NEW)  ← btn/form/table/list/card/badge/modal/toast/alert/empty/spinner/pagination/stat
/css/admin.css         (KEEP) ← shell + dashboard; retargeted to --c-* tokens
```

### Per-page override (only the genuinely page-unique bits; tiny)
```
/css/import.css            (NEW)  wizard stepper, upload area, custom radio/checkbox, progress, result, danger-zone
/css/link-checker.css      (NEW)  .checker-container, progress, .stat-item filter chips, .bookmark-item grid
/css/notifications.css     (NEW)  .notification-card accent, .notification-item stripe states, .stat-group tiles
/css/deleted-bookmarks.css (NEW)  .record-item rows + reason badges
/css/token.css             (NEW)  .token-*-card / .token-mini-card / intro+guide grids
```

### Collapse map

| Today | Becomes |
|---|---|
| `styles.css` `.btn*`/`.modal*`/`.form-*` | **moved into** `components.css`; `styles.css` retained for home only (out of scope), no longer linked by admin pages |
| `workspace-refresh.css` | home-only; admin pages stop linking it (its `.nav-site .*` admin overrides are deleted) |
| `management.css` | **merged** → table/form/toast/modal/pagination → `components.css`; file deleted |
| `subpages.css` | **merged** → `.sp-*` list/badge/btn/stat → `components.css`; file **deleted** |
| `deleted-bookmarks-enhanced.css` (861) | `.empty-state`/`.spinner`/`.btn-icon` → `components.css`; `.record-item` → `deleted-bookmarks.css`; **rest deleted** |
| `import-enhanced.css` (1401) | `.alert` → `components.css`; wizard/upload/result → `import.css`; **dupe globals deleted** |
| `link-checker-enhanced.css` (1111) | `.bookmark-item`/progress/filter chips → `link-checker.css`; **parallel design-system + `!important` war deleted** |
| `notifications-enhanced.css` (763) | `.pagination` → `components.css`; card/item/stat → `notifications.css`; **dupe globals deleted** |
| `token-enhanced.css` (797) | **deleted entirely** (orphaned; not even linked today) |

**Net:** 10 CSS files (some huge & duplicated) → 4 shared + 5 small page overrides; ~5000+ duplicated lines removed.

---

## 4. Per-page migration checklist

> Universal step for all 9: swap `<link>` tags to the 4-file shared bundle (+ page override where listed), **bump `?v=`** on every changed `link`/`script`, then run `node scripts/audit-buttons.mjs` + a puppeteer screenshot (see §5). Markup edits are called out only where class drift or bespoke widgets exist.

### 4.1 `bookmarks-manage.html` — **PILOT** · Effort **S** · Risk **Low**
- **Current:** `styles + workspace-refresh + management + admin`; markup already 100% shared classes (`.management-*`, `.btn*`, `.field-stack`, `.category-pill`), `AdminUI.confirm` + `showToast` already correct.
- **Target:** `tokens + base + components + admin`.
- **Steps:** (1) swap link tags; (2) `?v=` bump; (3) run audit + screenshot; (4) verify table, pagination, bulk-delete `AdminUI.confirm`, toasts, `.color-swatch` inline color (legit data binding — leave). 
- **Why first:** it's the only page with zero deviations, so any visual change = a `components.css` bug, not a page bug. **This page is the template.**

### 4.2 `admin-settings.html` · Effort **S** · Risk **Low**
- **Current:** `styles + workspace-refresh + management + admin`; exemplary (`.management-panel`, `.field-stack`, `.btn-outline`, `.muted-text`); no page CSS.
- **Target:** `tokens + base + components + admin`.
- **Steps:** link swap + `?v=`; verify export/backup buttons, password form, `.message-toast`. Ensure `components.css` aliases `.management-panel`/`.field-stack`/`.muted-text` so no markup edit.
- **Note (out of CSS scope):** `setDataStatus` over-toasts progress as green success — optional JS nit, not part of this migration.

### 4.3 `categories.html` · Effort **M** · Risk **Medium**
- **Current:** management vocabulary + **bespoke** `#deleteCategoryModal` (`.management-modal*`, used by no other page) + redundant **two-step double-modal** (bespoke modal → then `AdminUI.confirm`).
- **Target:** `tokens + base + components + admin`; `.management-modal*` folded into shared `.modal` inside `components.css` so existing markup works **with no JS change** (low-risk path).
- **Steps:** (1) link swap; (2) add `.management-modal*`→`.modal` alias rules in `components.css`; (3) `?v=`; (4) screenshot the delete-migration flow; (5) **optional follow-up:** collapse the double-modal into one `AdminUI.confirm` with the migration `<select>` in a custom body.
- **Risk:** CSS swap is safe; the double-modal de-dup could regress the migrate-target picker, so keep it optional/second.

### 4.4 `deleted-bookmarks.html` · Effort **L** · Risk **High**
- **Current:** `styles + workspace-refresh + deleted-bookmarks-enhanced + admin`. **Broken:** unstyled toast (no `management.css`); `.btn-sm` undefined; `.record-favicon`/`.record-time`/`.reason-manual` have no CSS; bespoke `#restoreModal` while delete uses `AdminUI.confirm`; competing theme redefines `:root`/`body`/`.btn`.
- **Target:** `tokens + base + components + admin` + small `deleted-bookmarks.css` (`.record-item` rows + reason badges only, ~60 lines).
- **Steps:** (1) delete `deleted-bookmarks-enhanced.css`; (2) create `deleted-bookmarks.css` mapping `.record-item`→shared `.data-row` pattern; (3) in `deleted-bookmarks.js`: rename emitted classes to `.data-row-*` + `.badge` (now defined) + `.btn-sm` (now defined), replace bespoke `#restoreModal` with `AdminUI.confirm`, remove the inline `onerror`/`margin-bottom` styles; (4) `?v=`; (5) screenshot list + restore + delete + toast.

### 4.5 `import.html` · Effort **L** · Risk **High** (do LAST)
- **Current:** `styles + workspace-refresh + import-enhanced + admin`. **Broken:** unstyled toast; result panel + preview list largely unstyled (class drift `.item-*` vs `.preview-item-*`, `.import-result` undefined); hand-rolled `showMessage` duplicates `AdminUI.showToast`; triple `.btn` defs + malformed CSS. **Genuinely page-specific:** 4-step wizard, drag-drop upload, custom radio/checkbox, progress bar, danger-zone.
- **Target:** `tokens + base + components + admin` + `import.css` (wizard/upload/radio/progress/result/danger-zone, re-pointed to tokens).
- **Steps:** (1) extract page-specific blocks into `import.css`; (2) delete global dupes (`.btn*`, `.message-*`, malformed `transparent, transparent)`, dead `.file-input`/`.preview-table`); (3) in `import.js`: delete `showMessage`, call `AdminUI.showToast`; align result/preview class names to what `import.css` defines; replace `style="display:none"` toggles with `.hidden`; (4) `?v=`; (5) screenshot all 4 steps + clear-all typed-confirm + result panel.

### 4.6 `link-checker.html` · Effort **L** · Risk **High**
- **Current:** `styles + workspace-refresh + link-checker-enhanced + admin`. **Broken:** full parallel design system; ~25 `!important` overrides (lines 1052-1111) fighting inherited layout; unstyled toast; bespoke `.keep-btn`/`.unkeep-btn`/`.delete-single-btn`.
- **Target:** `tokens + base + components + admin` + `link-checker.css` (`.checker-container`, progress, `.stat-item` filter chips, `.bookmark-item` grid).
- **Steps:** (1) delete enhanced file **including** the `!important` block; (2) rebuild `.bookmark-item` on shared `.data-list` grid in `link-checker.css`; (3) in `link-checker-page.js`: convert `.keep-btn`/`.delete-single-btn` → `.btn .btn-sm .btn-soft`/`.btn-danger`, keep `.stat-item` filter chips as page-specific; (4) `?v=`; (5) screenshot list + filter chips + a run.

### 4.7 `notifications.html` · Effort **M** · Risk **Medium-High**
- **Current:** `styles + workspace-refresh + notifications-enhanced + admin`; `notifications-enhanced.css` is largely **dead** (workspace-refresh `!important` supersedes it); errors render inline, never via toast.
- **Target:** `tokens + base + components + admin` + small `notifications.css` (`.notification-card` accent + `.notification-item` stripe states `.critical/.important/.unread` + `.stat-group` tiles).
- **Steps:** (1) delete enhanced file; (2) move the 3 live states into `notifications.css` using `--c-danger/-warning/-primary`; (3) in `notifications-page.js`: route error path through `AdminUI.showToast`, use shared `.empty-state`/`.spinner` for empty/loading; (4) `?v=`; (5) screenshot states.

### 4.8 `token.html` · Effort **M** · Risk **Medium**
- **Current:** `styles + workspace-refresh + admin` (no enhanced file linked, but token-* rules are duplicated in `styles.css:793-904` **and** `workspace-refresh.css:1144-1430` with `!important`); dead classes `token-page-shell`/`settings-form`; delete button uses `.btn-soft` for a destructive action; never calls `showToast`; orphan `token-enhanced.css` exists.
- **Target:** `tokens + base + components + admin` + `token.css` (single source for `.token-*-card`/`.token-mini-card`/intro+guide grids).
- **Steps:** (1) lift token-* rules into `token.css`, re-pointed to tokens; (2) **delete orphan `token-enhanced.css`**; (3) remove dead `token-page-shell`/`settings-form` classes; (4) in `token-page.js`: change delete button to `.btn-danger`, add `AdminUI.showToast` for copy/create/delete feedback; (5) `?v=`.

### 4.9 `admin-dashboard.html` · Effort **M** · Risk **Low-Medium**
- **Current:** `styles + workspace-refresh + admin`; already on the unified shell; `.metric-card`/`.admin-dashboard-*` are genuinely page-specific and live in `admin.css`. Loading/empty/error are bare `<p>` (and a `!` placeholder for errors).
- **Target:** `tokens + base + components + admin` (dashboard classes stay in `admin.css`, retargeted to `--c-*`).
- **Steps:** (1) keep dashboard block in `admin.css`, swap `--admin-*`→`--c-*`; (2) move `.workspace-section-heading`→`.page-heading` into `base.css`/`admin.css` so the home sheet can be dropped; (3) in `admin-dashboard.js`: replace bare `<p>` loading/empty/error with shared `.spinner`/`.empty-state` (and drop the `!` error placeholder in favor of an `.empty-state` + existing error toast); (4) `?v=`; (5) screenshot dashboard.

---

## 5. Recommended execution order & verification

**Principle:** build the foundation additively (zero risk), prove it on the cleanest page, then migrate easiest→hardest so the highest-risk pages (`import`, `link-checker`, `deleted-bookmarks`) run last against a battle-tested `components.css`.

1. **Foundation pt.1 — `tokens.css` + `base.css`.** Ship them **alongside** existing sheets on `bookmarks-manage.html` *without removing old CSS yet*. Tokens/utilities are additive → no regression possible. Confirms file loading + `?v=` plumbing.
2. **Foundation pt.2 — `components.css`.** Lift `.btn*` from `styles.css` (+ add `.btn-sm`/`.btn-warning`/`.btn-icon`), `.modal*`/`.form-*` from `styles.css`+`management.css`, `.data-table`/`.toolbar`/`.pagination`/`.message-toast` from `management.css`, `.data-list`/`.badge` from `subpages.css`, `.alert` from `import-enhanced`, `.empty-state`/`.spinner` from `deleted-bookmarks-enhanced`. Re-point all values to `tokens.css`.
3. **PILOT — `bookmarks-manage.html`.** Swap to `tokens+base+components+admin`; drop `styles+workspace-refresh+management`. Any visual diff here = a `components.css` bug. **Lock `components.css` against this baseline.**
4. **`admin-settings.html`** (S) — second easy confirmation: forms + export buttons + toast.
5. **`categories.html`** (M) — fold `.management-modal*` into `.modal`; verify migrate-delete flow.
6. **`admin-dashboard.html`** (M) — retarget `admin.css` tokens; add shared empty/loading states.
7. **`token.html`** (M) — extract `token.css`, delete orphan `token-enhanced.css`, add `showToast` + `.btn-danger`.
8. **`notifications.html`** (M) — delete enhanced, slim `notifications.css`, route errors through toast.
9. **`deleted-bookmarks.html`** (L) — slim override, fix JS class drift + `.btn-sm`, replace bespoke `#restoreModal`.
10. **`link-checker.html`** (L) — delete `!important` war, rebuild `.bookmark-item` on `.data-list`, convert row buttons.
11. **`import.html`** (L, last/highest-risk) — extract wizard `import.css`, fix toast + result/preview drift.
12. **Cleanup pass.** Delete the 5 `*-enhanced.css` + `subpages.css` + `token-enhanced.css`; remove now-orphaned `.nav-site .*` admin overrides in `workspace-refresh.css`; `Grep public/` for any class in JS/HTML with no CSS home (catches future drift).

**Verification approach (per page, every step):**
- **Puppeteer screenshots:** the repo already has `puppeteer-core` and `scripts/audit-buttons.mjs` + `scripts/audit-loading-matrix.mjs`. Add a `scripts/screenshot-admin.mjs` that loads each of the 9 pages (authenticated) and writes before/after PNGs; diff visually. Reuse the existing harness pattern — no new tooling.
- **`npm test`** — runs `scripts/audit-loading-matrix.mjs` + `node --test tests/**/*.test.js` + `npm run lint` + `npm run format:check`. Run after each page.
- **`npm run lint`** — ESLint covers `public/js/**/*.js` (the JS class-rename edits). **Note:** CSS is *not* linted/formatted, so CSS correctness rests entirely on the screenshot diffs — do not skip them.
- **Cache-busting:** bump the `?v=` query (e.g. `?v=nav-20260603-admin-unify`) on **every** changed `link`/`script` tag. No bundler exists — this is the only cache-bust mechanism.
- **Rollback safety:** because steps 1-2 are additive and the pilot proves the contract, any later page that regresses can revert its single `<link>` swap without touching the shared layer.