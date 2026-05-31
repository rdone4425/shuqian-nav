import { authenticateRequest } from "../../auth/verify.js";
import { ResponseHelper } from "../../../utils/response-helper.js";

function normalizeCategoryId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getCategory(env, id) {
  return await env.BOOKMARKS_DB.prepare(
    `
      SELECT
        c.id,
        c.name,
        c.color,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(b.id) as bookmark_count
      FROM categories c
      LEFT JOIN bookmarks b ON c.id = b.category_id
      WHERE c.id = ?
      GROUP BY c.id, c.name, c.color, c.description, c.created_at, c.updated_at
    `,
  )
    .bind(id)
    .first();
}

async function requireAuth(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }
  return null;
}

export async function onRequestPut(context) {
  const { request, params, env } = context;
  const categoryId = normalizeCategoryId(params.id);

  try {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    if (!categoryId) {
      return ResponseHelper.validationError("分类 ID 无效");
    }

    const { name, color, description } = await request.json();
    const normalizedName = String(name || "").trim();

    if (!normalizedName) {
      return ResponseHelper.validationError("分类名称不能为空");
    }

    const existing = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM categories WHERE id = ?",
    )
      .bind(categoryId)
      .first();

    if (!existing) {
      return ResponseHelper.notFound("分类不存在");
    }

    const duplicate = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM categories WHERE name = ? AND id != ?",
    )
      .bind(normalizedName, categoryId)
      .first();

    if (duplicate) {
      return ResponseHelper.businessError("分类名称已存在");
    }

    await env.BOOKMARKS_DB.prepare(
      `
        UPDATE categories
        SET name = ?, color = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
      .bind(
        normalizedName,
        color || "#3B82F6",
        description ? String(description).trim() : null,
        categoryId,
      )
      .run();

    const updatedCategory = await getCategory(env, categoryId);
    return ResponseHelper.success(updatedCategory, "分类已更新");
  } catch (error) {
    console.error("Update category failed:", error);
    return ResponseHelper.serverError("更新分类失败", error.message);
  }
}

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const categoryId = normalizeCategoryId(params.id);

  try {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    if (!categoryId) {
      return ResponseHelper.validationError("分类 ID 无效");
    }

    const category = await getCategory(env, categoryId);
    if (!category) {
      return ResponseHelper.notFound("分类不存在");
    }

    const body = await request.json().catch(() => ({}));
    const moveToCategoryId = normalizeCategoryId(body.moveToCategoryId);

    if (moveToCategoryId === categoryId) {
      return ResponseHelper.validationError("迁移目标不能是当前分类");
    }

    if (moveToCategoryId) {
      const target = await env.BOOKMARKS_DB.prepare(
        "SELECT id FROM categories WHERE id = ?",
      )
        .bind(moveToCategoryId)
        .first();

      if (!target) {
        return ResponseHelper.validationError("迁移目标分类不存在");
      }
    }

    const movedResult = await env.BOOKMARKS_DB.prepare(
      "UPDATE bookmarks SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?",
    )
      .bind(moveToCategoryId, categoryId)
      .run();

    await env.BOOKMARKS_DB.prepare("DELETE FROM categories WHERE id = ?")
      .bind(categoryId)
      .run();

    return ResponseHelper.success(
      {
        id: categoryId,
        movedCount: movedResult.meta?.changes ?? movedResult.changes ?? 0,
        moveToCategoryId,
      },
      "分类已删除，书签已迁移",
    );
  } catch (error) {
    console.error("Delete category failed:", error);
    return ResponseHelper.serverError("删除分类失败", error.message);
  }
}
