// 单个书签的CRUD操作
import { authenticateRequest } from '../auth/verify.js';
import { insertDeletedBookmarkSafe } from '../../utils/deleted-bookmarks.js';
import { bookmarkAnalytics } from '../../utils/bookmark-analytics.js';
import { ResponseHelper } from '../../utils/response-helper.js';

// 获取单个书签
export async function onRequestGet(context) {
  const { params, env } = context;
  const bookmarkId = params.id;

  try {
    const bookmark = await env.BOOKMARKS_DB.prepare(`
      SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.favicon_url,
        b.visit_count,
        b.last_visited,
        b.created_at,
        b.updated_at,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `).bind(bookmarkId).first();

    if (!bookmark) {
      return ResponseHelper.notFound('书签不存在');
    }

    return ResponseHelper.success(bookmark);

  } catch (error) {
    return ResponseHelper.serverError('获取书签失败', error.message);
  }
}

// 更新书签
export async function onRequestPut(context) {
  const { request, params, env } = context;
  const bookmarkId = params.id;

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

    const { title, url, description, category_id } = await request.json();

    // 验证必填字段
    if (!title || !url) {
      return new Response(JSON.stringify({
        success: false,
        error: '标题和URL是必填字段'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查书签是否存在
    const existingBookmark = await env.BOOKMARKS_DB.prepare(
      'SELECT id FROM bookmarks WHERE id = ?'
    ).bind(bookmarkId).first();

    if (!existingBookmark) {
      return new Response(JSON.stringify({
        success: false,
        error: '书签不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 生成新的favicon URL
    const domain = new URL(url).hostname;
    const favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    // 更新书签
    const result = await env.BOOKMARKS_DB.prepare(`
      UPDATE bookmarks 
      SET title = ?, url = ?, description = ?, category_id = ?, favicon_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(title, url, description || null, category_id || null, favicon_url, bookmarkId).run();

    if (result.success) {
      // 获取更新后的书签
      const updatedBookmark = await env.BOOKMARKS_DB.prepare(`
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
      `).bind(bookmarkId).first();

      return new Response(JSON.stringify({
        success: true,
        data: updatedBookmark,
        message: '书签更新成功'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('数据库更新失败');
    }

  } catch (error) {
    console.error('更新书签错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '更新书签失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 删除书签
export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const bookmarkId = params.id;

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

    // 获取完整的书签信息用于备份
    const existingBookmark = await env.BOOKMARKS_DB.prepare(`
      SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.favicon_url,
        b.created_at,
        b.updated_at,
        c.name as category_name,
        b.keep_status
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `).bind(bookmarkId).first();

    if (!existingBookmark) {
      return new Response(JSON.stringify({
        success: false,
        error: '书签不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取删除原因和检查状态信息（从请求体中）
    let deleteReason = 'manual_delete';
    let checkStatus = null;
    let statusCode = null;
    let statusText = null;
    let errorMessage = null;
    let keepStatus = null;

    try {
      const requestBody = await request.json();
      deleteReason = requestBody.reason || 'manual_delete';
      checkStatus = requestBody.checkStatus || null;
      statusCode = requestBody.statusCode || null;
      statusText = requestBody.statusText || null;
      errorMessage = requestBody.errorMessage || null;
      keepStatus = requestBody.keepStatus || null;
    } catch (e) {
      // 如果没有请求体，使用默认值
    }

    // 先将书签信息保存到删除记录表（使用去重函数）
    try {
      await insertDeletedBookmarkSafe(env, existingBookmark, {
        deleteReason,
        checkStatus,
        statusCode,
        statusText,
        errorMessage,
        keepStatus,
        deletedBy: 'user'
      });
    } catch (backupError) {
      console.error('保存删除记录失败:', backupError);
      // 继续删除，但记录错误
    }

    // 删除书签
    const result = await env.BOOKMARKS_DB.prepare(
      'DELETE FROM bookmarks WHERE id = ?'
    ).bind(bookmarkId).run();

    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        message: `书签 "${existingBookmark.title}" 删除成功`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('数据库删除失败');
    }

  } catch (error) {
    console.error('删除书签错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除书签失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 记录书签访问 - 新增的POST处理函数
export async function onRequestPost(context) {
  const { request, params, env } = context;
  const bookmarkId = params.id;
  const url = new URL(request.url);

  // 检查是否是访问记录请求
  if (url.pathname.endsWith('/visit')) {
    try {
      const { timestamp, userAgent, referrer } = await request.json();

      // 检查书签是否存在
      const bookmark = await env.BOOKMARKS_DB.prepare(`
        SELECT id, title, url, category_id, visit_count, last_visited
        FROM bookmarks
        WHERE id = ?
      `).bind(bookmarkId).first();

      if (!bookmark) {
        return new Response(JSON.stringify({
          success: false,
          error: '书签不存在'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 更新数据库中的访问统计
      const newVisitCount = (bookmark.visit_count || 0) + 1;
      const visitTime = timestamp || new Date().toISOString();

      await env.BOOKMARKS_DB.prepare(`
        UPDATE bookmarks
        SET visit_count = ?, last_visited = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(newVisitCount, visitTime, bookmarkId).run();

      // 记录到分析系统
      bookmarkAnalytics.recordVisit(bookmarkId, {
        title: bookmark.title,
        url: bookmark.url,
        userAgent: userAgent || '',
        referrer: referrer || ''
      });

      return new Response(JSON.stringify({
        success: true,
        message: '访问记录成功',
        data: {
          bookmarkId,
          visitCount: newVisitCount,
          lastVisited: visitTime
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('记录访问失败:', error);
      return new Response(JSON.stringify({
        success: false,
        error: '记录访问失败',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 如果不是访问记录请求，返回405
  return new Response(JSON.stringify({
    success: false,
    error: '不支持的操作'
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}
