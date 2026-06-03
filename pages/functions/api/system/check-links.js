import { authenticateRequest } from "../auth/verify.js";
import { insertDeletedBookmarksBatch } from "../../utils/deleted-bookmarks.js";
import { getKnownProtectedSiteResult } from "../../utils/link-checker-protection.js";
import {
  classifyHttpResponse,
  classifyNetworkError,
} from "../../utils/link-checker-status.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const PRESET_URLS = [
  "https://github.com",
  "https://stackoverflow.com",
  "https://developer.mozilla.org",
  "https://youtube.com",
  "https://twitter.com",
  "https://reddit.com",
  "https://amazon.com",
  "https://google.com",
];

async function requireAdminAccess(request, env) {
  const auth = await authenticateRequest(request, env);
  return auth.authenticated ? null : ResponseHelper.unauthorized(auth.error);
}

async function checkUrl(url, timeout = 15000) {
  const protectedSiteResult = getKnownProtectedSiteResult(url);
  if (protectedSiteResult) {
    return protectedSiteResult;
  }

  try {
    const response = await Promise.race([
      fetch(url, {
        method: "HEAD",
        headers: {
          "User-Agent": "BookmarkNavigator/1.0 Link Checker",
          Accept: "*/*",
          "Cache-Control": "no-cache",
        },
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), timeout);
      }),
    ]);
    const classification = classifyHttpResponse(response);

    return {
      url,
      ...classification,
      status: response.status,
      statusText: response.statusText,
      error: classification.accessible ? null : response.statusText,
      checkedAt: new Date().toISOString(),
    };
  } catch (headError) {
    try {
      const getResponse = await Promise.race([
        fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "BookmarkNavigator/1.0 Link Checker",
            Accept: "text/html,*/*",
            "Cache-Control": "no-cache",
          },
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("GET request timeout")), timeout);
        }),
      ]);
      const classification = classifyHttpResponse(getResponse);

      return {
        url,
        ...classification,
        status: getResponse.status,
        statusText: getResponse.statusText,
        error: classification.accessible ? null : getResponse.statusText,
        checkedAt: new Date().toISOString(),
      };
    } catch (getError) {
      const classification = classifyNetworkError(getError.message);
      return {
        url,
        ...classification,
        status: 0,
        statusText: "Network Error",
        error: headError.message.includes("timeout")
          ? "Request timeout"
          : getError.message,
        checkedAt: new Date().toISOString(),
      };
    }
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const { autoDelete = false, batchSize = 10 } = await request.json();
    const hasUserData = await env.BOOKMARKS_DB.prepare(
      "SELECT config_value FROM system_config WHERE config_key = ?",
    )
      .bind("has_user_data")
      .first();

    let bookmarksQuery =
      "SELECT id, title, url, category_id, created_at FROM bookmarks";
    const hasRealUserData = hasUserData?.config_value === "true";

    if (hasRealUserData) {
      const placeholders = PRESET_URLS.map(() => "?").join(",");
      bookmarksQuery += ` WHERE url NOT IN (${placeholders})`;
    }
    bookmarksQuery += " ORDER BY id";

    const bookmarks = hasRealUserData
      ? await env.BOOKMARKS_DB.prepare(bookmarksQuery)
          .bind(...PRESET_URLS)
          .all()
      : await env.BOOKMARKS_DB.prepare(bookmarksQuery).all();
    const bookmarkRows = bookmarks.results || [];

    if (!bookmarkRows.length) {
      return ResponseHelper.success(
        {
          total: 0,
          checked: 0,
          accessible: 0,
          inaccessible: 0,
          deleted: 0,
          results: [],
        },
        "No bookmarks need checking.",
      );
    }

    const results = [];
    const inaccessibleBookmarks = [];
    let checkedCount = 0;
    let accessibleCount = 0;
    let inaccessibleCount = 0;

    for (let i = 0; i < bookmarkRows.length; i += batchSize) {
      const batch = bookmarkRows.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((bookmark) =>
          checkUrl(bookmark.url).then((result) => ({
            ...result,
            bookmarkId: bookmark.id,
            title: bookmark.title,
            categoryId: bookmark.category_id,
            createdAt: bookmark.created_at,
          })),
        ),
      );

      results.push(...batchResults);
      batchResults.forEach((result) => {
        checkedCount++;
        if (result.accessible) {
          accessibleCount++;
        } else if (result.deleteCandidate) {
          inaccessibleCount++;
          inaccessibleBookmarks.push(result);
        }
      });

      if (i + batchSize < bookmarkRows.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const checkRecord = {
      checkedAt: new Date().toISOString(),
      total: bookmarkRows.length,
      accessible: accessibleCount,
      inaccessible: inaccessibleCount,
      autoDelete,
      results: JSON.stringify(results),
    };

    await env.BOOKMARKS_DB.prepare(
      `INSERT INTO system_config (config_key, config_value, description)
                VALUES (?, ?, ?)`,
    )
      .bind(
        `link_check_${Date.now()}`,
        JSON.stringify(checkRecord),
        `Link check record - ${new Date().toLocaleString()}`,
      )
      .run();

    let deletedCount = 0;
    const deletedBookmarks = [];

    if (autoDelete && inaccessibleBookmarks.length > 0) {
      const bookmarksToDelete = inaccessibleBookmarks.map((bookmark) => ({
        id: bookmark.bookmarkId,
        title: bookmark.title,
        url: bookmark.url,
        category_name: bookmark.category,
        description: bookmark.description,
        favicon_url: bookmark.favicon_url,
        created_at: bookmark.created_at,
        updated_at: bookmark.updated_at,
        keep_status: bookmark.keep_status,
      }));

      try {
        await insertDeletedBookmarksBatch(env, bookmarksToDelete, {
          deleteReason: "link_check_failed",
          checkStatus: "failed",
          deletedBy: "system",
        });
      } catch (error) {
        console.error("Failed to archive inaccessible bookmarks:", error);
      }

      for (const bookmark of inaccessibleBookmarks) {
        try {
          await env.BOOKMARKS_DB.prepare("DELETE FROM bookmarks WHERE id = ?")
            .bind(bookmark.bookmarkId)
            .run();
          deletedCount++;
          deletedBookmarks.push({
            id: bookmark.bookmarkId,
            title: bookmark.title,
            url: bookmark.url,
            reason: `${bookmark.status} ${bookmark.statusText}`,
            error: bookmark.error,
          });
        } catch (error) {
          console.error(
            `Failed to delete bookmark ${bookmark.bookmarkId}:`,
            error,
          );
        }
      }
    }

    return ResponseHelper.success(
      {
        total: bookmarkRows.length,
        checked: checkedCount,
        accessible: accessibleCount,
        inaccessible: inaccessibleCount,
        deleted: deletedCount,
        deletedBookmarks,
        inaccessibleBookmarks: autoDelete ? [] : inaccessibleBookmarks,
        checkTime: new Date().toISOString(),
      },
      `Check complete: ${accessibleCount} accessible, ${inaccessibleCount} inaccessible${autoDelete ? `, ${deletedCount} deleted` : ""}`,
    );
  } catch (error) {
    console.error("Link check failed:", error);
    return ResponseHelper.serverError("Link check failed.", error.message);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const records = await env.BOOKMARKS_DB.prepare(
      `SELECT config_key, config_value, description, created_at
                FROM system_config
                WHERE config_key LIKE 'link_check_%'
                ORDER BY created_at DESC
                LIMIT 20`,
    ).all();

    const history = (records.results || [])
      .map((record) => {
        try {
          const data = JSON.parse(record.config_value);
          return {
            id: record.config_key,
            ...data,
            createdAt: record.created_at,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return ResponseHelper.success(history);
  } catch (error) {
    console.error("Failed to load link check history:", error);
    return ResponseHelper.serverError(
      "Failed to load link check history.",
      error.message,
    );
  }
}
