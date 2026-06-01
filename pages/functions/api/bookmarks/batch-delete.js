import { authenticateRequest } from "../auth/verify.js";
import { insertDeletedBookmarksBatch } from "../../utils/deleted-bookmarks.js";
import { ResponseHelper } from "../../utils/response-helper.js";

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const { bookmarkIds } = await request.json();
    const ids = Array.isArray(bookmarkIds)
      ? [...new Set(bookmarkIds.map(normalizeId).filter(Boolean))]
      : [];

    if (!ids.length) {
      return ResponseHelper.validationError("请选择要删除的书签");
    }

    if (ids.length > 500) {
      return ResponseHelper.validationError("一次最多删除 500 个书签");
    }

    const placeholders = ids.map(() => "?").join(",");
    const bookmarksResult = await env.BOOKMARKS_DB.prepare(
      `
        SELECT
          b.id,
          b.title,
          b.url,
          b.description,
          b.favicon_url,
          b.created_at,
          b.updated_at,
          b.keep_status,
          c.name as category_name
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.id IN (${placeholders})
      `,
    )
      .bind(...ids)
      .all();

    const bookmarks = bookmarksResult.results || [];
    if (!bookmarks.length) {
      return ResponseHelper.notFound("未找到可删除的书签");
    }

    const archiveResult = await insertDeletedBookmarksBatch(env, bookmarks, {
      deleteReason: "manual_batch_delete",
      deletedBy: "user",
    });

    const foundIds = bookmarks.map((bookmark) => normalizeId(bookmark.id));
    const foundPlaceholders = foundIds.map(() => "?").join(",");
    const deleteResult = await env.BOOKMARKS_DB.prepare(
      `DELETE FROM bookmarks WHERE id IN (${foundPlaceholders})`,
    )
      .bind(...foundIds)
      .run();

    const deletedCount =
      deleteResult.meta?.changes ?? deleteResult.changes ?? bookmarks.length;

    return ResponseHelper.success(
      {
        requestedCount: ids.length,
        foundCount: bookmarks.length,
        deletedCount,
        missingCount: ids.length - bookmarks.length,
        archive: archiveResult,
      },
      "书签已批量删除",
    );
  } catch (error) {
    console.error("Batch delete bookmarks failed:", error);
    return ResponseHelper.serverError("批量删除书签失败", error.message);
  }
}
