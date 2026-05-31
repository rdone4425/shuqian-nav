import { authenticateRequest } from "../auth/verify.js";
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

    const { bookmarkIds, categoryId } = await request.json();
    const ids = Array.isArray(bookmarkIds)
      ? [...new Set(bookmarkIds.map(normalizeId).filter(Boolean))]
      : [];
    const targetCategoryId = normalizeId(categoryId);

    if (!ids.length) {
      return ResponseHelper.validationError("请选择要移动的书签");
    }

    if (ids.length > 500) {
      return ResponseHelper.validationError("一次最多移动 500 个书签");
    }

    if (categoryId !== null && categoryId !== undefined && categoryId !== "") {
      if (!targetCategoryId) {
        return ResponseHelper.validationError("目标分类无效");
      }

      const target = await env.BOOKMARKS_DB.prepare(
        "SELECT id FROM categories WHERE id = ?",
      )
        .bind(targetCategoryId)
        .first();

      if (!target) {
        return ResponseHelper.validationError("目标分类不存在");
      }
    }

    const placeholders = ids.map(() => "?").join(",");
    const result = await env.BOOKMARKS_DB.prepare(
      `
        UPDATE bookmarks
        SET category_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `,
    )
      .bind(targetCategoryId, ...ids)
      .run();

    return ResponseHelper.success(
      {
        movedCount: result.meta?.changes ?? result.changes ?? 0,
        categoryId: targetCategoryId,
      },
      "书签已移动",
    );
  } catch (error) {
    console.error("Batch move bookmarks failed:", error);
    return ResponseHelper.serverError("批量移动书签失败", error.message);
  }
}
