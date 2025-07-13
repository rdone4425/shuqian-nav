// API性能监控工具
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.thresholds = {
      responseTime: 2000, // 2秒响应时间阈值
      errorRate: 0.05,    // 5%错误率阈值
      memoryUsage: 0.8    // 80%内存使用率阈值
    };
  }

  // 记录API调用性能
  recordApiCall(endpoint, startTime, endTime, status, error = null) {
    const duration = endTime - startTime;
    const key = this.getMetricKey(endpoint);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        endpoint,
        totalCalls: 0,
        totalDuration: 0,
        errorCount: 0,
        lastCall: null,
        recentCalls: [],
        avgResponseTime: 0,
        errorRate: 0
      });
    }

    const metric = this.metrics.get(key);
    metric.totalCalls++;
    metric.totalDuration += duration;
    metric.lastCall = new Date().toISOString();
    
    if (status >= 400 || error) {
      metric.errorCount++;
    }

    // 保留最近100次调用的详细信息
    metric.recentCalls.push({
      timestamp: new Date().toISOString(),
      duration,
      status,
      error: error?.message || null
    });

    if (metric.recentCalls.length > 100) {
      metric.recentCalls.shift();
    }

    // 更新统计数据
    metric.avgResponseTime = metric.totalDuration / metric.totalCalls;
    metric.errorRate = metric.errorCount / metric.totalCalls;

    // 检查是否需要告警
    this.checkAlerts(endpoint, metric, duration, status, error);

    return metric;
  }

  // 检查告警条件
  checkAlerts(endpoint, metric, duration, status, error) {
    const alerts = [];

    // 响应时间告警
    if (duration > this.thresholds.responseTime) {
      alerts.push({
        type: 'slow_response',
        severity: 'warning',
        endpoint,
        message: `API响应时间超过阈值: ${duration}ms > ${this.thresholds.responseTime}ms`,
        timestamp: new Date().toISOString(),
        value: duration
      });
    }

    // 错误率告警
    if (metric.errorRate > this.thresholds.errorRate && metric.totalCalls > 10) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'error',
        endpoint,
        message: `API错误率过高: ${(metric.errorRate * 100).toFixed(2)}% > ${(this.thresholds.errorRate * 100)}%`,
        timestamp: new Date().toISOString(),
        value: metric.errorRate
      });
    }

    // 添加到告警列表
    this.alerts.push(...alerts);

    // 限制告警历史数量
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }

    return alerts;
  }

  // 获取性能报告
  getPerformanceReport() {
    const report = {
      summary: {
        totalEndpoints: this.metrics.size,
        totalCalls: 0,
        avgResponseTime: 0,
        overallErrorRate: 0,
        generatedAt: new Date().toISOString()
      },
      endpoints: [],
      alerts: this.alerts.slice(-50), // 最近50个告警
      recommendations: []
    };

    let totalCalls = 0;
    let totalDuration = 0;
    let totalErrors = 0;

    for (const [key, metric] of this.metrics) {
      totalCalls += metric.totalCalls;
      totalDuration += metric.totalDuration;
      totalErrors += metric.errorCount;

      const endpointReport = {
        endpoint: metric.endpoint,
        totalCalls: metric.totalCalls,
        avgResponseTime: Math.round(metric.avgResponseTime),
        errorRate: Math.round(metric.errorRate * 10000) / 100, // 保留2位小数的百分比
        lastCall: metric.lastCall,
        status: this.getEndpointStatus(metric),
        recentPerformance: this.getRecentPerformance(metric)
      };

      report.endpoints.push(endpointReport);
    }

    // 计算总体统计
    if (totalCalls > 0) {
      report.summary.totalCalls = totalCalls;
      report.summary.avgResponseTime = Math.round(totalDuration / totalCalls);
      report.summary.overallErrorRate = Math.round((totalErrors / totalCalls) * 10000) / 100;
    }

    // 生成优化建议
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  // 获取端点状态
  getEndpointStatus(metric) {
    if (metric.errorRate > this.thresholds.errorRate) {
      return 'error';
    }
    if (metric.avgResponseTime > this.thresholds.responseTime) {
      return 'warning';
    }
    return 'healthy';
  }

  // 获取最近性能趋势
  getRecentPerformance(metric) {
    if (metric.recentCalls.length < 5) {
      return 'insufficient_data';
    }

    const recent = metric.recentCalls.slice(-10);
    const avgRecent = recent.reduce((sum, call) => sum + call.duration, 0) / recent.length;
    const earlier = metric.recentCalls.slice(-20, -10);
    
    if (earlier.length === 0) return 'stable';
    
    const avgEarlier = earlier.reduce((sum, call) => sum + call.duration, 0) / earlier.length;
    const changePercent = ((avgRecent - avgEarlier) / avgEarlier) * 100;

    if (changePercent > 20) return 'degrading';
    if (changePercent < -20) return 'improving';
    return 'stable';
  }

  // 生成优化建议
  generateRecommendations(report) {
    const recommendations = [];

    // 检查慢接口
    const slowEndpoints = report.endpoints.filter(ep => ep.avgResponseTime > this.thresholds.responseTime);
    if (slowEndpoints.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: '优化慢接口',
        description: `发现 ${slowEndpoints.length} 个接口响应时间过慢`,
        endpoints: slowEndpoints.map(ep => ep.endpoint),
        suggestions: [
          '检查数据库查询是否需要优化',
          '考虑添加缓存层',
          '检查是否有N+1查询问题',
          '优化数据序列化过程'
        ]
      });
    }

    // 检查高错误率接口
    const errorEndpoints = report.endpoints.filter(ep => ep.errorRate > this.thresholds.errorRate * 100);
    if (errorEndpoints.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'critical',
        title: '修复高错误率接口',
        description: `发现 ${errorEndpoints.length} 个接口错误率过高`,
        endpoints: errorEndpoints.map(ep => ep.endpoint),
        suggestions: [
          '检查错误日志定位问题根因',
          '添加更好的错误处理',
          '增加输入验证',
          '考虑添加重试机制'
        ]
      });
    }

    // 总体性能建议
    if (report.summary.avgResponseTime > 1000) {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        title: '整体性能优化',
        description: '系统整体响应时间可以进一步优化',
        suggestions: [
          '启用HTTP/2',
          '使用CDN加速静态资源',
          '优化数据库连接池',
          '实现API响应缓存'
        ]
      });
    }

    return recommendations;
  }

  // 清理旧数据
  cleanup(daysToKeep = 7) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    for (const [key, metric] of this.metrics) {
      metric.recentCalls = metric.recentCalls.filter(call => 
        new Date(call.timestamp).getTime() > cutoffTime
      );
    }

    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoffTime
    );
  }

  // 获取度量键
  getMetricKey(endpoint) {
    return endpoint.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // 导出性能数据
  exportMetrics() {
    return {
      metrics: Object.fromEntries(this.metrics),
      alerts: this.alerts,
      thresholds: this.thresholds,
      exportedAt: new Date().toISOString()
    };
  }

  // 导入性能数据
  importMetrics(data) {
    if (data.metrics) {
      this.metrics = new Map(Object.entries(data.metrics));
    }
    if (data.alerts) {
      this.alerts = data.alerts;
    }
    if (data.thresholds) {
      this.thresholds = { ...this.thresholds, ...data.thresholds };
    }
  }
}

// 全局监控实例
export const performanceMonitor = new PerformanceMonitor();

// 中间件函数，用于自动监控API调用
export function createPerformanceMiddleware() {
  return async (context, next) => {
    const startTime = Date.now();
    const { request } = context;
    const endpoint = new URL(request.url).pathname;
    
    let response;
    let error = null;

    try {
      response = await next();
      return response;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const endTime = Date.now();
      const status = response?.status || 500;
      
      // 记录性能数据
      performanceMonitor.recordApiCall(endpoint, startTime, endTime, status, error);
    }
  };
}