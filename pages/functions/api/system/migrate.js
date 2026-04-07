// 数据库迁移API
import { authenticateRequest } from '../auth/verify.js';

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

    console.log('开始数据库迁移...');

    // 检查是否已经有keep_status字段
    try {
      const testQuery = await env.BOOKMARKS_DB
        .prepare('SELECT keep_status FROM bookmarks LIMIT 1')
        .first();
      
      console.log('keep_status字段已存在，跳过迁移');
      return new Response(JSON.stringify({
        success: true,
        message: 'keep_status字段已存在，无需迁移'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.log('keep_status字段不存在，开始添加...');
    }

    // 添加keep_status字段
    await env.BOOKMARKS_DB
      .prepare(`ALTER TABLE bookmarks ADD COLUMN keep_status TEXT DEFAULT 'normal'`)
      .run();

    console.log('keep_status字段添加成功');

    // 创建索引
    try {
      await env.BOOKMARKS_DB
        .prepare(`CREATE INDEX IF NOT EXISTS idx_bookmarks_keep_status ON bookmarks(keep_status)`)
        .run();
      console.log('keep_status索引创建成功');
    } catch (indexError) {
      console.log('索引创建失败（可能已存在）:', indexError.message);
    }

    // 验证迁移结果
    const testResult = await env.BOOKMARKS_DB
      .prepare('SELECT keep_status FROM bookmarks LIMIT 1')
      .first();

    console.log('迁移验证成功');

    return new Response(JSON.stringify({
      success: true,
      message: 'keep_status字段添加成功',
      data: {
        migrated: true,
        fieldAdded: 'keep_status'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('数据库迁移失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '数据库迁移失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
