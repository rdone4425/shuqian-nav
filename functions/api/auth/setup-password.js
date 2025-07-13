// 初始密码设置API - 仅用于全新部署
import { JWTKeyManager } from '../../utils/jwt-manager.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 确保JWT密钥存在（自动生成如果不存在）
    try {
      await JWTKeyManager.getJWTSecret(env);
    } catch (error) {
      console.error('JWT密钥初始化失败:', error);
      return new Response(JSON.stringify({
        success: false,
        error: '系统配置初始化失败',
        details: '无法生成JWT密钥'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { password, confirmPassword } = await request.json();

    // 验证输入
    if (!password || !confirmPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码和确认密码都是必填的'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password !== confirmPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码和确认密码不匹配'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 强密码检查
    if (password.length < 8) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码长度至少为8位'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (!(hasUpper && hasLower && hasNumber)) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码必须包含大写字母、小写字母和数字'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 拒绝常见弱密码
    const commonPasswords = [
      'password', '12345678', 'admin123', 'password123', 
      'qwerty123', 'abc12345', '123456789', 'password1'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      return new Response(JSON.stringify({
        success: false,
        error: '不能使用常见密码，请选择更安全的密码'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查是否已经设置过密码
    let existingPassword = null;
    
    // 检查环境变量
    if (env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({
        success: false,
        error: '系统已通过环境变量配置密码',
        details: '请移除ADMIN_PASSWORD环境变量后重试'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查数据库
    try {
      const configResult = await env.BOOKMARKS_DB
        .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
        .bind('admin_password')
        .first();

      existingPassword = configResult?.config_value;
      
      if (existingPassword && existingPassword !== 'admin123') {
        return new Response(JSON.stringify({
          success: false,
          error: '系统已设置密码',
          details: '如需修改密码，请登录后在设置中修改'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (dbError) {
      console.error('数据库访问失败:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: '数据库访问失败'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 设置新密码
    try {
      await env.BOOKMARKS_DB
        .prepare('INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .bind('admin_password', password, '管理员密码（初始设置）')
        .run();

      return new Response(JSON.stringify({
        success: true,
        message: '初始密码设置成功！您现在可以使用新密码登录系统。',
        redirectToLogin: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('设置初始密码失败:', error);
      return new Response(JSON.stringify({
        success: false,
        error: '设置密码失败'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('初始密码设置错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '服务器内部错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 检查是否需要初始密码设置
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 如果设置了环境变量密码，不需要初始设置
    if (env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({
        needsSetup: false,
        reason: 'environment_configured'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查数据库中的密码
    try {
      const configResult = await env.BOOKMARKS_DB
        .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
        .bind('admin_password')
        .first();

      const dbPassword = configResult?.config_value;
      
      // 如果没有密码或者是默认密码，需要设置
      const needsSetup = !dbPassword || dbPassword === 'admin123';
      
      return new Response(JSON.stringify({
        needsSetup: needsSetup,
        reason: needsSetup ? 
          (!dbPassword ? 'no_password' : 'default_password') : 
          'already_configured'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('数据库访问失败:', dbError);
      return new Response(JSON.stringify({
        needsSetup: true,
        reason: 'database_error'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('检查初始设置状态错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '服务器内部错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}