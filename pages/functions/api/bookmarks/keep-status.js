// 更新书签保留状态API
import { authenticateRequest } from '../auth/verify.js';

// 更新书签保留状态
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { bookmarkId, keepStatus } = await request.json();

    if (!bookmarkId || !keepStatus) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证保留状态值
    const validStatuses = ['normal', 'keep', 'ignore'];
    if (!validStatuses.includes(keepStatus)) {
      return new Response(JSON.stringify({
        success: false,
        error: '无效的保留状态'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 更新书签保留状态
    const result = await env.BOOKMARKS_DB
      .prepare(`UPDATE bookmarks SET keep_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(keepStatus, bookmarkId)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '书签不存在或更新失败'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取更新后的书签信息
    const bookmark = await env.BOOKMARKS_DB
      .prepare(`SELECT id, title, keep_status FROM bookmarks WHERE id = ?`)
      .bind(bookmarkId)
      .first();

    const statusMessages = {
      'normal': '已设为正常状态',
      'keep': '已标记为保留',
      'ignore': '已设为忽略检查'
    };

    return new Response(JSON.stringify({
      success: true,
      message: statusMessages[keepStatus],
      data: {
        bookmarkId: bookmark.id,
        title: bookmark.title,
        keepStatus: bookmark.keep_status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('更新书签保留状态失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '更新保留状态失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
