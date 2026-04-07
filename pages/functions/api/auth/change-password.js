// 修改密码API
import { authenticateRequest } from './verify.js';

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

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    // 验证输入
    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '所有字段都是必填的'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (newPassword !== confirmPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '新密码和确认密码不匹配'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        error: '新密码长度至少为6位'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查新密码强度
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    
    if (newPassword.length < 8 || !(hasUpper && hasLower && hasNumber)) {
      return new Response(JSON.stringify({
        success: false,
        error: '新密码至少8位，必须包含大写字母、小写字母和数字'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查是否使用了环境变量密码
    if (env.ADMIN_PASSWORD) {
      // 如果设置了环境变量密码，需要验证当前密码是否匹配
      if (currentPassword !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({
          success: false,
          error: '当前密码错误'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 环境变量密码无法通过界面修改，但可以迁移到数据库
      await env.BOOKMARKS_DB
        .prepare('INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .bind('admin_password', newPassword, '管理员密码（从环境变量迁移）')
        .run();

      return new Response(JSON.stringify({
        success: true,
        message: '密码已更新！请移除 ADMIN_PASSWORD 环境变量以启用界面密码管理',
        migrationNote: '密码已保存到数据库，建议移除环境变量以便日后通过界面修改'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 处理数据库密码
    let correctPassword = null;
    try {
      const configResult = await env.BOOKMARKS_DB
        .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
        .bind('admin_password')
        .first();

      correctPassword = configResult?.config_value;
    } catch (dbError) {
      console.error('从数据库读取密码失败:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: '数据库访问失败'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证当前密码
    if (currentPassword !== correctPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '当前密码错误'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查新密码是否与当前密码相同
    if (newPassword === correctPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '新密码不能与当前密码相同'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 更新数据库中的密码
    const result = await env.BOOKMARKS_DB
      .prepare('UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?')
      .bind(newPassword, 'admin_password')
      .run();

    if (result.changes === 0) {
      // 如果没有更新任何行，尝试插入
      await env.BOOKMARKS_DB
        .prepare('INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .bind('admin_password', newPassword, '管理员密码')
        .run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: '密码修改成功！'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('修改密码失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '修改密码失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
