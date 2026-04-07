// 全局中间件 - 处理CORS和基础安全
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // 获取请求来源
  const origin = request.headers.get('Origin');
  const host = request.headers.get('Host');
  
  // 允许的域名列表（包括本地开发和生产域名）
  const allowedOrigins = [
    `https://${host}`, // 当前域名
    `http://${host}`,  // HTTP版本（仅本地开发）
    'http://localhost:8788', // 本地开发
    'http://127.0.0.1:8788', // 本地开发
    // 可以在这里添加其他允许的域名
  ];

  // 如果是本地开发环境，允许localhost和127.0.0.1的所有端口
  const isLocalDev = host?.includes('localhost') || host?.includes('127.0.0.1');
  const isValidOrigin = isLocalDev ? 
    (origin?.includes('localhost') || origin?.includes('127.0.0.1')) :
    allowedOrigins.includes(origin);

  // CORS 配置
  const corsHeaders = {
    'Access-Control-Allow-Origin': isValidOrigin ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    // 安全头
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // 安全检查：拒绝可疑的请求
  const userAgent = request.headers.get('User-Agent') || '';
  const isSuspicious = userAgent.includes('curl') && !isLocalDev; // 生产环境拒绝curl请求

  if (isSuspicious) {
    return new Response(JSON.stringify({
      success: false,
      error: '访问被拒绝'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  // 处理实际请求
  try {
    const response = await next();
    
    // 为所有响应添加安全头和CORS头
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        ...corsHeaders
      }
    });

    return newResponse;
  } catch (error) {
    console.error('中间件错误:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: '服务器内部错误'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
