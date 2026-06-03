// 性能监控API端点
import { authenticateRequest } from "../auth/verify.js";
import { performanceMonitor } from "../../utils/performance-monitor.js";
import { ResponseHelper } from "../../utils/response-helper.js";

// 获取性能报告
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized("需要管理员权限");
    }

    const url = new URL(request.url);
    const reportType = url.searchParams.get("type") || "summary";
    const timeRange = url.searchParams.get("range") || "24h";

    let report;
    switch (reportType) {
      case "detailed":
        report = performanceMonitor.getPerformanceReport();
        break;
      case "alerts":
        report = {
          alerts: performanceMonitor.alerts.slice(-100),
          summary: {
            totalAlerts: performanceMonitor.alerts.length,
            recentAlerts: performanceMonitor.alerts.filter(
              (alert) =>
                new Date(alert.timestamp).getTime() >
                Date.now() - 24 * 60 * 60 * 1000,
            ).length,
          },
        };
        break;
      case "export":
        report = performanceMonitor.exportMetrics();
        break;
      default:
        report = performanceMonitor.getPerformanceReport();
    }

    return ResponseHelper.success({
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("获取性能报告失败:", error);
    return ResponseHelper.serverError("获取性能报告失败", error.message);
  }
}

// 配置性能监控
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized("需要管理员权限");
    }

    const { action, data } = await request.json();

    switch (action) {
      case "update_thresholds":
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

      case "clear_alerts":
        performanceMonitor.alerts = [];
        break;

      case "cleanup":
        const daysToKeep = data.daysToKeep || 7;
        performanceMonitor.cleanup(daysToKeep);
        break;

      case "import_metrics":
        if (data.metrics) {
          performanceMonitor.importMetrics(data.metrics);
        }
        break;

      default:
        return ResponseHelper.error("不支持的操作", 400);
    }

    return ResponseHelper.success(
      { currentThresholds: performanceMonitor.thresholds },
      "配置更新成功",
    );
  } catch (error) {
    console.error("配置性能监控失败:", error);
    return ResponseHelper.serverError("配置失败", error.message);
  }
}

// 手动记录性能数据（用于测试）
export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized("需要管理员权限");
    }

    const { endpoint, startTime, endTime, status, error } =
      await request.json();

    if (!endpoint || !startTime || !endTime || !status) {
      return ResponseHelper.error(
        "缺少必要参数: endpoint, startTime, endTime, status",
        400,
      );
    }

    const metric = performanceMonitor.recordApiCall(
      endpoint,
      startTime,
      endTime,
      status,
      error ? new Error(error) : null,
    );

    return ResponseHelper.success(
      {
        metric: {
          endpoint: metric.endpoint,
          totalCalls: metric.totalCalls,
          avgResponseTime: metric.avgResponseTime,
          errorRate: metric.errorRate,
        },
      },
      "性能数据记录成功",
    );
  } catch (error) {
    console.error("记录性能数据失败:", error);
    return ResponseHelper.serverError("记录失败", error.message);
  }
}
