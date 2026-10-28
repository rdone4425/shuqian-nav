/**
 * Server-rendered navigation homepage.
 *
 * The public site is a directory: categories, site cards and search. Rendering
 * it in the Pages Function (instead of fetching JSON in the browser) keeps the
 * first paint fast, makes the page indexable, and works without JavaScript.
 *
 * Data is read from D1 directly. If the new nav columns are not there yet, the
 * renderer falls back to the legacy query so the site keeps working before
 * migrations run.
 */

const NAV_CSS_VERSION = "nav-20261028-v2";
const NAV_JS_VERSION = "nav-20261028-v3";
// Bump when the rendered markup or nav.css changes so the edge cache is busted.
export const NAV_RENDER_VERSION = "2026-10-28.3";
const FEATURED_LIMIT = 8;
const CATEGORY_PALETTE = [
  "#2563eb",
  "#0f9f6e",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value, fallback = "#3B82F6") {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? value : fallback;
}

function safeSlug(value, fallback) {
  const slug = String(value || "").trim();
  return /^[a-z0-9-]{1,40}$/i.test(slug) ? slug : fallback;
}

function truncate(value, maxLength) {
  const chars = Array.from(String(value || "").trim());
  return chars.length > maxLength
    ? `${chars.slice(0, maxLength).join("")}…`
    : chars.join("");
}

