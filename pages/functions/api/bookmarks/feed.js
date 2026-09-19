import { ResponseHelper } from "../../utils/response-helper.js";

function rssEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const category = url.searchParams.get("category")?.trim() || "";
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit")) || 100, 1),
      500,
    );

    let query = `
      SELECT b.id, b.title, b.url, b.description, b.created_at, b.updated_at,
             c.name AS category
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
    `;
    const params = [];

    if (category) {
      query += " WHERE c.name = ?";
      params.push(category);
    }

    query += " ORDER BY b.updated_at DESC, b.id DESC LIMIT ?";
    params.push(limit);

    const result = await env.BOOKMARKS_DB.prepare(query)
      .bind(...params)
      .all();
    const bookmarks = result.results || [];

    if (format === "rss") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bookmark Navigator</title>
    <link>${rssEscape(new URL(request.url).origin)}</link>
    <description>Bookmark feed</description>
    ${bookmarks
      .map(
        (bookmark) => `
    <item>
      <title>${rssEscape(bookmark.title || bookmark.url)}</title>
      <link>${rssEscape(bookmark.url)}</link>
      <description>${rssEscape(bookmark.description || "")}</description>
      <category>${rssEscape(bookmark.category || "未分类")}</category>
      <pubDate>${new Date(bookmark.updated_at || bookmark.created_at || Date.now()).toUTCString()}</pubDate>
    </item>`,
      )
      .join("")}
  </channel>
</rss>`;

      return new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return ResponseHelper.success({
      category: category || null,
      total: bookmarks.length,
      generatedAt: new Date().toISOString(),
      bookmarks,
    });
  } catch (error) {
    console.error("Failed to generate bookmark feed:", error);
    return ResponseHelper.serverError("生成书签 Feed 失败", error.message);
  }
}
