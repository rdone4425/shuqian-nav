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

    const esc = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;");
    const title = esc(bookmark.title);
    const url = esc(bookmark.url);
    const desc = esc(bookmark.description);
    const tags = bookmark.tags
      ? bookmark.tags
          .split(",")
          .filter((t) => t.trim())
          .map((t) => t.trim())
          .join(" \u00b7 ")
      : "";
    const catName = esc(bookmark.category_name);
    const catColor = bookmark.category_color || "#3B82F6";

    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} - \u4e66\u7b7e\u5bfc\u822a</title>
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
    .share-card .share-actions a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; }
    .share-card .share-open { background: var(--accent); color: #fff; }
    .share-card .share-copy { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-default); }
    .share-card .share-home { color: var(--text-muted); font-size: 12px; margin-top: 24px; display: block; }
  </style>
</head>
<body class="nav-site">
  <div class="share-page">
    <div class="share-card">
      <div class="share-favicon">${bookmark.title ? esc(bookmark.title[0].toUpperCase()) : "?"}</div>
      <h1>${title}</h1>
      <div class="share-url">${url}</div>
      ${bookmark.description ? `<div class="share-desc">${desc}</div>` : ""}
      ${tags ? `<div class="share-tags">${tags}</div>` : ""}
      ${catName ? `<span class="share-cat" style="background: ${catColor}25; color: ${catColor};">${catName}</span>` : ""}
      <div class="share-actions">
        <a href="${bookmark.url}" target="_blank" rel="noopener" class="share-open">\u6253\u5f00\u94fe\u63a5</a>
        <a href="javascript:void(0)" onclick="navigator.clipboard.writeText(window.location.href);this.textContent='\u2713 \u5df2\u590d\u5236'" class="share-copy">\u590d\u5236\u5206\u4eab</a>
      </div>
      <a href="/" class="share-home">\u8fd4\u56de\u4e66\u7b7e\u5bfc\u822a\u9996\u9875</a>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
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
