// 健康检查API
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 测试数据库连接
    let dbStatus = 'unknown';
    let dbError = null;
    
    try {
      const result = await env.BOOKMARKS_DB.prepare('SELECT 1 as test').first();
      dbStatus = result ? 'connected' : 'error';
    } catch (error) {
      dbStatus = 'error';
      dbError = error.message;
    }

    // 检查环境变量配置
    const configStatus = {
      adminPassword: !!env.ADMIN_PASSWORD,
      jwtSecret: !!env.JWT_SECRET,
      database: !!env.BOOKMARKS_DB
    };

    const healthData = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        status: dbStatus,
        error: dbError
      },
      config: configStatus,
      environment: env.ENVIRONMENT || 'development'
    };

    // 如果数据库连接失败，返回警告状态
    if (dbStatus === 'error') {
      healthData.status = 'warning';
      healthData.message = '数据库连接异常';
    }

    return new Response(JSON.stringify(healthData), {
      status: dbStatus === 'error' ? 503 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token'
      }
    });

  } catch (error) {
    console.error('健康检查错误:', error);
    
    return new Response(JSON.stringify({
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: '健康检查失败',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token'
      }
    });
  }
}

// 处理OPTIONS预检请求
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
      'Access-Control-Max-Age': '86400'
    }
  });
}
