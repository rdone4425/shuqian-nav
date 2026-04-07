// JWT令牌验证工具
import { jwtVerify } from 'jose';
import { JWTKeyManager } from '../../utils/jwt-manager.js';

// 验证JWT令牌的工具函数
export async function verifyToken(token, env) {
  try {
    // 获取JWT密钥
    const secret = await JWTKeyManager.getJWTSecret(env);
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 从请求中提取并验证JWT令牌或密码
export async function authenticateRequest(request, env) {
  // 优先从Authorization头获取令牌
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.replace('Bearer ', '');

  // 如果头部没有令牌，尝试从URL参数获取
  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get('token');

    // 如果没有token参数，检查是否有password参数（仅用于备份等特殊API）
    if (!token) {
      const password = url.searchParams.get('password');
      if (password) {
        // 验证密码 - 优先环境变量，然后数据库
        let adminPassword = env.ADMIN_PASSWORD;
        
        if (!adminPassword) {
          try {
            const configResult = await env.BOOKMARKS_DB
              .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
              .bind('admin_password')
              .first();
            adminPassword = configResult?.config_value;
          } catch (dbError) {
            console.error('从数据库读取密码失败:', dbError);
          }
        }
        
        // 强制要求密码配置，不接受默认密码
        if (!adminPassword || adminPassword === 'admin123') {
          return { authenticated: false, error: '系统配置错误：未设置安全密码' };
        }
        
        if (password === adminPassword) {
          return { authenticated: true, payload: { sub: 'admin', type: 'password-auth' } };
        } else {
          return { authenticated: false, error: '密码错误' };
        }
      }
    }
  }

  if (!token) {
    return { authenticated: false, error: '缺少认证令牌' };
  }

  const verification = await verifyToken(token, env);

  if (!verification.valid) {
    return { authenticated: false, error: '无效的认证令牌' };
  }

  return { authenticated: true, payload: verification.payload };
}

// 验证API端点
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '令牌有效',
      user: auth.payload
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('令牌验证错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '验证失败',
      details: '服务器内部错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
