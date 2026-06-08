import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";
import { Validator } from "../../utils/validation.js";

function normalizeCategoryId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function validateParentCategory(env, parentId) {
  if (!parentId) return { valid: true, parentId: null };

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

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const categories = await env.BOOKMARKS_DB.prepare(
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
      GROUP BY c.id, c.name, c.color, c.description, h.parent_id, p.name, p.color, c.created_at, c.updated_at
      ORDER BY COALESCE(p.name, c.name) ASC, CASE WHEN h.parent_id IS NULL THEN 0 ELSE 1 END, c.name ASC
    `,
    ).all();

    return ResponseHelper.success(categories.results || []);
  } catch (error) {
    if (String(error.message || "").includes("no such table")) {
      return ResponseHelper.success([]);
    }
    return ResponseHelper.serverError(
      "Failed to get category list",
      error.message,
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
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

    const parentValidation = await validateParentCategory(env, parentId);
    if (!parentValidation.valid) {
      return ResponseHelper.validationError(parentValidation.error);
    }

    const existingCategory = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM categories WHERE name = ?",
    )
      .bind(categoryData.name)
      .first();

    if (existingCategory) {
      return ResponseHelper.businessError("Category name already exists");
    }

    const result = await env.BOOKMARKS_DB.prepare(
      `
      INSERT INTO categories (name, color, description)
      VALUES (?, ?, ?)
    `,
    )
      .bind(
        categoryData.name,
        categoryData.color || "#3B82F6",
        categoryData.description || null,
      )
      .run();

    if (!result.success) {
      throw new Error("Database insert failed");
    }

    const categoryId = result.meta.last_row_id;

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

    const newCategory = await getCategory(env, categoryId);

    return ResponseHelper.success(newCategory, "Category created", 201);
  } catch (error) {
    console.error("Failed to create category:", error);
    return ResponseHelper.serverError(
      "Failed to create category",
      error.message,
    );
  }
}
