// 流式链接检查API - 实时返回检查结果
import { authenticateRequest } from '../auth/verify.js';
import { insertDeletedBookmarkSafe } from '../../utils/deleted-bookmarks.js';

// 检查单个URL的可访问性 - 优化版本，更好地处理Cloudflare等防护
async function checkUrl(url, timeout = 8000) {
  // 更真实的浏览器User-Agent
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  // 通用请求头，模拟真实浏览器
  const commonHeaders = {
    'User-Agent': randomUserAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
  };

  try {
    // 第一次尝试：HEAD请求（快速检查）
    const headResponse = await Promise.race([
      fetch(url, {
        method: 'HEAD',
        headers: commonHeaders
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('HEAD request timeout')), 3000); // 3秒超时
      })
    ]);

    // HEAD请求成功且状态正常
    if (headResponse.ok) {
      return {
        url,
        accessible: true,
        status: headResponse.status,
        statusText: headResponse.statusText,
        error: null,
        method: 'HEAD',
        checkedAt: new Date().toISOString()
      };
    }

    // HEAD请求返回错误状态，但可能是服务器不支持HEAD，继续尝试GET
    if (headResponse.status >= 400) {
      console.log(`HEAD请求返回 ${headResponse.status}，尝试GET请求: ${url}`);
    }

  } catch (headError) {
    console.log(`HEAD请求失败，尝试GET请求: ${url}`, headError.message);
  }

  try {
    // 第二次尝试：GET请求（更完整的检查）
    const getResponse = await Promise.race([
      fetch(url, {
        method: 'GET',
        headers: commonHeaders
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('GET request timeout')), 5000); // 5秒超时
      })
    ]);

    // 检查响应状态
    const isAccessible = isResponseAccessible(getResponse);

    return {
      url,
      accessible: isAccessible,
      status: getResponse.status,
      statusText: getResponse.statusText,
      error: isAccessible ? null : getErrorMessage(getResponse),
      method: 'GET',
      checkedAt: new Date().toISOString()
    };

  } catch (getError) {
    // 最终失败，返回错误信息
    return {
      url,
      accessible: false,
      status: 0,
      statusText: 'Network Error',
      error: categorizeError(getError.message),
      method: 'FAILED',
      checkedAt: new Date().toISOString()
    };
  }
}

// 判断响应是否表示网站可访问
function isResponseAccessible(response) {
  // 2xx 状态码表示成功
  if (response.status >= 200 && response.status < 300) {
    return true;
  }

  // 3xx 重定向也认为是可访问的
  if (response.status >= 300 && response.status < 400) {
    return true;
  }

  // 特殊情况：Cloudflare的挑战页面
  if (response.status === 403 || response.status === 503) {
    const server = response.headers.get('server') || '';
    const cfRay = response.headers.get('cf-ray');

    // 如果是Cloudflare服务器返回的403/503，可能是防护机制，不一定是网站失效
    if (server.toLowerCase().includes('cloudflare') || cfRay) {
      return true; // 认为网站存在，只是有防护
    }
  }

  // 401 未授权也认为网站存在，只是需要登录
  if (response.status === 401) {
    return true;
  }

  // 其他4xx和5xx错误
  return false;
}

// 获取错误信息
function getErrorMessage(response) {
  const server = response.headers.get('server') || '';
  const cfRay = response.headers.get('cf-ray');

  switch (response.status) {
    case 403:
      if (server.toLowerCase().includes('cloudflare') || cfRay) {
        return 'Cloudflare防护 - 网站正常但有访问限制';
      }
      return '访问被禁止';
    case 404:
      return '页面不存在';
    case 410:
      return '页面已永久删除';
    case 429:
      return '请求过于频繁';
    case 500:
      return '服务器内部错误';
    case 502:
      return '网关错误';
    case 503:
      if (server.toLowerCase().includes('cloudflare') || cfRay) {
        return 'Cloudflare防护 - 网站可能正在维护';
      }
      return '服务暂时不可用';
    case 504:
      return '网关超时';
    default:
      return `HTTP ${response.status} ${response.statusText}`;
  }
}

