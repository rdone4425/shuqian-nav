// robots.txt for the public navigation site.
export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /go/
Disallow: /b/
Disallow: /login.html

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
