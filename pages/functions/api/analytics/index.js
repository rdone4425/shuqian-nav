import { authenticateRequest } from "../auth/verify.js";
import { bookmarkAnalytics } from "../../utils/bookmark-analytics.js";
import { ResponseHelper } from "../../utils/response-helper.js";

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAnalyticsReport(reportType, days, limit) {
  switch (reportType) {
    case "popular":
      return {
        popularBookmarks: bookmarkAnalytics.getPopularBookmarks(limit, days),
      };
    case "usage":
      return bookmarkAnalytics.getUsageReport(days);
    case "search":
      return {
        searchStats: bookmarkAnalytics.getSearchStatistics(days),
      };
    case "time":
      return {
        timeDistribution: bookmarkAnalytics.getTimeDistribution(days),
      };
    case "export":
      return bookmarkAnalytics.exportData();
    default: {
      const weeklyReport = bookmarkAnalytics.getUsageReport(7);
      return {
        summary: weeklyReport.summary,
        popularBookmarks: bookmarkAnalytics.getPopularBookmarks(5, 7),
        recentInsights: weeklyReport.insights.slice(0, 3),
      };
    }
  }
}

async function requireAdmin(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return { error: ResponseHelper.unauthorized(auth.error) };
  }
  return { auth };
}

export async function onRequestGet(context) {
  const { request } = context;

  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get("type") || "summary";
    const days = toPositiveInteger(url.searchParams.get("days"), 30);
    const limit = toPositiveInteger(url.searchParams.get("limit"), 10);

    return ResponseHelper.success({
      ...getAnalyticsReport(reportType, days, limit),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to get analytics data:", error);
    return ResponseHelper.serverError(
      "Failed to get analytics data",
      error.message,
    );
  }
}

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const { bookmarkId, bookmarkData = {}, action } = await request.json();

    if (!bookmarkId) {
      return ResponseHelper.error("Missing bookmarkId parameter", 400);
    }

    let result;
    switch (action) {
      case "visit":
        result = bookmarkAnalytics.recordVisit(bookmarkId, {
          ...bookmarkData,
          userAgent: request.headers.get("User-Agent"),
          referrer: request.headers.get("Referer"),
        });
        break;
      case "search": {
        const { searchTerm, resultCount } = bookmarkData;
        result = bookmarkAnalytics.recordSearch(searchTerm, resultCount);
        break;
      }
      default:
        return ResponseHelper.error("Unsupported analytics action", 400);
    }

    return ResponseHelper.success(result, "Analytics data recorded");
  } catch (error) {
    console.error("Failed to record analytics data:", error);
    return ResponseHelper.serverError(
      "Failed to record analytics data",
      error.message,
    );
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const admin = await requireAdmin(request, env);
    if (admin.error) return admin.error;

    const { action, data } = await request.json();

    switch (action) {
      case "cleanup":
        bookmarkAnalytics.cleanup(data?.daysToKeep || 90);
        break;
      case "import":
        if (data?.analytics) {
          bookmarkAnalytics.importData(data.analytics);
        }
        break;
      case "reset":
        bookmarkAnalytics.visits.clear();
        bookmarkAnalytics.dailyStats.clear();
        bookmarkAnalytics.categories.clear();
        bookmarkAnalytics.searchTerms.clear();
        break;
      default:
        return ResponseHelper.error("Unsupported analytics admin action", 400);
    }

    return ResponseHelper.success(null, "Analytics operation completed");
  } catch (error) {
    console.error("Failed to manage analytics data:", error);
    return ResponseHelper.serverError(
      "Failed to manage analytics data",
      error.message,
    );
  }
}
