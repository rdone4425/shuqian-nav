/**
 * 清除示例数据API
 * 删除预设的示例书签和分类，保留用户添加的数据
 */

import { authenticateRequest } from '../auth/verify.js';

// 预设示例数据的URL列表（用于识别和删除）
const SAMPLE_URLS = [
  'https://github.com',
  'https://stackoverflow.com',
  'https://developer.mozilla.org',
  'https://cloudflare.com',
  'https://youtube.com',
  'https://reddit.com',
  'https://amazon.com',
  'https://google.com'
];

// 预设分类名称列表
const SAMPLE_CATEGORIES = [
  '工具',
  '学习', 
  '娱乐',
  '新闻',
  '社交',
  '购物',
  '其他'
];

export async function onRequestPost(context) {
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

    // 开始事务
    const results = await db.batch([
      // 1. 删除示例书签（基于URL匹配）
      db.prepare(`
        DELETE FROM bookmarks 
        WHERE url IN (${SAMPLE_URLS.map(() => '?').join(',')})
      `).bind(...SAMPLE_URLS),
      
      // 2. 删除示例分类（基于名称匹配，但只删除没有用户书签的分类）
      db.prepare(`
        DELETE FROM categories 
        WHERE name IN (${SAMPLE_CATEGORIES.map(() => '?').join(',')})
        AND id NOT IN (
          SELECT DISTINCT category_id 
          FROM bookmarks 
          WHERE category_id IS NOT NULL
        )
      `).bind(...SAMPLE_CATEGORIES),
      
      // 3. 清理孤立的已删除书签记录
      db.prepare(`
        DELETE FROM deleted_bookmarks 
        WHERE url IN (${SAMPLE_URLS.map(() => '?').join(',')})
      `).bind(...SAMPLE_URLS)
    ]);

    // 统计删除的数量
    let deletedBookmarks = 0;
    let deletedCategories = 0;
    let deletedRecords = 0;

    if (results && results.length >= 3) {
      deletedBookmarks = results[0].changes || 0;
      deletedCategories = results[1].changes || 0;
      deletedRecords = results[2].changes || 0;
    }

    // 更新系统配置
    await db.prepare(`
      UPDATE system_config 
      SET config_value = 'true' 
      WHERE config_key = 'has_user_data'
    `).run();

    return new Response(JSON.stringify({
      success: true,
      message: '示例数据清除完成',
      data: {
        deletedBookmarks,
        deletedCategories,
        deletedRecords,
        summary: `已删除 ${deletedBookmarks} 个示例书签，${deletedCategories} 个示例分类`
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('清除示例数据失败:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: '清除示例数据失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
