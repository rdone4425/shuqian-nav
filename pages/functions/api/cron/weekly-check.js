import { authenticateRequest } from "../auth/verify.js";
import { getKnownProtectedSiteResult } from "../../utils/link-checker-protection.js";
import { ResponseHelper } from "../../utils/response-helper.js";

async function requireAdminAccess(request, env) {
  const auth = await authenticateRequest(request, env);
  return auth.authenticated ? null : ResponseHelper.unauthorized(auth.error);
}

async function checkUrl(url, timeout = 10000) {
  const protectedSiteResult = getKnownProtectedSiteResult(
    url,
    "PROTECTED_SITE_WEEKLY",
  );
  if (protectedSiteResult) {
    return protectedSiteResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "BookmarkNavigator/1.0 Weekly Checker",
      },
    });

    clearTimeout(timeoutId);

    return {
      url,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      error: null,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      url,
      accessible: false,
      status: 0,
      statusText: "Network Error",
      error: error.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function sendNotification(env, inaccessibleBookmarks) {
  try {
    const notification = {
      type: "weekly_check_notification",
      timestamp: new Date().toISOString(),
      deletedCount: 0,
      inaccessibleCount: inaccessibleBookmarks.length,
      message: "Inaccessible links found. Please review them manually.",
      inaccessibleBookmarks: inaccessibleBookmarks.slice(0, 10),
    };

    await env.BOOKMARKS_DB.prepare(
      `INSERT INTO system_config (config_key, config_value, description)
                VALUES (?, ?, ?)`,
    )
      .bind(
        `weekly_notification_${Date.now()}`,
        JSON.stringify(notification),
        `Weekly check notification - ${new Date().toLocaleString()}`,
      )
      .run();
  } catch (error) {
    console.error("Failed to record weekly notification:", error);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = env.CRON_SECRET || "default-cron-secret";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return ResponseHelper.unauthorized("Unauthorized cron request.");
    }

    const bookmarks = await env.BOOKMARKS_DB.prepare(
      "SELECT id, title, url, category_id, created_at FROM bookmarks ORDER BY id",
    ).all();
    const bookmarkRows = bookmarks.results || [];

    if (!bookmarkRows.length) {
      return ResponseHelper.success(
        {
          total: 0,
          checked: 0,
          accessible: 0,
          inaccessible: 0,
          inaccessibleBookmarks: [],
        },
        "No bookmarks need checking.",
      );
    }

    const results = [];
    const inaccessibleBookmarks = [];
    let checkedCount = 0;
    let accessibleCount = 0;
    let inaccessibleCount = 0;
    const batchSize = 5;

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
        } else {
          inaccessibleCount++;
          inaccessibleBookmarks.push(result);
        }
      });

      if (i + batchSize < bookmarkRows.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const checkRecord = {
      type: "weekly_auto_check",
      checkedAt: new Date().toISOString(),
      total: bookmarkRows.length,
      accessible: accessibleCount,
      inaccessible: inaccessibleCount,
      autoDelete: false,
      results: JSON.stringify(results.slice(0, 50)),
    };

    await env.BOOKMARKS_DB.prepare(
      `INSERT INTO system_config (config_key, config_value, description)
                VALUES (?, ?, ?)`,
    )
      .bind(
        `weekly_check_${Date.now()}`,
        JSON.stringify(checkRecord),
        `Weekly auto check - ${new Date().toLocaleString()}`,
      )
      .run();

    if (inaccessibleCount > 0) {
      await sendNotification(env, inaccessibleBookmarks);
    }

    return ResponseHelper.success(
      {
        total: bookmarkRows.length,
        checked: checkedCount,
        accessible: accessibleCount,
        inaccessible: inaccessibleCount,
        inaccessibleBookmarks: inaccessibleBookmarks.slice(0, 10),
        checkTime: new Date().toISOString(),
      },
      `Weekly check complete: ${accessibleCount} accessible, ${inaccessibleCount} inaccessible.`,
    );
  } catch (error) {
    console.error("Weekly link check failed:", error);
    return ResponseHelper.serverError(
      "Weekly link check failed.",
      error.message,
    );
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const notifications = await env.BOOKMARKS_DB.prepare(
      `SELECT config_key, config_value, description, created_at
                FROM system_config
                WHERE config_key LIKE 'weekly_notification_%'
                   OR config_key LIKE 'weekly_check_%'
                ORDER BY created_at DESC
                LIMIT 10`,
    ).all();

    const history = (notifications.results || [])
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
    console.error("Failed to load weekly check notifications:", error);
    return ResponseHelper.serverError(
      "Failed to load weekly check notifications.",
      error.message,
    );
  }
}
