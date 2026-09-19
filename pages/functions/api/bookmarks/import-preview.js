import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

function validateBookmark(bookmark, index) {
  const position = index + 1;

  if (!bookmark?.title || String(bookmark.title).trim() === "") {
    return `Bookmark ${position}: title is required`;
  }

  if (!bookmark?.url || String(bookmark.url).trim() === "") {
    return `Bookmark ${position}: URL is required`;
  }

  try {
    const url = new URL(String(bookmark.url).trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return `Bookmark ${position}: unsupported URL protocol ${url.protocol}`;
    }
  } catch {
    return `Bookmark ${position}: invalid URL ${bookmark.url}`;
  }

  return null;
}

async function findExistingUrls(env, urls) {
  const uniqueUrls = [...new Set(urls.map((url) => String(url).trim()))];
  const existing = new Set();
  const chunkSize = 500;

  for (let i = 0; i < uniqueUrls.length; i += chunkSize) {
    const chunk = uniqueUrls.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await env.BOOKMARKS_DB.prepare(
      `SELECT url FROM bookmarks WHERE url IN (${placeholders})`,
    )
      .bind(...chunk)
      .all();

    for (const row of result.results || []) {
      existing.add(row.url);
    }
  }

  return existing;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const { bookmarks } = await request.json();
    if (!Array.isArray(bookmarks)) {
      return ResponseHelper.validationError("bookmarks must be an array");
    }

    const invalid = [];
    const categoryNames = new Set();
    const validBookmarks = [];

    for (const [index, bookmark] of bookmarks.entries()) {
      const error = validateBookmark(bookmark, index);
      if (error) {
        invalid.push(error);
        continue;
      }
      validBookmarks.push(bookmark);
      const categoryName = bookmark.category_name || bookmark.category;
      if (categoryName) {
        categoryNames.add(String(categoryName).trim());
      }
    }

    const existingUrls = await findExistingUrls(
      env,
      validBookmarks.map((bookmark) => bookmark.url),
    );

    const duplicates = validBookmarks
      .filter((bookmark) => existingUrls.has(String(bookmark.url).trim()))
      .slice(0, 10)
      .map((bookmark) => ({
        title: bookmark.title,
        url: String(bookmark.url).trim(),
        category: bookmark.category_name || bookmark.category || "未分类",
      }));

    const expectedNew = validBookmarks.length - duplicates.length;

    return ResponseHelper.success({
      total: bookmarks.length,
      valid: validBookmarks.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      expectedNew,
      duplicateSamples: duplicates,
      invalidSamples: invalid.slice(0, 10),
      categoryCount: categoryNames.size,
      categories: [...categoryNames].slice(0, 50),
    });
  } catch (error) {
    console.error("Bookmark import preview failed:", error);
    return ResponseHelper.serverError(
      "Bookmark import preview failed",
      error.message,
    );
  }
}
