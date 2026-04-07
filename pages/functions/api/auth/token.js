// API访问令牌管理
import { SignJWT, jwtVerify } from 'jose';
import { authenticateRequest } from './verify.js';

// 生成API访问令牌
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

    const requestData = await request.json();

    // 检查是否为删除操作
    if (requestData.action === 'delete') {
      return await handleDeleteToken(requestData, env);
    }

    // 处理创建token的逻辑
    const { name, description, expiresIn } = requestData;

    if (!name) {
      return new Response(JSON.stringify({
        success: false,
        error: '令牌名称不能为空'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 计算过期时间（默认30天）
    const expireDays = expiresIn || 30;
    const expirationTime = Math.floor(Date.now() / 1000) + (expireDays * 24 * 60 * 60);

    // 生成API令牌
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'default-secret-key');
    const token = await new SignJWT({ 
      sub: 'api-access',
      type: 'api-token',
      name: name,
      description: description || '',
      iat: Math.floor(Date.now() / 1000),
      exp: expirationTime
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret);

    // 存储令牌信息到数据库（可选，用于管理）
    try {
      await env.BOOKMARKS_DB
        .prepare(`INSERT INTO system_config (config_key, config_value, description) 
                  VALUES (?, ?, ?)`)
        .bind(
          `api_token_${Date.now()}`,
          JSON.stringify({
            name,
            description: description || '',
            created: new Date().toISOString(),
            expires: new Date(expirationTime * 1000).toISOString()
          }),
          `API访问令牌: ${name}`
        )
        .run();
    } catch (dbError) {
      console.error('保存令牌信息失败:', dbError);
      // 不影响令牌生成
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        token,
        name,
        description: description || '',
        expiresAt: new Date(expirationTime * 1000).toISOString(),
        expiresIn: `${expireDays}天`
      },
      message: 'API访问令牌生成成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('生成API令牌失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '生成API令牌失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 验证API访问令牌
export async function verifyApiToken(token, env) {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'default-secret-key');
    const { payload } = await jwtVerify(token, secret);
    
    // 检查令牌类型
    if (payload.type !== 'api-token') {
      return { valid: false, error: '无效的令牌类型' };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 获取令牌列表
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

    // 获取所有API令牌信息
    const tokens = await env.BOOKMARKS_DB
      .prepare(`SELECT config_key, config_value, description, created_at 
                FROM system_config 
                WHERE config_key LIKE 'api_token_%' 
                ORDER BY created_at DESC`)
      .all();

    const tokenList = tokens.results.map(row => {
      try {
        const tokenInfo = JSON.parse(row.config_value);
        return {
          id: row.config_key,
          name: tokenInfo.name,
          description: tokenInfo.description,
          created: tokenInfo.created,
          expires: tokenInfo.expires,
          createdAt: row.created_at
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      data: tokenList
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取令牌列表失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取令牌列表失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理删除token的函数
async function handleDeleteToken(requestData, env) {
  try {
    const { tokenId } = requestData;

    if (!tokenId) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少令牌ID参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证tokenId格式（必须是api_token_开头）
    if (!tokenId.startsWith('api_token_')) {
      return new Response(JSON.stringify({
        success: false,
        error: '无效的令牌ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 先获取令牌信息用于返回
    const tokenInfo = await env.BOOKMARKS_DB
      .prepare(`SELECT config_value FROM system_config WHERE config_key = ?`)
      .bind(tokenId)
      .first();

    if (!tokenInfo) {
      return new Response(JSON.stringify({
        success: false,
        error: '令牌不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 删除令牌
    const result = await env.BOOKMARKS_DB
      .prepare(`DELETE FROM system_config WHERE config_key = ?`)
      .bind(tokenId)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '删除失败，令牌可能不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 解析令牌信息用于日志
    let deletedTokenName = '未知';
    try {
      const parsedInfo = JSON.parse(tokenInfo.config_value);
      deletedTokenName = parsedInfo.name || '未知';
    } catch (e) {
      console.warn('解析令牌信息失败:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `API访问令牌 "${deletedTokenName}" 已删除`,
      data: {
        deletedTokenId: tokenId,
        deletedTokenName: deletedTokenName
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('删除API令牌失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除API令牌失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
