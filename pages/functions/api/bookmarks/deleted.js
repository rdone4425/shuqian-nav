// 删除书签记录管理API
import { authenticateRequest } from '../auth/verify.js';

// 获取删除的书签列表
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // 验证认证
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    const filter = url.searchParams.get('filter');
    const search = url.searchParams.get('search');

    // 构建查询条件
    let whereClause = '';
    let params = [];

    if (filter && filter !== 'all') {
      whereClause += ' WHERE deleted_reason = ?';
      params.push(filter);
    }

    if (search) {
      const searchClause = whereClause ? ' AND' : ' WHERE';
      whereClause += `${searchClause} (title LIKE ? OR url LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // 获取删除记录总数
    const countResult = await env.BOOKMARKS_DB.prepare(
      `SELECT COUNT(*) as total FROM deleted_bookmarks${whereClause}`
    ).bind(...params).first();

    // 获取删除记录列表
    const deletedBookmarksResult = await env.BOOKMARKS_DB.prepare(`
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
    `).bind(...params, limit, offset).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        bookmarks: deletedBookmarksResult.results || [],
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取删除记录失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取删除记录失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 恢复删除的书签
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证认证
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { deletedId } = await request.json();

    if (!deletedId) {
      return new Response(JSON.stringify({
        success: false,
        error: '删除记录ID是必填的'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取删除记录
    const deletedRecord = await env.BOOKMARKS_DB.prepare(
      'SELECT * FROM deleted_bookmarks WHERE id = ?'
    ).bind(deletedId).first();

    if (!deletedRecord) {
      return new Response(JSON.stringify({
        success: false,
        error: '删除记录不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查URL是否已存在
    const existingBookmark = await env.BOOKMARKS_DB.prepare(
      'SELECT id FROM bookmarks WHERE url = ?'
    ).bind(deletedRecord.url).first();

    if (existingBookmark) {
      return new Response(JSON.stringify({
        success: false,
        error: '该URL的书签已存在，无法恢复'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取或创建分类
    let categoryId = null;
    if (deletedRecord.category) {
      const category = await env.BOOKMARKS_DB.prepare(
        'SELECT id FROM categories WHERE name = ?'
      ).bind(deletedRecord.category).first();

      if (category) {
        categoryId = category.id;
      } else {
        // 创建新分类
        const newCategory = await env.BOOKMARKS_DB.prepare(`
          INSERT INTO categories (name, color, created_at, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(deletedRecord.category, '#6366f1').run();
        categoryId = newCategory.meta.last_row_id;
      }
    }

    // 恢复书签
    const restoreResult = await env.BOOKMARKS_DB.prepare(`
      INSERT INTO bookmarks (
        title, url, description, category_id, favicon_url, tags,
        created_at, updated_at, keep_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(
      deletedRecord.title,
      deletedRecord.url,
      deletedRecord.description,
      categoryId,
      deletedRecord.favicon_url,
      deletedRecord.tags,
      deletedRecord.created_at,
      deletedRecord.keep_status
    ).run();

    if (restoreResult.success) {
      // 删除恢复记录
      await env.BOOKMARKS_DB.prepare(
        'DELETE FROM deleted_bookmarks WHERE id = ?'
      ).bind(deletedId).run();

      return new Response(JSON.stringify({
        success: true,
        message: `书签 "${deletedRecord.title}" 恢复成功`,
        data: {
          bookmarkId: restoreResult.meta.last_row_id
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('恢复书签失败');
    }

  } catch (error) {
    console.error('恢复书签失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '恢复书签失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 永久删除记录
export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    // 验证认证
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const deletedId = url.searchParams.get('id');

    if (!deletedId) {
      return new Response(JSON.stringify({
        success: false,
        error: '删除记录ID是必填的'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取删除记录
    const deletedRecord = await env.BOOKMARKS_DB.prepare(
      'SELECT title FROM deleted_bookmarks WHERE id = ?'
    ).bind(deletedId).first();

    if (!deletedRecord) {
      return new Response(JSON.stringify({
        success: false,
        error: '删除记录不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 永久删除记录
    const result = await env.BOOKMARKS_DB.prepare(
      'DELETE FROM deleted_bookmarks WHERE id = ?'
    ).bind(deletedId).run();

    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        message: `删除记录 "${deletedRecord.title}" 已永久删除`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('永久删除失败');
    }

  } catch (error) {
    console.error('永久删除记录失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '永久删除记录失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
