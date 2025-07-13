// 性能监控API端点
import { authenticateRequest } from '../auth/verify.js';
import { performanceMonitor } from '../../utils/performance-monitor.js';

// 获取性能报告
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

    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'summary';
    const timeRange = url.searchParams.get('range') || '24h';

    let report;
    switch (reportType) {
      case 'detailed':
        report = performanceMonitor.getPerformanceReport();
        break;
      case 'alerts':
        report = {
          alerts: performanceMonitor.alerts.slice(-100),
          summary: {
            totalAlerts: performanceMonitor.alerts.length,
            recentAlerts: performanceMonitor.alerts.filter(alert => 
              new Date(alert.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
            ).length
          }
        };
        break;
      case 'export':
        report = performanceMonitor.exportMetrics();
        break;
      default:
        report = performanceMonitor.getPerformanceReport();
    }

    return new Response(JSON.stringify({
      success: true,
      data: report,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('获取性能报告失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取性能报告失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 配置性能监控
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

    const { action, data } = await request.json();

    switch (action) {
      case 'update_thresholds':
        if (data.responseTime) {
          performanceMonitor.thresholds.responseTime = data.responseTime;
        }
        if (data.errorRate) {
          performanceMonitor.thresholds.errorRate = data.errorRate;
        }
        if (data.memoryUsage) {
          performanceMonitor.thresholds.memoryUsage = data.memoryUsage;
        }
        break;

      case 'clear_alerts':
        performanceMonitor.alerts = [];
        break;

      case 'cleanup':
        const daysToKeep = data.daysToKeep || 7;
        performanceMonitor.cleanup(daysToKeep);
        break;

      case 'import_metrics':
        if (data.metrics) {
          performanceMonitor.importMetrics(data.metrics);
        }
        break;

      default:
        return new Response(JSON.stringify({
          success: false,
          error: '不支持的操作'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '配置更新成功',
      currentThresholds: performanceMonitor.thresholds
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('配置性能监控失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '配置失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 手动记录性能数据（用于测试）
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

    const { endpoint, startTime, endTime, status, error } = await request.json();

    if (!endpoint || !startTime || !endTime || !status) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数: endpoint, startTime, endTime, status'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const metric = performanceMonitor.recordApiCall(
      endpoint, 
      startTime, 
      endTime, 
      status, 
      error ? new Error(error) : null
    );

    return new Response(JSON.stringify({
      success: true,
      message: '性能数据记录成功',
      metric: {
        endpoint: metric.endpoint,
        totalCalls: metric.totalCalls,
        avgResponseTime: metric.avgResponseTime,
        errorRate: metric.errorRate
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('记录性能数据失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '记录失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}