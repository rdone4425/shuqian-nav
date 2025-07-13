// 系统配置API
import { authenticateRequest } from '../auth/verify.js';

// 获取系统配置
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

    // 获取系统配置
    const configs = await env.BOOKMARKS_DB
      .prepare('SELECT config_key, config_value, description FROM system_config ORDER BY config_key')
      .all();

    return new Response(JSON.stringify({
      success: true,
      data: configs.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取系统配置失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取系统配置失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 更新系统配置
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

    const { config_key, config_value } = await request.json();

    if (!config_key) {
      return new Response(JSON.stringify({
        success: false,
        error: '配置键不能为空'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 更新配置
    await env.BOOKMARKS_DB
      .prepare('UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?')
      .bind(config_value, config_key)
      .run();

    return new Response(JSON.stringify({
      success: true,
      message: '配置更新成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('更新系统配置失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '更新系统配置失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
