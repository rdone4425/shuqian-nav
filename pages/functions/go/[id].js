/**
 * Click-through endpoint for the public navigation site.
 *
 * /go/:id records the click and redirects to the bookmark target with a 302.
 * Keeping clicks behind this route means the public site never links directly
 * to third-party URLs, every click is measurable, and link targets can be
 * normalized/validated in one place.
 */

function normalizeTarget(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function detectDevice(userAgent) {
  const value = String(userAgent || "").toLowerCase();

  if (/ipad|tablet|playbook|silk/.test(value)) {
    return "tablet";
  }

  if (/mobi|android|iphone|ipod/.test(value)) {
    return "mobile";
  }

  return "desktop";
}

async function recordClick(env, request, bookmarkId) {
  const userAgent = String(request.headers.get("User-Agent") || "").slice(
    0,
    300,
  );
  const referrer = String(request.headers.get("Referer") || "").slice(0, 500);
  const country = String(request.cf?.country || "")
    .trim()
    .slice(0, 2);
  const device = detectDevice(userAgent);

  try {
    await env.BOOKMARKS_DB.prepare(
      `UPDATE bookmarks
       SET click_count = COALESCE(click_count, 0) + 1,
           last_click_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(bookmarkId)
      .run();

    await env.BOOKMARKS_DB.prepare(
      `INSERT INTO nav_clicks (bookmark_id, referrer, user_agent, country, device)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(bookmarkId, referrer, userAgent, country, device)
      .run();
  } catch (error) {
    // Click tracking must never break the redirect (e.g. before migrations run).
    console.warn("Failed to record nav click:", error);
  }
}

export async function onRequestGet(context) {
  const { request, env, params, waitUntil } = context;
  const bookmarkId = Number(params.id);

  if (!Number.isInteger(bookmarkId) || bookmarkId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bookmark = await env.BOOKMARKS_DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ?",
    )
      .bind(bookmarkId)
      .first();

    if (!bookmark || bookmark.is_visible === 0) {
      return new Response("Not found", { status: 404 });
    }

    const target = normalizeTarget(bookmark.url);

    if (!target) {
      return new Response("Not found", { status: 404 });
    }

    const tracking = recordClick(env, request, bookmarkId);
    if (typeof waitUntil === "function") {
      waitUntil(tracking);
    } else {
      await tracking;
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: target,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("Go redirect failed:", error);
    return new Response("Not found", { status: 404 });
  }
}
