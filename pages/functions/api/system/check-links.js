// 链接检查和清理API
import { authenticateRequest } from '../auth/verify.js';
import { insertDeletedBookmarksBatch } from '../../utils/deleted-bookmarks.js';

// 检查单个URL的可访问性
async function checkUrl(url, timeout = 15000) {
  try {
    // 使用Promise.race来实现超时控制，避免AbortController问题
    const fetchPromise = fetch(url, {
      method: 'HEAD', // 只获取头部信息，节省带宽
      headers: {
        'User-Agent': 'BookmarkNavigator/1.0 Link Checker',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    return {
      url,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      error: null,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    // 如果HEAD请求失败，尝试GET请求（某些服务器不支持HEAD）
    try {
      const getResponse = await Promise.race([
        fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'BookmarkNavigator/1.0 Link Checker',
            'Accept': 'text/html,*/*',
            'Cache-Control': 'no-cache'
          }
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GET request timeout')), timeout);
        })
      ]);

      return {
        url,
        accessible: getResponse.ok,
        status: getResponse.status,
        statusText: getResponse.statusText,
        error: null,
        checkedAt: new Date().toISOString()
      };
    } catch (getError) {
      return {
        url,
        accessible: false,
        status: 0,
        statusText: 'Network Error',
        error: error.message.includes('timeout') ? 'Request timeout' : error.message,
        checkedAt: new Date().toISOString()
      };
    }
  }
}

// 批量检查链接
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

    const { autoDelete = false, batchSize = 10 } = await request.json();

    // 检查是否有用户数据
    const hasUserData = await env.BOOKMARKS_DB
      .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
      .bind('has_user_data')
      .first();

    // 获取书签列表（如果有用户数据，排除预设书签）
    let bookmarksQuery = 'SELECT id, title, url, category_id, created_at FROM bookmarks';

    // 如果有用户数据，排除预设书签
    if (hasUserData && hasUserData.config_value === 'true') {
      const presetUrls = [
        'https://github.com',
        'https://stackoverflow.com',
        'https://developer.mozilla.org',
        'https://youtube.com',
        'https://twitter.com',
        'https://reddit.com',
        'https://amazon.com',
        'https://google.com'
      ];

      const placeholders = presetUrls.map(() => '?').join(',');
      bookmarksQuery += ` WHERE url NOT IN (${placeholders})`;
    }

    bookmarksQuery += ' ORDER BY id';

    const bookmarks = hasUserData && hasUserData.config_value === 'true'
      ? await env.BOOKMARKS_DB.prepare(bookmarksQuery).bind(
          'https://github.com',
          'https://stackoverflow.com',
          'https://developer.mozilla.org',
          'https://youtube.com',
          'https://twitter.com',
          'https://reddit.com',
          'https://amazon.com',
          'https://google.com'
        ).all()
      : await env.BOOKMARKS_DB.prepare(bookmarksQuery).all();

    if (!bookmarks.results.length) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          total: 0,
          checked: 0,
          accessible: 0,
          inaccessible: 0,
          deleted: 0,
          results: []
        },
        message: '没有书签需要检查'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    const inaccessibleBookmarks = [];
    let checkedCount = 0;
    let accessibleCount = 0;
    let inaccessibleCount = 0;

    // 分批检查，避免同时发起太多请求
    for (let i = 0; i < bookmarks.results.length; i += batchSize) {
      const batch = bookmarks.results.slice(i, i + batchSize);
      
      const batchPromises = batch.map(bookmark => 
        checkUrl(bookmark.url).then(result => ({
          ...result,
          bookmarkId: bookmark.id,
          title: bookmark.title,
          categoryId: bookmark.category_id,
          createdAt: bookmark.created_at
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 统计结果
      batchResults.forEach(result => {
        checkedCount++;
        if (result.accessible) {
          accessibleCount++;
        } else {
          inaccessibleCount++;
          inaccessibleBookmarks.push(result);
        }
      });

      // 添加延迟，避免过于频繁的请求
      if (i + batchSize < bookmarks.results.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 记录检查结果到数据库
    const checkRecord = {
      checkedAt: new Date().toISOString(),
      total: bookmarks.results.length,
      accessible: accessibleCount,
      inaccessible: inaccessibleCount,
      autoDelete,
      results: JSON.stringify(results)
    };

    await env.BOOKMARKS_DB
      .prepare(`INSERT INTO system_config (config_key, config_value, description) 
                VALUES (?, ?, ?)`)
      .bind(
        `link_check_${Date.now()}`,
        JSON.stringify(checkRecord),
        `链接检查记录 - ${new Date().toLocaleString()}`
      )
      .run();

    let deletedCount = 0;
    const deletedBookmarks = [];

    // 如果启用自动删除，删除无效链接
    if (autoDelete && inaccessibleBookmarks.length > 0) {
      // 先批量保存删除记录
      const bookmarksToDelete = inaccessibleBookmarks.map(bookmark => ({
        id: bookmark.bookmarkId,
        title: bookmark.title,
        url: bookmark.url,
        category_name: bookmark.category,
        description: bookmark.description,
        favicon_url: bookmark.favicon_url,
        created_at: bookmark.created_at,
        updated_at: bookmark.updated_at,
        keep_status: bookmark.keep_status
      }));

      try {
        const batchResult = await insertDeletedBookmarksBatch(env, bookmarksToDelete, {
          deleteReason: 'link_check_failed',
          checkStatus: 'failed',
          deletedBy: 'system'
        });
        console.log(`批量保存删除记录: ${batchResult.inserted} 新增, ${batchResult.skipped} 跳过`);
      } catch (error) {
        console.error('批量保存删除记录失败:', error);
      }

      // 然后删除书签
      for (const bookmark of inaccessibleBookmarks) {
        try {
          await env.BOOKMARKS_DB
            .prepare('DELETE FROM bookmarks WHERE id = ?')
            .bind(bookmark.bookmarkId)
            .run();

          deletedCount++;
          deletedBookmarks.push({
            id: bookmark.bookmarkId,
            title: bookmark.title,
            url: bookmark.url,
            reason: `${bookmark.status} ${bookmark.statusText}`,
            error: bookmark.error
          });
        } catch (error) {
          console.error(`删除书签失败 (ID: ${bookmark.bookmarkId}):`, error);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        total: bookmarks.results.length,
        checked: checkedCount,
        accessible: accessibleCount,
        inaccessible: inaccessibleCount,
        deleted: deletedCount,
        deletedBookmarks,
        inaccessibleBookmarks: autoDelete ? [] : inaccessibleBookmarks,
        checkTime: new Date().toISOString()
      },
      message: `检查完成: ${accessibleCount}个可访问, ${inaccessibleCount}个不可访问${autoDelete ? `, ${deletedCount}个已删除` : ''}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('链接检查失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '链接检查失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取检查历史记录
export async function onRequestGet(context) {
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

    // 获取检查历史记录
    const records = await env.BOOKMARKS_DB
      .prepare(`SELECT config_key, config_value, description, created_at 
                FROM system_config 
                WHERE config_key LIKE 'link_check_%' 
                ORDER BY created_at DESC 
                LIMIT 20`)
      .all();

    const history = records.results.map(record => {
      try {
        const data = JSON.parse(record.config_value);
        return {
          id: record.config_key,
          ...data,
          createdAt: record.created_at
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      data: history
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取检查历史失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取检查历史失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
