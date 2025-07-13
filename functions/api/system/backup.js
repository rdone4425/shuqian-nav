/**
 * 完整备份API
 * 导出所有书签和分类数据，不受数量限制
 */

import { authenticateRequest } from '../auth/verify.js';

export async function onRequestGet(context) {
  try {
    // 验证认证
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = context.env.BOOKMARKS_DB;
    const url = new URL(context.request.url);
    const format = url.searchParams.get('format') || 'json'; // json 或 html

    // 获取所有书签（不分页）
    const bookmarksQuery = `
      SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.category_id,
        b.favicon_url,
        b.keep_status,
        b.visit_count,
        b.last_visited,
        b.created_at,
        b.updated_at,
        c.name as category_name,
        c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.created_at DESC
    `;

    const bookmarksResult = await db.prepare(bookmarksQuery).all();
    const bookmarks = bookmarksResult.results || [];

    // 获取所有分类
    const categoriesQuery = `
      SELECT
        id,
        name,
        color,
        description,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM bookmarks WHERE category_id = categories.id) as bookmark_count
      FROM categories
      ORDER BY name
    `;

    const categoriesResult = await db.prepare(categoriesQuery).all();
    const categories = categoriesResult.results || [];

    // 获取系统信息
    const systemQuery = `
      SELECT config_key, config_value
      FROM system_config
      WHERE config_key IN ('site_title', 'site_description', 'has_user_data')
    `;

    const systemResult = await db.prepare(systemQuery).all();
    const systemConfig = {};
    (systemResult.results || []).forEach(row => {
      systemConfig[row.config_key] = row.config_value;
    });

    // 准备导出数据
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        exportFormat: format,
        version: '1.0.0',
        totalBookmarks: bookmarks.length,
        totalCategories: categories.length,
        systemConfig: systemConfig
      },
      bookmarks: bookmarks,
      categories: categories,
      statistics: {
        bookmarksByCategory: categories.map(cat => ({
          categoryName: cat.name,
          count: cat.bookmark_count
        })),
        totalVisits: bookmarks.reduce((sum, b) => sum + (b.visit_count || 0), 0),
        mostVisited: bookmarks
          .filter(b => b.visit_count > 0)
          .sort((a, b) => (b.visit_count || 0) - (a.visit_count || 0))
          .slice(0, 10)
          .map(b => ({ title: b.title, url: b.url, visits: b.visit_count }))
      }
    };

    if (format === 'html') {
      // 生成HTML格式
      const html = generateBackupHTML(exportData);
      
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="bookmarks-backup-${new Date().toISOString().split('T')[0]}.html"`
        }
      });
    } else {
      // 返回JSON格式
      return new Response(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="bookmarks-backup-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

  } catch (error) {
    console.error('备份失败:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: '备份失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 生成HTML格式的备份文件
function generateBackupHTML(exportData) {
  const { metadata, bookmarks, categories } = exportData;
  
  // 按分类组织书签
  const bookmarksByCategory = {};
  const uncategorized = [];
  
  bookmarks.forEach(bookmark => {
    if (bookmark.category_name) {
      if (!bookmarksByCategory[bookmark.category_name]) {
        bookmarksByCategory[bookmark.category_name] = [];
      }
      bookmarksByCategory[bookmark.category_name].push(bookmark);
    } else {
      uncategorized.push(bookmark);
    }
  });

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>书签备份 - ${metadata.exportTime.split('T')[0]}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
        .category { margin-bottom: 30px; }
        .category-header { background: #2563eb; color: white; padding: 10px 15px; border-radius: 6px; margin-bottom: 10px; }
        .bookmark { display: flex; align-items: center; padding: 8px 15px; margin-bottom: 5px; background: #f8f9fa; border-radius: 4px; }
        .bookmark:hover { background: #e9ecef; }
        .favicon { width: 16px; height: 16px; margin-right: 10px; }
        .bookmark-info { flex: 1; }
        .bookmark-title { font-weight: 500; color: #1a1a1a; text-decoration: none; }
        .bookmark-url { font-size: 12px; color: #666; margin-top: 2px; }
        .bookmark-meta { font-size: 11px; color: #999; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 书签备份</h1>
            <p>导出时间: ${new Date(metadata.exportTime).toLocaleString('zh-CN')}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${metadata.totalBookmarks}</div>
                <div>总书签数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${metadata.totalCategories}</div>
                <div>分类数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${exportData.statistics.totalVisits}</div>
                <div>总访问次数</div>
            </div>
        </div>`;

  // 添加分类书签
  Object.entries(bookmarksByCategory).forEach(([categoryName, categoryBookmarks]) => {
    html += `
        <div class="category">
            <div class="category-header">
                📁 ${categoryName} (${categoryBookmarks.length})
            </div>`;
    
    categoryBookmarks.forEach(bookmark => {
      const visitInfo = bookmark.visit_count > 0 ? `访问${bookmark.visit_count}次` : '';
      html += `
            <div class="bookmark">
                <img src="${bookmark.favicon_url || '/favicon.ico'}" alt="" class="favicon" onerror="this.style.display='none'">
                <div class="bookmark-info">
                    <a href="${bookmark.url}" class="bookmark-title" target="_blank">${bookmark.title}</a>
                    <div class="bookmark-url">${bookmark.url}</div>
                    ${bookmark.description ? `<div class="bookmark-url">${bookmark.description}</div>` : ''}
                </div>
                <div class="bookmark-meta">${visitInfo}</div>
            </div>`;
    });
    
    html += `</div>`;
  });

  // 添加未分类书签
  if (uncategorized.length > 0) {
    html += `
        <div class="category">
            <div class="category-header">
                📄 未分类 (${uncategorized.length})
            </div>`;
    
    uncategorized.forEach(bookmark => {
      const visitInfo = bookmark.visit_count > 0 ? `访问${bookmark.visit_count}次` : '';
      html += `
            <div class="bookmark">
                <img src="${bookmark.favicon_url || '/favicon.ico'}" alt="" class="favicon" onerror="this.style.display='none'">
                <div class="bookmark-info">
                    <a href="${bookmark.url}" class="bookmark-title" target="_blank">${bookmark.title}</a>
                    <div class="bookmark-url">${bookmark.url}</div>
                    ${bookmark.description ? `<div class="bookmark-url">${bookmark.description}</div>` : ''}
                </div>
                <div class="bookmark-meta">${visitInfo}</div>
            </div>`;
    });
    
    html += `</div>`;
  }

  html += `
    </div>
</body>
</html>`;

  return html;
}
