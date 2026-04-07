// 书签统计API端点
import { authenticateRequest } from '../auth/verify.js';
import { bookmarkAnalytics } from '../../utils/bookmark-analytics.js';

// 获取使用统计报告
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 验证认证（可选，根据需求决定）
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要登录才能查看统计'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'summary';
    const days = parseInt(url.searchParams.get('days')) || 30;
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    let data;
    
    switch (reportType) {
      case 'popular':
        data = {
          popularBookmarks: bookmarkAnalytics.getPopularBookmarks(limit, days)
        };
        break;
        
      case 'usage':
        data = bookmarkAnalytics.getUsageReport(days);
        break;
        
      case 'search':
        data = {
          searchStats: bookmarkAnalytics.getSearchStatistics(days)
        };
        break;
        
      case 'time':
        data = {
          timeDistribution: bookmarkAnalytics.getTimeDistribution(days)
        };
        break;
        
      case 'export':
        data = bookmarkAnalytics.exportData();
        break;
        
      default:
        // 返回汇总信息
        data = {
          summary: bookmarkAnalytics.getUsageReport(7).summary,
          popularBookmarks: bookmarkAnalytics.getPopularBookmarks(5, 7),
          recentInsights: bookmarkAnalytics.getUsageReport(7).insights.slice(0, 3)
        };
    }

    return new Response(JSON.stringify({
      success: true,
      data: data,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取统计数据失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 记录书签访问
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { bookmarkId, bookmarkData, action } = await request.json();

    if (!bookmarkId) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少bookmarkId参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let result;
    
    switch (action) {
      case 'visit':
        // 记录书签访问
        result = bookmarkAnalytics.recordVisit(bookmarkId, {
          ...bookmarkData,
          userAgent: request.headers.get('User-Agent'),
          referrer: request.headers.get('Referer')
        });
        break;
        
      case 'search':
        // 记录搜索行为
        const { searchTerm, resultCount } = bookmarkData;
        result = bookmarkAnalytics.recordSearch(searchTerm, resultCount);
        break;
        
      default:
        return new Response(JSON.stringify({
          success: false,
          error: '不支持的操作类型'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '统计数据记录成功',
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('记录统计数据失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '记录统计数据失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 管理统计数据
export async function onRequestPut(context) {
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

    const { action, data } = await request.json();

    switch (action) {
      case 'cleanup':
        const daysToKeep = data?.daysToKeep || 90;
        bookmarkAnalytics.cleanup(daysToKeep);
        break;
        
      case 'import':
        if (data?.analytics) {
          bookmarkAnalytics.importData(data.analytics);
        }
        break;
        
      case 'reset':
        // 重置所有统计数据
        bookmarkAnalytics.visits.clear();
        bookmarkAnalytics.dailyStats.clear();
        bookmarkAnalytics.categories.clear();
        bookmarkAnalytics.searchTerms.clear();
        break;
        
      default:
        return new Response(JSON.stringify({
          success: false,
          error: '不支持的管理操作'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '操作完成成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('管理统计数据失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '管理操作失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}