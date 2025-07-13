// 分类管理API
import { authenticateRequest } from '../auth/verify.js';
import { ResponseHelper } from '../../utils/response-helper.js';

// 获取所有分类
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 获取分类列表，包含每个分类的书签数量
    const categories = await env.BOOKMARKS_DB.prepare(`
      SELECT 
        c.id,
        c.name,
        c.color,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(b.id) as bookmark_count
      FROM categories c
      LEFT JOIN bookmarks b ON c.id = b.category_id
      GROUP BY c.id, c.name, c.color, c.description, c.created_at, c.updated_at
      ORDER BY c.name ASC
    `).all();

    return ResponseHelper.success(categories.results || []);

  } catch (error) {
    return ResponseHelper.serverError('获取分类列表失败', error.message);
  }
}

// 创建新分类
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证认证
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const { name, color, description } = await request.json();

    // 验证必填字段
    if (!name) {
      return ResponseHelper.validationError('分类名称是必填字段');
    }

    // 检查分类名称是否已存在
    const existingCategory = await env.BOOKMARKS_DB.prepare(
      'SELECT id FROM categories WHERE name = ?'
    ).bind(name).first();

    if (existingCategory) {
      return ResponseHelper.businessError('分类名称已存在');
    }

    // 插入新分类
    const result = await env.BOOKMARKS_DB.prepare(`
      INSERT INTO categories (name, color, description)
      VALUES (?, ?, ?)
    `).bind(name, color || '#3B82F6', description || null).run();

    if (result.success) {
      // 获取新创建的分类
      const newCategory = await env.BOOKMARKS_DB.prepare(`
        SELECT 
          c.id,
          c.name,
          c.color,
          c.description,
          c.created_at,
          c.updated_at,
          0 as bookmark_count
        FROM categories c
        WHERE c.id = ?
      `).bind(result.meta.last_row_id).first();

      return new Response(JSON.stringify({
        success: true,
        data: newCategory,
        message: '分类创建成功'
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('数据库插入失败');
    }

  } catch (error) {
    console.error('创建分类错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '创建分类失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
