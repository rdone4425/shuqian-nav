// 书签访问记录API
import { bookmarkAnalytics } from '../../../utils/bookmark-analytics.js';

export async function onRequestPost(context) {
  const { request, params, env } = context;
  const bookmarkId = params.id;
  
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
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
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
    if (typeof bookmarkAnalytics !== 'undefined') {
      bookmarkAnalytics.recordVisit(bookmarkId, {
        title: bookmark.title,
        url: bookmark.url,
        userAgent: userAgent || '',
        referrer: referrer || ''
      });
    }
    
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('记录访问失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '记录访问失败',
      message: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}

// 处理 CORS 预检请求
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
