// Single bookmark share page: /b/:id
export async function onRequestGet(context) {
  const { env } = context;
  const id = context.params.id;

  if (!id || !/^\d+$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bookmark = await env.BOOKMARKS_DB.prepare(
      `
      SELECT b.id, b.title, b.url, b.description, b.tags,
             c.name as category_name, c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `,
    )
      .bind(id)
      .first();

    if (!bookmark) {
      return new Response("Bookmark not found", { status: 404 });
    }

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));
    const safeUrl = isHttpUrl(bookmark.url) ? String(bookmark.url) : "";
    const title = escapeHtml(bookmark.title);
    const desc = escapeHtml(bookmark.description);
    const tags = bookmark.tags
      ? bookmark.tags
          .split(",")
          .filter((t) => t.trim())
          .map((t) => escapeHtml(t.trim()))
          .join(" · ")
      : "";
    const catName = escapeHtml(bookmark.category_name);
    const catColor = /^#[0-9a-f]{3,8}$/i.test(bookmark.category_color || "")
      ? bookmark.category_color
      : "#3B82F6";

    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="robots" content="noindex"/>
  <title>${title} - 书签导航</title>
  <link rel="stylesheet" href="/css/styles.css"/>
  <link rel="stylesheet" href="/css/workspace-refresh.css"/>
  <style>
    .share-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-canvas); padding: 40px 20px; }
    .share-card { max-width: 480px; width: 100%; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: 12px; padding: 32px; text-align: center; }
    .share-card h1 { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 12px 0 8px; word-break: break-all; }
    .share-card .share-url { font-size: 14px; color: var(--accent); word-break: break-all; margin-bottom: 8px; }
    .share-card .share-desc { font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; }
    .share-card .share-tags { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }
    .share-card .share-cat { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-bottom: 20px; }
    .share-card .share-favicon { font-size: 48px; margin-bottom: 8px; }
    .share-card .share-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .share-card .share-actions a, .share-card .share-actions button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; font-family: inherit; cursor: pointer; }
    .share-card .share-open { background: var(--accent); color: #fff; }
    .share-card .share-copy { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-default); }
    .share-card .share-home { color: var(--text-muted); font-size: 12px; margin-top: 24px; display: block; }
  </style>
</head>
<body class="nav-site">
  <div class="share-page">
    <div class="share-card">
      <div class="share-favicon">${bookmark.title ? escapeHtml(bookmark.title[0].toUpperCase()) : "?"}</div>
      <h1>${title}</h1>
      <div class="share-url">${escapeHtml(bookmark.url)}</div>
      ${bookmark.description ? `<div class="share-desc">${desc}</div>` : ""}
      ${tags ? `<div class="share-tags">${tags}</div>` : ""}
      ${catName ? `<span class="share-cat" style="background: ${catColor}25; color: ${catColor};">${catName}</span>` : ""}
      <div class="share-actions">
        ${
          safeUrl
            ? `<a href="/go/${bookmark.id}" target="_blank" rel="noopener noreferrer" class="share-open">打开链接</a>`
            : `<span class="share-open" aria-disabled="true">链接无效</span>`
        }
        <button type="button" class="share-copy" onclick="navigator.clipboard.writeText(window.location.href);this.textContent='✓ 已复制'">复制分享</button>
      </div>
      <a href="/" class="share-home">返回书签导航首页</a>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "\u83b7\u53d6\u4e66\u7b7e\u5931\u8d25",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
