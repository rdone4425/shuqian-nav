import { verifyApiToken } from "../auth/token.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const ROOT_CATEGORY_NAMES = new Set([
  "",
  "Bookmarks Bar",
  "Bookmarks Menu",
  "Other Bookmarks",
  "Mobile Bookmarks",
  "\u4e66\u7b7e\u680f",
  "\u5176\u4ed6\u4e66\u7b7e",
  "\u79fb\u52a8\u8bbe\u5907\u4e66\u7b7e",
]);

async function authenticateApiRequest(request, env) {
  const apiToken = request.headers.get("X-API-Token");

  if (!apiToken) {
    return { authenticated: false, error: "Missing API access token." };
  }

  const verification = await verifyApiToken(apiToken, env);

  if (!verification.valid) {
    return { authenticated: false, error: "Invalid API access token." };
  }

  return { authenticated: true, payload: verification.payload };
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Token",
    "Access-Control-Max-Age": "86400",
  };
}

function withExtensionCors(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders())) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsSuccess(data = null, message = null, status = 200) {
  return withExtensionCors(ResponseHelper.success(data, message, status));
}

function corsError(error, status = 500, details = null) {
  return withExtensionCors(ResponseHelper.error(error, status, details));
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateApiRequest(request, env);
    if (!auth.authenticated) {
      return corsError(auth.error, 401);
    }

    const url = new URL(request.url);
    const page = Math.max(parseInt(url.searchParams.get("page"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit"), 10) || 100, 1),
      500,
    );
    const offset = (page - 1) * limit;

    const result = await env.BOOKMARKS_DB.prepare(
      `
      SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.category_id,
        b.favicon_url,
        b.created_at,
        b.updated_at,
        c.name as category_name
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.id ASC
      LIMIT ? OFFSET ?
    `,
    )
      .bind(limit, offset)
      .all();

    const bookmarks = result.results || [];

    return corsSuccess({
      bookmarks,
      pagination: {
        page,
        limit,
        count: bookmarks.length,
        hasNext: bookmarks.length === limit,
      },
    });
  } catch (error) {
    console.error("Failed to read sync bookmarks:", error);
    return corsError("Failed to read sync bookmarks.", 500, error.message);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateApiRequest(request, env);
    if (!auth.authenticated) {
      return corsError(auth.error, 401);
    }

    const { bookmarks } = await request.json();

    if (!Array.isArray(bookmarks)) {
      return withExtensionCors(
        ResponseHelper.validationError(
          "bookmarks must be an array",
          "Invalid bookmark data format.",
        ),
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const defaultCategoryId = await getOrCreateDefaultCategory(env);

    for (const bookmark of bookmarks) {
      try {
        if (!bookmark.title || !bookmark.url) {
          errorCount++;
          errors.push(
            `Bookmark missing required fields: ${bookmark.title || bookmark.url}`,
          );
          continue;
        }

        const existing = await env.BOOKMARKS_DB.prepare(
          "SELECT id FROM bookmarks WHERE url = ?",
        )
          .bind(bookmark.url)
          .first();

        if (existing) {
          continue;
        }

        const categoryId = await getOrCreateSyncCategory(
          env,
          bookmark,
          defaultCategoryId,
        );

        await env.BOOKMARKS_DB.prepare(
          `INSERT INTO bookmarks (title, url, description, category_id, favicon_url)
                    VALUES (?, ?, ?, ?, ?)`,
        )
          .bind(
            bookmark.title,
            bookmark.url,
            bookmark.description || "",
            categoryId,
            generateFaviconUrl(bookmark.url),
          )
          .run();

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(
          `Failed to process bookmark "${bookmark.title}": ${error.message}`,
        );
        console.error("Failed to insert synced bookmark:", error);
      }
    }

    return corsSuccess(
      {
        total: bookmarks.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10),
      },
      `Sync completed: ${successCount} succeeded, ${errorCount} failed.`,
    );
  } catch (error) {
    console.error("Bookmark sync failed:", error);
    return corsError("Bookmark sync failed.", 500, error.message);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

async function getOrCreateDefaultCategory(env) {
  try {
    const category = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM categories WHERE name = ?",
    )
      .bind("Chrome同步")
      .first();

    if (!category) {
      const result = await env.BOOKMARKS_DB.prepare(
        "INSERT INTO categories (name, color, description) VALUES (?, ?, ?)",
      )
        .bind("Chrome同步", "#4285F4", "Chrome浏览器同步的书签")
        .run();

      return result.meta.last_row_id;
    }

    return category.id;
  } catch (error) {
    console.error("Failed to get default sync category:", error);
    return 1;
  }
}

function normalizeCategoryName(categoryName) {
  return String(categoryName || "").trim();
}

function normalizeCategoryPath(bookmark) {
  let path = [];

  if (Array.isArray(bookmark.category_path)) {
    path = bookmark.category_path;
  } else if (Array.isArray(bookmark.categoryPath)) {
    path = bookmark.categoryPath;
  } else if (typeof bookmark.category_path === "string") {
    path = bookmark.category_path.split("/");
  } else if (bookmark.category) {
    path = [bookmark.category];
  }

  const normalized = path
    .map((name) => normalizeCategoryName(name))
    .filter(Boolean);

  while (normalized.length > 0 && ROOT_CATEGORY_NAMES.has(normalized[0])) {
    normalized.shift();
  }

  return normalized;
}

function getSyncCategoryParts(bookmark) {
  const path = normalizeCategoryPath(bookmark);
  if (path.length === 0) {
    return { name: null, parentName: null };
  }

  const name = path[path.length - 1];
  const parentName = path.length > 1 ? path[path.length - 2] : null;

  if (!parentName || parentName === name) {
    return { name, parentName: null };
  }

  return { name, parentName };
}

function isMissingCategoryHierarchy(error) {
  const message = String(error?.message || "");
  return (
    message.includes("no such table") && message.includes("category_hierarchy")
  );
}

async function getOrCreateCategory(env, categoryName, parentName = null) {
  const normalizedName = normalizeCategoryName(categoryName);
  if (!normalizedName || ROOT_CATEGORY_NAMES.has(normalizedName)) {
    return await getOrCreateDefaultCategory(env);
  }

  try {
    const category = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM categories WHERE name = ?",
    )
      .bind(normalizedName)
      .first();

    let categoryId = category?.id;

    if (!category) {
      const result = await env.BOOKMARKS_DB.prepare(
        "INSERT INTO categories (name, color, description) VALUES (?, ?, ?)",
      )
        .bind(normalizedName, "#6B7280", `从Chrome同步: ${normalizedName}`)
        .run();

      categoryId = result.meta.last_row_id;
    }

    const normalizedParentName = normalizeCategoryName(parentName);
    if (
      normalizedParentName &&
      normalizedParentName !== normalizedName &&
      !ROOT_CATEGORY_NAMES.has(normalizedParentName)
    ) {
      try {
        const parentId = await getOrCreateCategory(env, normalizedParentName);
        await env.BOOKMARKS_DB.prepare(
          "INSERT OR IGNORE INTO category_hierarchy (category_id, parent_id) VALUES (?, ?)",
        )
          .bind(categoryId, parentId)
          .run();
      } catch (error) {
        if (!isMissingCategoryHierarchy(error)) {
          throw error;
        }
      }
    }

    return categoryId;
  } catch (error) {
    console.error("Failed to get sync category:", error);
    return await getOrCreateDefaultCategory(env);
  }
}

async function getOrCreateSyncCategory(env, bookmark, defaultCategoryId) {
  const { name, parentName } = getSyncCategoryParts(bookmark);
  if (!name) {
    return defaultCategoryId;
  }

  return await getOrCreateCategory(env, name, parentName);
}

function generateFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch {
    return "https://www.google.com/s2/favicons?domain=example.com&sz=128";
  }
}
