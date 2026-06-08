import { authenticateRequest } from "../../auth/verify.js";
import { ResponseHelper } from "../../../utils/response-helper.js";
import { Validator } from "../../../utils/validation.js";

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
        h.parent_id,
        p.name as parent_name,
        p.color as parent_color,
        CASE WHEN h.parent_id IS NULL THEN c.name ELSE p.name || ' / ' || c.name END as display_name,
        c.created_at,
        c.updated_at,
        COUNT(b.id) as bookmark_count
      FROM categories c
      LEFT JOIN category_hierarchy h ON h.category_id = c.id
      LEFT JOIN categories p ON p.id = h.parent_id
      LEFT JOIN bookmarks b ON c.id = b.category_id
      WHERE c.id = ?
      GROUP BY c.id, c.name, c.color, c.description, h.parent_id, p.name, p.color, c.created_at, c.updated_at
    `,
  )
    .bind(id)
    .first();
}

async function validateParentCategory(env, categoryId, parentId) {
  if (!parentId) return { valid: true, parentId: null };

  if (parentId === categoryId) {
    return { valid: false, error: "父分类不能是当前分类" };
  }

  const child = await env.BOOKMARKS_DB.prepare(
    "SELECT category_id FROM category_hierarchy WHERE parent_id = ? LIMIT 1",
  )
    .bind(categoryId)
    .first();

  if (child) {
    return { valid: false, error: "已有子分类的分类不能设为二级分类" };
  }

  const parent = await env.BOOKMARKS_DB.prepare(
    `
      SELECT c.id, h.parent_id
      FROM categories c
      LEFT JOIN category_hierarchy h ON h.category_id = c.id
      WHERE c.id = ?
    `,
  )
    .bind(parentId)
    .first();

  if (!parent) {
    return { valid: false, error: "父分类不存在" };
  }

  if (parent.parent_id) {
    return { valid: false, error: "父分类不能是二级分类" };
  }

  return { valid: true, parentId };
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

    const { name, color, description, parent_id } = await request.json();
    const parentId = normalizeCategoryId(parent_id);
    const hasParentValue =
      parent_id !== null && parent_id !== undefined && parent_id !== "";
    const categoryData = {
      name: typeof name === "string" ? name.trim() : name,
      color: typeof color === "string" ? color.trim() : color,
      description:
        typeof description === "string" ? description.trim() : description,
    };

    const validation = Validator.validateCategory(categoryData);
    if (!validation.isValid) {
      return ResponseHelper.validationError(validation.errors);
    }

    if (hasParentValue && !parentId) {
      return ResponseHelper.validationError("父分类 ID 无效");
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
      .bind(categoryData.name, categoryId)
      .first();

    if (duplicate) {
      return ResponseHelper.businessError("分类名称已存在");
    }

    const parentValidation = await validateParentCategory(
      env,
      categoryId,
      parentId,
    );
    if (!parentValidation.valid) {
      return ResponseHelper.validationError(parentValidation.error);
    }

    await env.BOOKMARKS_DB.prepare(
      `
        UPDATE categories
        SET name = ?, color = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
      .bind(
        categoryData.name,
        categoryData.color || "#3B82F6",
        categoryData.description || null,
        categoryId,
      )
      .run();

    await env.BOOKMARKS_DB.prepare(
      "DELETE FROM category_hierarchy WHERE category_id = ?",
    )
      .bind(categoryId)
      .run();

    if (parentValidation.parentId) {
      await env.BOOKMARKS_DB.prepare(
        `
          INSERT INTO category_hierarchy (category_id, parent_id)
          VALUES (?, ?)
        `,
      )
        .bind(categoryId, parentValidation.parentId)
        .run();
    }

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
    const hasMoveTarget =
      body.moveToCategoryId !== null &&
      body.moveToCategoryId !== undefined &&
      body.moveToCategoryId !== "";
    const moveToCategoryId = normalizeCategoryId(body.moveToCategoryId);

    if (hasMoveTarget && !moveToCategoryId) {
      return ResponseHelper.validationError("迁移目标分类无效");
    }

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

    await env.BOOKMARKS_DB.prepare(
      "DELETE FROM category_hierarchy WHERE category_id = ? OR parent_id = ?",
    )
      .bind(categoryId, categoryId)
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
