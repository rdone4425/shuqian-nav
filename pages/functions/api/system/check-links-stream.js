import { authenticateRequest } from "../auth/verify.js";
import { insertDeletedBookmarkSafe } from "../../utils/deleted-bookmarks.js";
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

async function checkUrl(url) {
  const protectedSiteResult = getKnownProtectedSiteResult(url);
  if (protectedSiteResult) {
    return protectedSiteResult;
  }

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  ];
  const randomUserAgent =
    userAgents[Math.floor(Math.random() * userAgents.length)];
  const commonHeaders = {
    "User-Agent": randomUserAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
  };

  try {
    const headResponse = await Promise.race([
      fetch(url, { method: "HEAD", headers: commonHeaders }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("HEAD request timeout")), 3000);
      }),
    ]);

    if (headResponse.ok) {
      return {
        url,
        accessible: true,
        deleteCandidate: false,
        reviewRequired: false,
        resultType: "accessible",
        status: headResponse.status,
        statusText: headResponse.statusText,
        error: null,
        method: "HEAD",
        checkedAt: new Date().toISOString(),
      };
    }
  } catch (headError) {
    console.log("HEAD request failed; trying GET:", url, headError.message);
  }

  try {
    const getResponse = await Promise.race([
      fetch(url, { method: "GET", headers: commonHeaders }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("GET request timeout")), 5000);
      }),
    ]);
    const classification = classifyHttpResponse(getResponse);

    return {
      url,
      ...classification,
      status: getResponse.status,
      statusText: getResponse.statusText,
      error: classification.accessible ? null : getErrorMessage(getResponse),
      method: "GET",
      checkedAt: new Date().toISOString(),
    };
  } catch (getError) {
    const classification = classifyNetworkError(getError.message);
    return {
      url,
      ...classification,
      status: 0,
      statusText: "Network Error",
      error: categorizeError(getError.message),
      method: "FAILED",
      checkedAt: new Date().toISOString(),
    };
  }
}

function getErrorMessage(response) {
  const server = response.headers.get("server") || "";
  const cfRay = response.headers.get("cf-ray");

  switch (response.status) {
    case 403:
      if (server.toLowerCase().includes("cloudflare") || cfRay) {
        return "Cloudflare protection detected; review manually.";
      }
      return "Access forbidden.";
    case 404:
      return "Page not found.";
    case 410:
      return "Page permanently removed.";
    case 429:
      return "Too many requests.";
    case 500:
      return "Internal server error.";
    case 502:
      return "Bad gateway.";
    case 503:
      if (server.toLowerCase().includes("cloudflare") || cfRay) {
        return "Cloudflare protection or temporary maintenance detected; review manually.";
      }
      return "Service unavailable.";
    case 504:
      return "Gateway timeout.";
    default:
      return `HTTP ${response.status} ${response.statusText}`;
  }
}

function categorizeError(errorMessage) {
  const message = errorMessage.toLowerCase();

  if (message.includes("timeout")) return "Request timed out.";
  if (message.includes("enotfound") || message.includes("name not resolved")) {
    return "Domain does not exist.";
  }
  if (message.includes("econnrefused")) return "Connection refused.";
  if (message.includes("cert") || message.includes("certificate")) {
    return "SSL certificate problem.";
  }
  if (message.includes("network")) return "Network connection problem.";

  return `Network error: ${errorMessage}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const hasUserData = await env.BOOKMARKS_DB.prepare(
      "SELECT config_value FROM system_config WHERE config_key = ?",
    )
      .bind("has_user_data")
      .first();

    let bookmarksQuery = `
      SELECT b.id, b.title, b.url, COALESCE(b.keep_status, 'normal') as keep_status,
             b.created_at, c.name as category_name, c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
    `;

    const hasRealUserData = hasUserData?.config_value === "true";
    if (hasRealUserData) {
      const placeholders = PRESET_URLS.map(() => "?").join(",");
      bookmarksQuery += ` WHERE b.url NOT IN (${placeholders})`;
    }

    bookmarksQuery += " ORDER BY b.id DESC";
    const bookmarks = hasRealUserData
      ? await env.BOOKMARKS_DB.prepare(bookmarksQuery)
          .bind(...PRESET_URLS)
          .all()
      : await env.BOOKMARKS_DB.prepare(bookmarksQuery).all();

    return ResponseHelper.success(
      (bookmarks.results || []).map((bookmark) => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        category: bookmark.category_name || "未分类",
        categoryColor: bookmark.category_color || "#6B7280",
        keepStatus: bookmark.keep_status || "normal",
        createdAt: bookmark.created_at,
        status: "pending",
        checked: false,
      })),
    );
  } catch (error) {
    console.error("Failed to load bookmarks for link checking:", error);
    return ResponseHelper.serverError(
      "Failed to load bookmarks for link checking.",
      error.message,
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const { bookmarkId, url, autoDelete = false } = await request.json();
    if (!bookmarkId || !url) {
      return ResponseHelper.validationError("Missing required parameters.");
    }

    const result = await checkUrl(url);
    let deleted = false;
    let deleteError = null;

    if (autoDelete && result.deleteCandidate) {
      try {
        const bookmark = await env.BOOKMARKS_DB.prepare(
          `
          SELECT b.*, c.name as category_name
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE b.id = ?
        `,
        )
          .bind(bookmarkId)
          .first();

        if (bookmark) {
          await insertDeletedBookmarkSafe(env, bookmark, {
            deleteReason: "link_check_failed",
            checkStatus: "failed",
            statusCode: result.status,
            statusText: result.statusText,
            errorMessage: result.error,
            deletedBy: "system",
          });

          await env.BOOKMARKS_DB.prepare("DELETE FROM bookmarks WHERE id = ?")
            .bind(bookmarkId)
            .run();
          deleted = true;
        }
      } catch (error) {
        deleteError = error.message;
        console.error(`Failed to delete bookmark ${bookmarkId}:`, error);
      }
    }

    return ResponseHelper.success({
      bookmarkId,
      ...result,
      deleted,
      deleteError,
    });
  } catch (error) {
    console.error("Failed to check link:", error);
    return ResponseHelper.serverError("Failed to check link.", error.message);
  }
}
