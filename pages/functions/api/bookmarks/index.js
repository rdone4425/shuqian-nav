// Bookmarks list API.
import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";
import { Validator } from "../../utils/validation.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // 获取查询参数
    const page = Math.max(parseInt(url.searchParams.get("page"), 10) || 1, 1);
    const requestedLimit = parseInt(url.searchParams.get("limit"), 10) || 20;
    // 对于导出功能，允许更大的limit值，最大5000
    const limit = Math.min(Math.max(requestedLimit, 1), 5000);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    const offset = (page - 1) * limit;

    // 构建查询条件
    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push(
        "(b.title LIKE ? OR b.description LIKE ? OR b.url LIKE ?)",
      );
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      whereConditions.push(
        "(b.category_id = ? OR b.category_id IN (SELECT category_id FROM category_hierarchy WHERE parent_id = ?))",
      );
      params.push(category, category);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // 验证排序字段
    const sortFieldAliases = {
      popularity: "popularity_score",
    };
    const allowedSortFields = [
      "created_at",
      "updated_at",
      "title",
      "url",
      "visit_count",
      "last_visited",
      "popularity_score",
    ];
    const normalizedSortBy = sortFieldAliases[sortBy] || sortBy;
    const validSortBy = allowedSortFields.includes(normalizedSortBy)
      ? normalizedSortBy
      : "created_at";
    const validSortOrder = ["asc", "desc"].includes(sortOrder.toLowerCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // 查询书签数据
    const bookmarksQuery = `
      SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.favicon_url,
        COALESCE(b.keep_status, 'normal') as keep_status,
        COALESCE(b.visit_count, 0) as visit_count,
        b.last_visited,
        b.created_at,
        b.updated_at,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        h.parent_id as category_parent_id,
        p.name as category_parent_name,
        CASE WHEN h.parent_id IS NULL THEN c.name ELSE p.name || ' / ' || c.name END as category_display_name
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN category_hierarchy h ON h.category_id = c.id
      LEFT JOIN categories p ON p.id = h.parent_id
      ${whereClause}
      ORDER BY b.${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN category_hierarchy h ON h.category_id = c.id
      LEFT JOIN categories p ON p.id = h.parent_id
      ${whereClause}
    `;

    // 执行查询
    const bookmarksResult = await env.BOOKMARKS_DB.prepare(bookmarksQuery)
      .bind(...params, limit, offset)
      .all();

    const countResult = await env.BOOKMARKS_DB.prepare(countQuery)
      .bind(...params)
      .first();

    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    return ResponseHelper.success({
      bookmarks: bookmarksResult.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        search,
        category,
        sortBy: validSortBy,
        sortOrder: validSortOrder,
      },
    });
  } catch (error) {
    if (String(error.message || "").includes("no such table")) {
      return ResponseHelper.success({
        bookmarks: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        filters: {
          search: "",
          category: "",
          sortBy: "created_at",
          sortOrder: "DESC",
        },
      });
    }
    return ResponseHelper.serverError("获取书签列表失败", error.message);
  }
}

// 创建新书签
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证认证
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const { title, url, description, category_id } = await request.json();
    const bookmarkData = {
      title: typeof title === "string" ? title.trim() : title,
      url: typeof url === "string" ? url.trim() : url,
      description:
        typeof description === "string" ? description.trim() : description,
      category_id,
    };

    const validation = Validator.validateBookmark(bookmarkData);
    if (!validation.isValid) {
      return ResponseHelper.validationError(validation.errors);
    }

    // 生成favicon URL
    const domain = new URL(bookmarkData.url).hostname;
    const favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    // 插入新书签
    const result = await env.BOOKMARKS_DB.prepare(
      `
      INSERT INTO bookmarks (title, url, description, category_id, favicon_url)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
      .bind(
        bookmarkData.title,
        bookmarkData.url,
        bookmarkData.description || null,
        bookmarkData.category_id || null,
        favicon_url,
      )
      .run();

    if (result.success) {
      // 获取新创建的书签
      const newBookmark = await env.BOOKMARKS_DB.prepare(
        `
        SELECT 
          b.id,
          b.title,
          b.url,
          b.description,
          b.favicon_url,
          b.created_at,
          b.updated_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          h.parent_id as category_parent_id,
          p.name as category_parent_name,
          CASE WHEN h.parent_id IS NULL THEN c.name ELSE p.name || ' / ' || c.name END as category_display_name
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN category_hierarchy h ON h.category_id = c.id
        LEFT JOIN categories p ON p.id = h.parent_id
        WHERE b.id = ?
      `,
      )
        .bind(result.meta.last_row_id)
        .first();

      return ResponseHelper.success(newBookmark, "书签创建成功", 201);
    } else {
      throw new Error("数据库插入失败");
    }
  } catch (error) {
    return ResponseHelper.serverError("创建书签失败", error.message);
  }
}
