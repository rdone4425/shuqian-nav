import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

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
        c.created_at,
        c.updated_at,
        COUNT(b.id) as bookmark_count
      FROM categories c
      LEFT JOIN bookmarks b ON c.id = b.category_id
      GROUP BY c.id, c.name, c.color, c.description, c.created_at, c.updated_at
      ORDER BY c.name ASC
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

    const { name, color, description } = await request.json();
    if (!name) {
      return ResponseHelper.validationError("Category name is required");
    }

    const existingCategory = await env.BOOKMARKS_DB.prepare(
      "SELECT id FROM categories WHERE name = ?",
    )
      .bind(name)
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
      .bind(name, color || "#3B82F6", description || null)
      .run();

    if (!result.success) {
      throw new Error("Database insert failed");
    }

    const newCategory = await env.BOOKMARKS_DB.prepare(
      `
        SELECT
          c.id,
          c.name,
          c.color,
          c.description,
          c.created_at,
          c.updated_at,
          0 as bookmark_count
        FROM categories c
        WHERE c.id = ?
      `,
    )
      .bind(result.meta.last_row_id)
      .first();

    return ResponseHelper.success(newCategory, "Category created", 201);
  } catch (error) {
    console.error("Failed to create category:", error);
    return ResponseHelper.serverError(
      "Failed to create category",
      error.message,
    );
  }
}
