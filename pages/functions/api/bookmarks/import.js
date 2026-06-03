import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const CLEAR_EXISTING_CONFIRMATION = "CONFIRM_REPLACE_BOOKMARKS";
const UNASSIGNED_CATEGORY_NAMES = new Set([
  "",
  "Uncategorized",
  "\u672a\u5206\u7c7b",
]);
const CATEGORY_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
];

function normalizeCategoryName(categoryName) {
  return String(categoryName || "").trim();
}

function isUnassignedCategory(categoryName) {
  return UNASSIGNED_CATEGORY_NAMES.has(normalizeCategoryName(categoryName));
}

function buildFaviconUrl(bookmarkUrl, fallbackUrl = null) {
  if (fallbackUrl) return fallbackUrl;
  const domain = new URL(bookmarkUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function validateBookmark(bookmark, index) {
  const position = index + 1;

  if (
    !bookmark.title ||
    typeof bookmark.title !== "string" ||
    bookmark.title.trim() === ""
  ) {
    return `Bookmark ${position}: title is required`;
  }

  if (
    !bookmark.url ||
    typeof bookmark.url !== "string" ||
    bookmark.url.trim() === ""
  ) {
    return `Bookmark ${position}: URL is required`;
  }

  try {
    const url = new URL(bookmark.url.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return `Bookmark ${position}: unsupported URL protocol ${url.protocol}`;
    }
  } catch {
    return `Bookmark ${position}: invalid URL ${bookmark.url}`;
  }

  if (bookmark.title.length > 200) {
    return `Bookmark ${position}: title is too long`;
  }

  if (bookmark.description && bookmark.description.length > 500) {
    return `Bookmark ${position}: description is too long`;
  }

  return null;
}

async function getOrCreateCategory(env, categoryName) {
  const normalizedName = normalizeCategoryName(categoryName);
  if (isUnassignedCategory(normalizedName)) {
    return null;
  }

  const existing = await env.BOOKMARKS_DB.prepare(
    "SELECT id FROM categories WHERE name = ?",
  )
    .bind(normalizedName)
    .first();

  if (existing) {
    return existing.id;
  }

  const color =
    CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
  const result = await env.BOOKMARKS_DB.prepare(
    "INSERT INTO categories (name, color, description) VALUES (?, ?, ?)",
  )
    .bind(normalizedName, color, `Imported category: ${normalizedName}`)
    .run();

  return result.meta.last_row_id;
}

async function clearExistingBookmarks(env) {
  await env.BOOKMARKS_DB.prepare("DELETE FROM bookmarks").run();
  await env.BOOKMARKS_DB.prepare("DELETE FROM categories WHERE id > 6").run();
}

async function markSystemHasUserData(env) {
  await env.BOOKMARKS_DB.prepare(
    `
      INSERT OR REPLACE INTO system_config (config_key, config_value, description)
      VALUES (?, ?, ?)
    `,
  )
    .bind("has_user_data", "true", "System contains imported user data")
    .run();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const {
      bookmarks,
      categories,
      clearExisting = false,
      clearExistingConfirmation = "",
    } = await request.json();

    if (!Array.isArray(bookmarks)) {
      return ResponseHelper.error("Bookmarks must be an array", 400);
    }

    if (bookmarks.length === 0) {
      return ResponseHelper.error("No bookmarks to import", 400);
    }

    if (
      clearExisting &&
      clearExistingConfirmation !== CLEAR_EXISTING_CONFIRMATION
    ) {
      return ResponseHelper.error(
        "Replace import requires explicit confirmation",
        400,
      );
    }

    if (clearExisting) {
      await clearExistingBookmarks(env);
    }

    const categoryMapping = {};
    if (Array.isArray(categories)) {
      for (const category of categories) {
        try {
          if (category?.name && !isUnassignedCategory(category.name)) {
            categoryMapping[category.name] = await getOrCreateCategory(
              env,
              category.name,
            );
          }
        } catch (error) {
          console.error(`Failed to create category ${category?.name}:`, error);
        }
      }
    }

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [index, bookmark] of bookmarks.entries()) {
      try {
        const validationError = validateBookmark(bookmark, index);
        if (validationError) {
          errorCount++;
          errors.push(validationError);
          continue;
        }

        const bookmarkUrl = bookmark.url.trim();
        const bookmarkTitle = bookmark.title.trim();

        if (!clearExisting) {
          const existing = await env.BOOKMARKS_DB.prepare(
            "SELECT id FROM bookmarks WHERE url = ?",
          )
            .bind(bookmarkUrl)
            .first();

          if (existing) {
            skippedCount++;
            continue;
          }
        }

        let categoryId = null;
        const categoryName = bookmark.category_name || bookmark.category;
        if (categoryName) {
          categoryId =
            categoryMapping[categoryName] ||
            (await getOrCreateCategory(env, categoryName));
        }

        const result = await env.BOOKMARKS_DB.prepare(
          `
          INSERT INTO bookmarks (title, url, description, category_id, favicon_url, keep_status)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        )
          .bind(
            bookmarkTitle,
            bookmarkUrl,
            bookmark.description || null,
            categoryId,
            buildFaviconUrl(bookmarkUrl, bookmark.favicon_url),
            bookmark.keep_status || "normal",
          )
          .run();

        if (result.success) {
          importedCount++;
        } else {
          errorCount++;
          errors.push(`Failed to insert bookmark: ${bookmarkTitle}`);
        }
      } catch (error) {
        errorCount++;
        errors.push(
          `Failed to process bookmark ${bookmark.title || bookmark.url}: ${error.message}`,
        );
        console.error("Failed to import bookmark:", error);
      }
    }

    await markSystemHasUserData(env);

    return ResponseHelper.success(
      {
        imported: importedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: bookmarks.length,
        errorDetails: errors.slice(0, 10),
      },
      `Import completed: ${importedCount} imported${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
    );
  } catch (error) {
    console.error("Bookmark import failed:", error);
    return ResponseHelper.serverError("Bookmark import failed", error.message);
  }
}
