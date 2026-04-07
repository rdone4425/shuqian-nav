// 书签导入API
import { authenticateRequest } from '../auth/verify.js';

// 获取或创建分类
async function getOrCreateCategory(env, categoryName) {
  if (!categoryName || categoryName === '未分类') {
    return null;
  }

  // 查找现有分类
  const existing = await env.BOOKMARKS_DB
    .prepare('SELECT id FROM categories WHERE name = ?')
    .bind(categoryName)
    .first();

  if (existing) {
    return existing.id;
  }

  // 创建新分类
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const result = await env.BOOKMARKS_DB
    .prepare('INSERT INTO categories (name, color, description) VALUES (?, ?, ?)')
    .bind(categoryName, randomColor, `导入的分类: ${categoryName}`)
    .run();

  return result.meta.last_row_id;
}

// 导入书签
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证认证
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

    const { bookmarks, categories, clearExisting = false, format = 'json' } = await request.json();

    if (!Array.isArray(bookmarks)) {
      return new Response(JSON.stringify({
        success: false,
        error: '书签数据格式错误：bookmarks 必须是数组'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (bookmarks.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '没有可导入的书签数据'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    // 如果选择清除现有数据
    if (clearExisting) {
      console.log('清除现有书签和分类...');
      
      // 删除现有书签
      await env.BOOKMARKS_DB.prepare('DELETE FROM bookmarks').run();
      
      // 删除现有分类（保留系统默认分类）
      await env.BOOKMARKS_DB.prepare('DELETE FROM categories WHERE id > 6').run();
      
      console.log('现有数据已清除');
    }

    // 导入分类（如果提供）
    const categoryMapping = {};
    if (categories && Array.isArray(categories)) {
      for (const category of categories) {
        try {
          if (category.name && category.name !== '未分类') {
            const categoryId = await getOrCreateCategory(env, category.name);
            categoryMapping[category.name] = categoryId;
          }
        } catch (error) {
          console.error(`创建分类失败: ${category.name}`, error);
        }
      }
    }

    // 导入书签
    for (const [index, bookmark] of bookmarks.entries()) {
      try {
        // 验证必需字段
        if (!bookmark.title || typeof bookmark.title !== 'string' || bookmark.title.trim() === '') {
          errorCount++;
          errors.push(`第 ${index + 1} 个书签: 标题不能为空`);
          continue;
        }

        if (!bookmark.url || typeof bookmark.url !== 'string' || bookmark.url.trim() === '') {
          errorCount++;
          errors.push(`第 ${index + 1} 个书签: URL不能为空`);
          continue;
        }

        // 检查URL格式
        try {
          const url = new URL(bookmark.url.trim());
          // 只允许 http 和 https 协议
          if (!['http:', 'https:'].includes(url.protocol)) {
            errorCount++;
            errors.push(`第 ${index + 1} 个书签: 不支持的URL协议 ${url.protocol}`);
            continue;
          }
        } catch {
          errorCount++;
          errors.push(`第 ${index + 1} 个书签: 无效的URL格式 "${bookmark.url}"`);
          continue;
        }

        // 验证标题长度
        if (bookmark.title.length > 200) {
          errorCount++;
          errors.push(`第 ${index + 1} 个书签: 标题过长（最多200字符）`);
          continue;
        }

        // 验证描述长度
        if (bookmark.description && bookmark.description.length > 500) {
          errorCount++;
          errors.push(`第 ${index + 1} 个书签: 描述过长（最多500字符）`);
          continue;
        }

        // 检查是否已存在（除非清除了现有数据）
        if (!clearExisting) {
          const existing = await env.BOOKMARKS_DB
            .prepare('SELECT id FROM bookmarks WHERE url = ?')
            .bind(bookmark.url)
            .first();

          if (existing) {
            skippedCount++;
            continue;
          }
        }

        // 处理分类
        let categoryId = null;
        if (bookmark.category_name || bookmark.category) {
          const categoryName = bookmark.category_name || bookmark.category;
          categoryId = categoryMapping[categoryName] || await getOrCreateCategory(env, categoryName);
        }

        // 生成favicon URL
        const domain = new URL(bookmark.url).hostname;
        const faviconUrl = bookmark.favicon_url || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

        // 插入书签
        const result = await env.BOOKMARKS_DB.prepare(`
          INSERT INTO bookmarks (title, url, description, category_id, favicon_url, keep_status)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          bookmark.title,
          bookmark.url,
          bookmark.description || null,
          categoryId,
          faviconUrl,
          bookmark.keep_status || 'normal'
        ).run();

        if (result.success) {
          importedCount++;
        } else {
          errorCount++;
          errors.push(`插入书签失败: ${bookmark.title}`);
        }

      } catch (error) {
        errorCount++;
        errors.push(`处理书签失败: ${bookmark.title || bookmark.url} - ${error.message}`);
        console.error('导入书签错误:', error);
      }
    }

    // 标记系统为已有用户数据
    await env.BOOKMARKS_DB.prepare(`
      INSERT OR REPLACE INTO system_config (config_key, config_value, description) 
      VALUES (?, ?, ?)
    `).bind(
      'has_user_data',
      'true',
      '系统是否包含用户导入的数据'
    ).run();

    console.log(`导入完成: ${importedCount} 成功, ${skippedCount} 跳过, ${errorCount} 失败`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        imported: importedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: bookmarks.length,
        errorDetails: errors.slice(0, 10) // 只返回前10个错误
      },
      message: `导入完成: ${importedCount} 个书签导入成功${skippedCount > 0 ? `, ${skippedCount} 个已存在` : ''}${errorCount > 0 ? `, ${errorCount} 个失败` : ''}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('导入书签失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '导入失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