// 分类网络错误
function categorizeError(errorMessage) {
  const message = errorMessage.toLowerCase();

  if (message.includes('timeout')) {
    return '请求超时 - 网站响应缓慢';
  }
  if (message.includes('enotfound') || message.includes('name not resolved')) {
    return '域名不存在';
  }
  if (message.includes('econnrefused')) {
    return '连接被拒绝';
  }
  if (message.includes('cert') || message.includes('certificate')) {
    return 'SSL证书问题';
  }
  if (message.includes('network')) {
    return '网络连接问题';
  }

  return `网络错误: ${errorMessage}`;
}

// 获取所有书签用于检查
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

    // 检查是否有用户数据
    const hasUserData = await env.BOOKMARKS_DB
      .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
      .bind('has_user_data')
      .first();

    // 获取书签列表（如果有用户数据，排除预设书签）
    let bookmarksQuery = `
      SELECT b.id, b.title, b.url, COALESCE(b.keep_status, 'normal') as keep_status,
             b.created_at, c.name as category_name, c.color as category_color
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
    `;

    // 如果有用户数据，排除预设书签
    if (hasUserData && hasUserData.config_value === 'true') {
      const presetUrls = [
        'https://github.com',
        'https://stackoverflow.com',
        'https://developer.mozilla.org',
        'https://youtube.com',
        'https://twitter.com',
        'https://reddit.com',
        'https://amazon.com',
        'https://google.com'
      ];

      const placeholders = presetUrls.map(() => '?').join(',');
      bookmarksQuery += ` WHERE b.url NOT IN (${placeholders})`;
    }

    bookmarksQuery += ` ORDER BY b.id DESC`;

    const bookmarks = hasUserData && hasUserData.config_value === 'true'
      ? await env.BOOKMARKS_DB.prepare(bookmarksQuery).bind(
          'https://github.com',
          'https://stackoverflow.com',
          'https://developer.mozilla.org',
          'https://youtube.com',
          'https://twitter.com',
          'https://reddit.com',
          'https://amazon.com',
          'https://google.com'
        ).all()
      : await env.BOOKMARKS_DB.prepare(bookmarksQuery).all();

    return new Response(JSON.stringify({
      success: true,
      data: bookmarks.results.map(bookmark => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        category: bookmark.category_name || '未分类',
        categoryColor: bookmark.category_color || '#6B7280',
        keepStatus: bookmark.keep_status || 'normal', // 如果字段不存在，默认为normal
        createdAt: bookmark.created_at,
        status: 'pending', // 初始状态
        checked: false
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取书签列表失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取书签列表失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 检查单个书签
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

    const { bookmarkId, url, autoDelete = false } = await request.json();

    if (!bookmarkId || !url) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查URL
    const result = await checkUrl(url);
    
    let deleted = false;
    let deleteError = null;

    // 如果启用自动删除且链接不可访问，则删除书签
    if (autoDelete && !result.accessible) {
      try {
        // 先获取书签信息
        const bookmark = await env.BOOKMARKS_DB.prepare(`
          SELECT b.*, c.name as category_name
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE b.id = ?
        `).bind(bookmarkId).first();

        if (bookmark) {
          // 保存删除记录
          await insertDeletedBookmarkSafe(env, bookmark, {
            deleteReason: 'link_check_failed',
            checkStatus: 'failed',
            statusCode: result.status,
            statusText: result.statusText,
            errorMessage: result.error,
            deletedBy: 'system'
          });

          // 删除书签
          await env.BOOKMARKS_DB
            .prepare('DELETE FROM bookmarks WHERE id = ?')
            .bind(bookmarkId)
            .run();
          deleted = true;
        }
      } catch (error) {
        deleteError = error.message;
        console.error(`删除书签失败 (ID: ${bookmarkId}):`, error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        bookmarkId,
        ...result,
        deleted,
        deleteError
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('检查链接失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '检查链接失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
