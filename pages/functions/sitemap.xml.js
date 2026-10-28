// Sitemap.xml generation for the public navigation site.
export async function onRequestGet(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;
  let lastmod = new Date().toISOString().split("T")[0];

  try {
    const row = await env.BOOKMARKS_DB.prepare(
      "SELECT MAX(updated_at) AS last_updated FROM bookmarks",
    ).first();

    if (row?.last_updated) {
      const candidate = String(row.last_updated).split(" ")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
        lastmod = candidate;
      }
    }
  } catch {
    // Keep today's date when the database is not ready yet.
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
  </url>
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
