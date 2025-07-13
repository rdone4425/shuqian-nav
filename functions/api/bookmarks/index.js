// 书签列表API - 支持分页、搜索、排序
import { authenticateRequest } from '../auth/verify.js';
import { ResponseHelper } from '../../utils/response-helper.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // 验证认证（可选，根据需求决定是否需要认证才能查看）
    // const auth = await authenticateRequest(request, env);
    // if (!auth.authenticated) {
    //   return new Response(JSON.stringify({
    //     success: false,
    //     error: auth.error
    //   }), {
    //     status: 401,
    //     headers: { 'Content-Type': 'application/json' }
    //   });
    // }

    // 获取查询参数
    const page = parseInt(url.searchParams.get('page')) || 1;
    const requestedLimit = parseInt(url.searchParams.get('limit')) || 20;
    // 对于导出功能，允许更大的limit值，最大5000
    const limit = Math.min(requestedLimit, 5000);
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    const offset = (page - 1) * limit;

    // 构建查询条件
    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push('(b.title LIKE ? OR b.description LIKE ? OR b.url LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (category) {
      whereConditions.push('b.category_id = ?');
      params.push(category);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 验证排序字段
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'url', 'visit_count', 'last_visited'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';

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
        c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
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
        hasPrev: page > 1
      },
      filters: {
        search,
        category,
        sortBy: validSortBy,
        sortOrder: validSortOrder
      }
    });

  } catch (error) {
    return ResponseHelper.serverError('获取书签列表失败', error.message);
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

    // 验证必填字段
    if (!title || !url) {
      return ResponseHelper.validationError('标题和URL是必填字段');
    }

    // 生成favicon URL
    const domain = new URL(url).hostname;
    const favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    // 插入新书签
    const result = await env.BOOKMARKS_DB.prepare(`
      INSERT INTO bookmarks (title, url, description, category_id, favicon_url)
      VALUES (?, ?, ?, ?, ?)
    `).bind(title, url, description || null, category_id || null, favicon_url).run();

    if (result.success) {
      // 获取新创建的书签
      const newBookmark = await env.BOOKMARKS_DB.prepare(`
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
          c.color as category_color
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.id = ?
      `).bind(result.meta.last_row_id).first();

      return ResponseHelper.success(newBookmark, '书签创建成功', 201);
    } else {
      throw new Error('数据库插入失败');
    }

  } catch (error) {
    return ResponseHelper.serverError('创建书签失败', error.message);
  }
}
