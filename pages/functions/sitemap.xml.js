// Sitemap.xml generation
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const result = await env.BOOKMARKS_DB.prepare(
      "SELECT id, url, updated_at FROM bookmarks WHERE keep_status = 'normal' OR keep_status IS NULL",
    ).all();

    const bookmarks = result.results || [];
    const base = new URL("https://shuqian.zhanghuijun.eu.cc");

    const urls = [
      { loc: base.origin, lastmod: new Date().toISOString().split("T")[0] },
    ];

    for (const bm of bookmarks) {
      urls.push({
        loc: `${base.origin}/b/${bm.id}`,
        lastmod: bm.updated_at
          ? bm.updated_at.split(" ")[0]
          : new Date().toISOString().split("T")[0],
      });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response('<?xml version="1.0"?><urlset></urlset>', {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  }
}
