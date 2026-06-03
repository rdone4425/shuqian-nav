import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page"), 10) || 1;
    const limit = parseInt(url.searchParams.get("limit"), 10) || 50;
    const offset = (page - 1) * limit;
    const filter = url.searchParams.get("filter");
    const range = url.searchParams.get("range");
    const search = url.searchParams.get("search");

    let whereClause = "";
    const params = [];

    const addWhere = (clause, ...values) => {
      whereClause += whereClause ? ` AND ${clause}` : ` WHERE ${clause}`;
      params.push(...values);
    };

    if (filter && filter !== "all") {
      addWhere("deleted_reason = ?", filter);
    }

    const rangeStart = getDeletedRangeStart(range);
    if (rangeStart) {
      addWhere("deleted_at >= ?", rangeStart);
    }

    if (search) {
      addWhere("(title LIKE ? OR url LIKE ?)", `%${search}%`, `%${search}%`);
    }

    const countResult = await env.BOOKMARKS_DB.prepare(
      `SELECT COUNT(*) as total FROM deleted_bookmarks${whereClause}`,
    )
      .bind(...params)
      .first();

    const deletedBookmarksResult = await env.BOOKMARKS_DB.prepare(
      `
      SELECT
        id,
        original_bookmark_id,
        title,
        url,
        category,
        description,
        favicon_url,
        deleted_at,
        deleted_reason,
        check_status,
        status_code,
        status_text,
        error_message,
        keep_status,
        deleted_by
      FROM deleted_bookmarks
      ${whereClause}
      ORDER BY deleted_at DESC
      LIMIT ? OFFSET ?
    `,
    )
      .bind(...params, limit, offset)
      .all();

    const total = countResult?.total || 0;
    return ResponseHelper.success({
      bookmarks: deletedBookmarksResult.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to list deleted bookmarks:", error);
    return ResponseHelper.serverError("获取删除记录失败", error.message);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const { deletedId } = await request.json();
    if (!deletedId) {
      return ResponseHelper.validationError("删除记录ID是必填的");
    }

    const deletedRecord = await env.BOOKMARKS_DB.prepare(
      "SELECT * FROM deleted_bookmarks WHERE id = ?",
    )
      .bind(deletedId)
      .first();

    if (!deletedRecord) {
      return ResponseHelper.notFound("删除记录不存在");
    }

    const existingBookmark = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM bookmarks WHERE url = ?",
    )
      .bind(deletedRecord.url)
      .first();

    if (existingBookmark) {
      return ResponseHelper.error("该URL的书签已存在，无法恢复", 409);
    }

    const categoryId = await getOrCreateCategoryId(env, deletedRecord.category);
    const restoreResult = await env.BOOKMARKS_DB.prepare(
      `
      INSERT INTO bookmarks (
        title, url, description, category_id, favicon_url, tags,
        created_at, updated_at, keep_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `,
    )
      .bind(
        deletedRecord.title,
        deletedRecord.url,
        deletedRecord.description || null,
        categoryId,
        deletedRecord.favicon_url || null,
        deletedRecord.tags || null,
        deletedRecord.created_at || toSqlTimestamp(Date.now()),
        deletedRecord.keep_status || "normal",
      )
      .run();

    if (!restoreResult.success) {
      throw new Error("恢复书签失败");
    }

    await env.BOOKMARKS_DB.prepare("DELETE FROM deleted_bookmarks WHERE id = ?")
      .bind(deletedId)
      .run();

    return ResponseHelper.success(
      { bookmarkId: restoreResult.meta?.last_row_id || null },
      `书签 "${deletedRecord.title}" 恢复成功`,
    );
  } catch (error) {
    console.error("Failed to restore deleted bookmark:", error);
    return ResponseHelper.serverError("恢复书签失败", error.message);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const url = new URL(request.url);
    const deletedId = url.searchParams.get("id");
    if (!deletedId) {
      return ResponseHelper.validationError("删除记录ID是必填的");
    }

    const deletedRecord = await env.BOOKMARKS_DB.prepare(
      "SELECT title FROM deleted_bookmarks WHERE id = ?",
    )
      .bind(deletedId)
      .first();

    if (!deletedRecord) {
      return ResponseHelper.notFound("删除记录不存在");
    }

    const result = await env.BOOKMARKS_DB.prepare(
      "DELETE FROM deleted_bookmarks WHERE id = ?",
    )
      .bind(deletedId)
      .run();

    if (!result.success) {
      throw new Error("永久删除失败");
    }

    return ResponseHelper.success(
      { deletedId },
      `删除记录 "${deletedRecord.title}" 已永久删除`,
    );
  } catch (error) {
    console.error("Failed to permanently delete bookmark record:", error);
    return ResponseHelper.serverError("永久删除记录失败", error.message);
  }
}

async function getOrCreateCategoryId(env, categoryName) {
  if (!categoryName) {
    return null;
  }

  const category = await env.BOOKMARKS_DB.prepare(
    "SELECT id FROM categories WHERE name = ?",
  )
    .bind(categoryName)
    .first();

  if (category) {
    return category.id;
  }

  const newCategory = await env.BOOKMARKS_DB.prepare(
    `
    INSERT INTO categories (name, color, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `,
  )
    .bind(categoryName, "#6366f1")
    .run();

  return newCategory.meta?.last_row_id || null;
}

function getDeletedRangeStart(range) {
  if (!range || range === "all") {
    return null;
  }

  const now = new Date();
  if (range === "today") {
    return toSqlTimestamp(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  const daysByRange = {
    "7d": 7,
    "30d": 30,
  };
  const days = daysByRange[range];
  if (!days) {
    return null;
  }

  return toSqlTimestamp(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function toSqlTimestamp(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 19).replace("T", " ");
}