function hostnameOf(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function firstLetter(value) {
  const text = String(value || "").trim();
  return text ? Array.from(text)[0].toUpperCase() : "?";
}

function normalizeBookmark(bookmark) {
  const url = String(bookmark.url || "").trim();
  return {
    id: Number(bookmark.id),
    title: String(bookmark.title || hostnameOf(url) || "未命名站点"),
    url,
    host: hostnameOf(url),
    description: String(bookmark.description || "").trim(),
    faviconUrl: /^https?:\/\//i.test(String(bookmark.favicon_url || ""))
      ? String(bookmark.favicon_url)
      : "",
    tags: String(bookmark.tags || "").trim(),
    categoryId:
      bookmark.category_id === null || bookmark.category_id === undefined
        ? null
        : Number(bookmark.category_id),
    categoryName: String(bookmark.category_name || "").trim(),
    categoryColor: bookmark.category_color || "",
    isPinned: Number(bookmark.is_pinned) === 1,
    isFeatured: Number(bookmark.is_featured) === 1,
    sortOrder: Number(bookmark.sort_order) || 0,
  };
}

function groupBookmarks(categories, bookmarks) {
  const groups = categories.map((category, index) => ({
    id: Number(category.id),
    name: String(category.name || "未命名分类"),
    color: categoryColor(category.color, index),
    slug: safeSlug(category.slug, `c-${category.id}`),
    items: [],
  }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  const uncategorized = {
    id: null,
    name: "未分类",
    color: "#6B7280",
    slug: "uncategorized",
    items: [],
  };

  for (const bookmark of bookmarks) {
    const group =
      (bookmark.categoryId !== null && byId.get(bookmark.categoryId)) ||
      uncategorized;
    group.items.push(bookmark);
  }

  return [...groups, uncategorized].filter((group) => group.items.length > 0);
}

function categoryColor(value, index) {
  const color = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(color) && color.toUpperCase() !== "#6B7280") {
    return color;
  }

  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

function searchableText(bookmark, group) {
  return [
    bookmark.title,
    bookmark.description,
    bookmark.host,
    bookmark.tags,
    group?.name || bookmark.categoryName,
  ]
    .join(" ")
    .toLowerCase();
}

function renderIcon(bookmark, color) {
  const letter = escapeHtml(firstLetter(bookmark.title || bookmark.host));
  const image = bookmark.faviconUrl
    ? `<img src="${escapeHtml(bookmark.faviconUrl)}" alt="" width="32" height="32" loading="lazy" decoding="async" onerror="this.remove()">`
    : "";

  return `<span class="nav-site-icon" style="--site-color:${safeColor(color)}"><span class="nav-site-icon-letter" aria-hidden="true">${letter}</span>${image}</span>`;
}

function renderCard(bookmark, group) {
  const title = escapeHtml(bookmark.title);
  const description = escapeHtml(
    truncate(bookmark.description || bookmark.host, 72),
  );
  const badge = bookmark.isPinned
    ? '<span class="nav-site-badge">置顶</span>'
    : "";
  const search = escapeHtml(searchableText(bookmark, group));
  const color = safeColor(group?.color || bookmark.categoryColor);

  return `<a class="nav-site" href="/go/${bookmark.id}" target="_blank" rel="noopener noreferrer" data-search="${search}" title="${title}">
        ${renderIcon(bookmark, color)}
        <span class="nav-site-body">
          <span class="nav-site-name">${title}${badge}</span>
          <span class="nav-site-desc">${description}</span>
        </span>
      </a>`;
}

function renderGroup(group) {
  const name = escapeHtml(group.name);
  const cards = group.items.map((bookmark) => renderCard(bookmark, group));
  const count = group.items.length;

  return `<section class="nav-group" id="cat-${escapeHtml(group.slug)}" data-nav-group data-nav-section data-nav-target="${escapeHtml(group.slug)}">
      <header class="nav-group-head">
        <h2><span class="nav-group-dot" style="--dot:${safeColor(group.color)}"></span>${name}</h2>
        <span class="nav-group-count">${count} 个站点</span>
      </header>
      <div class="nav-grid">
        ${cards.join("\n        ")}
      </div>
    </section>`;
}

function renderFeatured(bookmarks, groups) {
  if (!bookmarks.length) return "";
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return `<section class="nav-featured" id="nav-featured" aria-label="推荐站点" data-nav-group>
      <header class="nav-group-head">
        <h2><span class="nav-group-star" aria-hidden="true">★</span>推荐</h2>
        <span class="nav-group-count">${bookmarks.length} 个站点</span>
      </header>
      <div class="nav-grid nav-grid-featured">
        ${bookmarks
          .map((bookmark) =>
            renderCard(
              bookmark,
              groupById.get(bookmark.categoryId) || groups[0],
            ),
          )
          .join("\n        ")}
      </div>
    </section>`;
}

function renderChips(groups, total) {
  const chips = groups.map(
    (
      group,
    ) => `<a class="nav-chip" href="#cat-${escapeHtml(group.slug)}" data-nav-target="${escapeHtml(group.slug)}">
          <span class="nav-chip-dot" style="--dot:${safeColor(group.color)}"></span>
          <span>${escapeHtml(group.name)}</span>
          <span class="nav-chip-count">${group.items.length}</span>
        </a>`,
  );

  return `<nav class="nav-chips" aria-label="站点分类">
        <a class="nav-chip nav-chip-all is-active" href="#top" data-nav-target="all">全部<span class="nav-chip-count">${total}</span></a>
        ${chips.join("\n        ")}
      </nav>`;
}

function renderSidebar(groups, total) {
  const items = groups.map(
    (
      group,
    ) => `<a class="nav-side-item" href="#cat-${escapeHtml(group.slug)}" data-nav-target="${escapeHtml(group.slug)}">
          <span class="nav-side-dot" style="--dot:${safeColor(group.color)}"></span>
          <span class="nav-side-label">${escapeHtml(group.name)}</span>
          <span class="nav-side-count">${group.items.length}</span>
        </a>`,
  );

  return `<aside class="nav-sidebar" aria-label="分类导航">
      <div class="nav-sidebar-head">
        <p class="nav-sidebar-title">站点分类</p>
        <span class="nav-sidebar-total">${groups.length} 个分类</span>
      </div>
      <nav class="nav-sidebar-nav">
        <a class="nav-side-item is-active" href="#top" data-nav-target="all">
          <span class="nav-side-label">全部站点</span>
          <span class="nav-side-count">${total}</span>
        </a>
        ${items.join("\n        ")}
      </nav>
      <div class="nav-sidebar-foot">
        <a href="/api/bookmarks/feed?format=rss">RSS</a>
        <a href="/sitemap.xml">站点地图</a>
        <a href="/login.html">管理后台</a>
      </div>
    </aside>`;
}

function renderJsonLd({ title, description, origin }) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: title,
    description,
    url: `${origin}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

export async function getNavVersion(env) {
  const db = env?.BOOKMARKS_DB;

  if (typeof db?.prepare !== "function") {
    return "unavailable";
  }

  try {
    const row = await db
      .prepare(
        `SELECT
           (SELECT COALESCE(MAX(updated_at), '') FROM bookmarks) AS bookmarks_updated,
           (SELECT COALESCE(MAX(updated_at), '') FROM categories) AS categories_updated`,
      )
      .first();

    return `${row?.bookmarks_updated || ""}|${row?.categories_updated || ""}|${NAV_RENDER_VERSION}`;
  } catch {
    return "unavailable";
  }
}

async function loadNavData(env) {
  const db = env?.BOOKMARKS_DB;

  if (typeof db?.prepare !== "function") {
    return { categories: [], bookmarks: [], settings: new Map() };
  }

  try {
    const [categoryResult, bookmarkResult, settingResult] = await Promise.all([
      db
        .prepare(
          `SELECT id, name, color, description, slug, sort_order
           FROM categories
           WHERE COALESCE(is_visible, 1) = 1
           ORDER BY COALESCE(NULLIF(sort_order, 0), id), id`,
        )
        .all(),
      db
        .prepare(
          `SELECT
             b.id, b.title, b.url, b.description, b.favicon_url, b.tags,
             b.category_id, b.is_pinned, b.is_featured, b.sort_order, b.click_count,
             c.name AS category_name, c.color AS category_color, c.slug AS category_slug
           FROM bookmarks b
           LEFT JOIN categories c ON b.category_id = c.id
           WHERE COALESCE(b.is_visible, 1) = 1
             AND (b.category_id IS NULL OR c.id IS NULL OR COALESCE(c.is_visible, 1) = 1)
           ORDER BY COALESCE(b.is_pinned, 0) DESC, COALESCE(NULLIF(b.sort_order, 0), b.id), b.id`,
        )
        .all(),
      db
        .prepare(
          `SELECT config_key, config_value
           FROM system_config
           WHERE config_key IN ('site_title', 'site_description')`,
        )
        .all(),
    ]);

    return {
      categories: categoryResult.results || [],
      bookmarks: (bookmarkResult.results || []).map(normalizeBookmark),
      settings: new Map(
        (settingResult.results || []).map((row) => [
          row.config_key,
          row.config_value,
        ]),
      ),
    };
  } catch (error) {
    console.warn(
      "Nav page is falling back to the legacy schema query:",
      error?.message || error,
    );
    return loadLegacyNavData(env);
  }
}

async function loadLegacyNavData(env) {
  const db = env?.BOOKMARKS_DB;

  try {
    const [categoryResult, bookmarkResult] = await Promise.all([
      db
        .prepare(
          "SELECT id, name, color, description FROM categories ORDER BY name",
        )
        .all(),
      db
        .prepare(
          `SELECT
             b.id, b.title, b.url, b.description, b.favicon_url, b.tags,
             b.category_id,
             c.name AS category_name, c.color AS category_color
           FROM bookmarks b
           LEFT JOIN categories c ON b.category_id = c.id
           ORDER BY b.id`,
        )
        .all(),
    ]);

    return {
      categories: categoryResult.results || [],
      bookmarks: (bookmarkResult.results || []).map(normalizeBookmark),
      settings: new Map(),
    };
  } catch (error) {
    if (String(error?.message || "").includes("no such table")) {
      return { categories: [], bookmarks: [], settings: new Map() };
    }
    throw error;
  }
}

export async function renderNavPage({ env, origin }) {
  const { categories, bookmarks, settings } = await loadNavData(env);
  const title = String(settings.get("site_title") || "书签导航").trim();
  const description = String(
    settings.get("site_description") || "常用站点，一处直达",
  ).trim();
  const groups = groupBookmarks(categories, bookmarks);
  const featured = bookmarks
    .filter((bookmark) => bookmark.isFeatured)
    .slice(0, FEATURED_LIMIT);
  const total = bookmarks.length;
  const canonical = `${origin}/`;
  const year = new Date().getUTCFullYear();
  const hasSites = total > 0;

  return `<!doctype html>
<html lang="zh-CN" data-nav-page="home">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - ${escapeHtml(description)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#f4f6f3">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/css/nav.css?v=${NAV_CSS_VERSION}">
  <script type="application/ld+json">${renderJsonLd({ title, description, origin })}</script>
  <script>
    (function () {
      try {
        var saved = localStorage.getItem("nav-theme");
        var dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (dark) document.documentElement.dataset.theme = "dark";
      } catch (error) {}
    })();
  </script>
</head>
<body class="nav-page" id="top">
  <a class="nav-skip" href="#nav-directory">跳到站点列表</a>
  <header class="nav-header">
    <div class="nav-header-inner">
      <a class="nav-brand" href="/">
        <span class="nav-brand-mark" aria-hidden="true">N</span>
        <span class="nav-brand-copy">
          <h1 class="nav-brand-title">${escapeHtml(title)}</h1>
          <small>${escapeHtml(description)}</small>
        </span>
      </a>
      <label class="nav-search">
        <span class="visually-hidden">搜索站点</span>
        <input id="navSearch" type="search" placeholder="搜索站点、标签或网址" autocomplete="off" spellcheck="false">
        <kbd>/</kbd>
      </label>
      <div class="nav-header-meta">
        <span class="nav-stat" id="navResultCount" data-total="${total}" aria-live="polite">${total} 个站点</span>
        <button type="button" class="nav-theme" id="navThemeToggle" aria-label="切换深色模式" title="切换深色模式" aria-pressed="false">🌙</button>
      </div>
    </div>
  </header>

  <div class="nav-layout${hasSites ? "" : " nav-layout-empty"}">
    ${
      hasSites
        ? `${renderSidebar(groups, total)}
    <main class="nav-main" id="nav-directory" data-nav-target="all">
      <div class="nav-mobile-chips">
        ${renderChips(groups, total)}
      </div>
      ${renderFeatured(featured, groups)}
      <div class="nav-sections">
        ${groups.map((group) => renderGroup(group)).join("\n        ")}
      </div>
      <p class="nav-empty" id="navEmpty" hidden>没有找到匹配的站点，换个关键词试试。</p>
    </main>`
        : `<main class="nav-main nav-main-empty" id="nav-directory">
      <section class="nav-empty-state">
        <h2>还没有收录站点</h2>
        <p>登录后台添加第一批站点，首页会自动按分类展示。</p>
        <a class="nav-empty-link" href="/login.html">进入后台</a>
      </section>
    </main>`
    }
  </div>

  <footer class="nav-footer">
    <div class="nav-footer-inner">
      <div class="nav-footer-brand">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="nav-footer-links">
        <a href="/api/bookmarks/feed?format=rss">RSS 订阅</a>
        <a href="/sitemap.xml">站点地图</a>
        <a href="/login.html">管理后台</a>
      </div>
      <p class="nav-copyright">© ${year} ${escapeHtml(title)} · 收录 ${total} 个站点</p>
    </div>
  </footer>

  <button type="button" class="nav-top" id="navTop" aria-label="回到顶部" title="回到顶部">↑</button>
  <script src="/js/nav/nav.js?v=${NAV_JS_VERSION}" defer></script>
</body>
</html>`;
}
