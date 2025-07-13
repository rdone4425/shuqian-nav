// 书签同步API - 支持Chrome插件访问
import { verifyApiToken } from '../auth/token.js';

// 验证API令牌中间件
async function authenticateApiRequest(request, env) {
  const apiToken = request.headers.get('X-API-Token');
  
  if (!apiToken) {
    return { authenticated: false, error: '缺少API访问令牌' };
  }

  const verification = await verifyApiToken(apiToken, env);
  
  if (!verification.valid) {
    return { authenticated: false, error: '无效的API访问令牌' };
  }

  return { authenticated: true, payload: verification.payload };
}

// 批量同步书签
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证API令牌
    const auth = await authenticateApiRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Token'
        }
      });
    }

    const { bookmarks } = await request.json();

    if (!Array.isArray(bookmarks)) {
      return new Response(JSON.stringify({
        success: false,
        error: '书签数据格式错误'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 获取或创建默认分类
    let defaultCategoryId = await getOrCreateDefaultCategory(env);

    for (const bookmark of bookmarks) {
      try {
        // 验证必需字段
        if (!bookmark.title || !bookmark.url) {
          errorCount++;
          errors.push(`书签缺少必需字段: ${bookmark.title || bookmark.url}`);
          continue;
        }

        // 检查是否已存在
        const existing = await env.BOOKMARKS_DB
          .prepare('SELECT id FROM bookmarks WHERE url = ?')
          .bind(bookmark.url)
          .first();

        if (existing) {
          // 书签已存在，跳过
          continue;
        }

        // 处理分类
        let categoryId = defaultCategoryId;
        if (bookmark.category && bookmark.category !== '书签栏') {
          categoryId = await getOrCreateCategory(env, bookmark.category);
        }

        // 生成favicon URL
        const faviconUrl = generateFaviconUrl(bookmark.url);

        // 插入书签
        await env.BOOKMARKS_DB
          .prepare(`INSERT INTO bookmarks (title, url, description, category_id, favicon_url) 
                    VALUES (?, ?, ?, ?, ?)`)
          .bind(
            bookmark.title,
            bookmark.url,
            bookmark.description || '',
            categoryId,
            faviconUrl
          )
          .run();

        successCount++;

      } catch (error) {
        errorCount++;
        errors.push(`处理书签失败 "${bookmark.title}": ${error.message}`);
        console.error('插入书签失败:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        total: bookmarks.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // 只返回前10个错误
      },
      message: `同步完成: 成功 ${successCount} 个，失败 ${errorCount} 个`
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Token'
      }
    });

  } catch (error) {
    console.error('书签同步失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '书签同步失败',
      message: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Token',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 获取或创建默认分类
async function getOrCreateDefaultCategory(env) {
  try {
    // 查找默认分类
    let category = await env.BOOKMARKS_DB
      .prepare('SELECT id FROM categories WHERE name = ?')
      .bind('Chrome同步')
      .first();

    if (!category) {
      // 创建默认分类
      const result = await env.BOOKMARKS_DB
        .prepare('INSERT INTO categories (name, color, description) VALUES (?, ?, ?)')
        .bind('Chrome同步', '#4285F4', 'Chrome浏览器同步的书签')
        .run();
      
      return result.meta.last_row_id;
    }

    return category.id;
  } catch (error) {
    console.error('获取默认分类失败:', error);
    return 1; // 返回第一个分类ID作为后备
  }
}

// 获取或创建分类
async function getOrCreateCategory(env, categoryName) {
  try {
    // 查找现有分类
    let category = await env.BOOKMARKS_DB
      .prepare('SELECT id FROM categories WHERE name = ?')
      .bind(categoryName)
      .first();

    if (!category) {
      // 创建新分类
      const result = await env.BOOKMARKS_DB
        .prepare('INSERT INTO categories (name, color, description) VALUES (?, ?, ?)')
        .bind(categoryName, '#6B7280', `从Chrome同步: ${categoryName}`)
        .run();
      
      return result.meta.last_row_id;
    }

    return category.id;
  } catch (error) {
    console.error('获取分类失败:', error);
    return await getOrCreateDefaultCategory(env);
  }
}

// 生成favicon URL
function generateFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
  }
}
