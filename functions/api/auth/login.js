// 登录认证API
import { SignJWT } from 'jose';
import { JWTKeyManager } from '../../utils/jwt-manager.js';
import { ResponseHelper } from '../../utils/response-helper.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();

    // 获取JWT密钥（自动生成如果不存在）
    let jwtSecret;
    try {
      jwtSecret = await JWTKeyManager.getJWTSecret(env);
    } catch (error) {
      console.error('获取JWT密钥失败:', error);
      return ResponseHelper.serverError('系统初始化失败', '无法获取或生成JWT密钥');
    }

    let correctPassword = null;
    let passwordSource = '';
    let isUsingDefaultPassword = false; // 添加到这里

    // 认证优先级：
    // 1. 环境变量（管理员密码，最高优先级）
    // 2. 数据库密码（日常使用）
    
    if (env.ADMIN_PASSWORD) {
      correctPassword = env.ADMIN_PASSWORD;
      passwordSource = 'environment';
    } else {
      // 从数据库读取密码
      try {
        const configResult = await env.BOOKMARKS_DB
          .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
          .bind('admin_password')
          .first();

        correctPassword = configResult?.config_value;
        passwordSource = 'database';
        
        // 检查是否是默认密码，允许登录但标记状态
        if (correctPassword === 'admin123') {
          isUsingDefaultPassword = true;
        }
      } catch (dbError) {
        console.error('从数据库读取密码失败:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: '数据库连接失败',
          details: '无法验证身份，请检查数据库配置'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 如果没有找到密码，说明是全新部署
    if (!correctPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '系统未初始化',
        details: '请先设置管理员密码',
        requireInitialSetup: true
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!password || password !== correctPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: '密码错误'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 生成JWT令牌
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ 
      sub: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时过期
      passwordSource: passwordSource, // 记录密码来源
      isDefaultPassword: isUsingDefaultPassword || false // 标记是否使用默认密码
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret);

    return new Response(JSON.stringify({
      success: true,
      token: token,
      message: isUsingDefaultPassword ? '登录成功，建议尽快修改默认密码' : '登录成功',
      passwordSource: passwordSource,
      isDefaultPassword: isUsingDefaultPassword || false, // 前端需要知道这个状态
      canChangePassword: passwordSource === 'database', // 只有数据库密码可以通过界面修改
      jwtSource: env.JWT_SECRET ? 'environment' : 'database' // 显示JWT密钥来源
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('登录错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '登录失败',
      details: '服务器内部错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
