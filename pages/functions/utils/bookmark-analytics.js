// 书签访问统计工具
export class BookmarkAnalytics {
  constructor() {
    this.visits = new Map(); // 存储访问记录
    this.dailyStats = new Map(); // 每日统计
    this.categories = new Map(); // 分类统计
    this.searchTerms = new Map(); // 搜索词统计
  }

  // 记录书签访问
  recordVisit(bookmarkId, bookmarkData = {}) {
    const now = new Date();
    const dateKey = this.getDateKey(now);
    const visitRecord = {
      bookmarkId,
      timestamp: now.toISOString(),
      title: bookmarkData.title || "",
      url: bookmarkData.url || "",
      category: bookmarkData.category || "",
      userAgent: bookmarkData.userAgent || "",
      referrer: bookmarkData.referrer || "",
    };

    // 记录单个书签访问
    if (!this.visits.has(bookmarkId)) {
      this.visits.set(bookmarkId, {
        bookmarkId,
        totalVisits: 0,
        lastVisit: null,
        firstVisit: null,
        visitHistory: [],
        title: bookmarkData.title || "",
        url: bookmarkData.url || "",
        category: bookmarkData.category || "",
      });
    }

    const bookmark = this.visits.get(bookmarkId);
    bookmark.totalVisits++;
    bookmark.lastVisit = visitRecord.timestamp;
    if (!bookmark.firstVisit) {
      bookmark.firstVisit = visitRecord.timestamp;
    }

    // 保留最近100次访问记录
    bookmark.visitHistory.push(visitRecord);
    if (bookmark.visitHistory.length > 100) {
      bookmark.visitHistory.shift();
    }

    // 更新书签信息
    if (bookmarkData.title) bookmark.title = bookmarkData.title;
    if (bookmarkData.url) bookmark.url = bookmarkData.url;
    if (bookmarkData.category) bookmark.category = bookmarkData.category;

    // 记录每日统计
    if (!this.dailyStats.has(dateKey)) {
      this.dailyStats.set(dateKey, {
        date: dateKey,
        totalVisits: 0,
        uniqueBookmarks: new Set(),
        categories: new Map(),
        hourlyDistribution: new Array(24).fill(0),
      });
    }

    const dailyStat = this.dailyStats.get(dateKey);
    dailyStat.totalVisits++;
    dailyStat.uniqueBookmarks.add(bookmarkId);

    // 小时分布
    const hour = now.getHours();
    dailyStat.hourlyDistribution[hour]++;

    // 分类统计
    if (bookmarkData.category) {
      if (!dailyStat.categories.has(bookmarkData.category)) {
        dailyStat.categories.set(bookmarkData.category, 0);
      }
      dailyStat.categories.set(
        bookmarkData.category,
        dailyStat.categories.get(bookmarkData.category) + 1,
      );

      // 全局分类统计
      if (!this.categories.has(bookmarkData.category)) {
        this.categories.set(bookmarkData.category, {
          name: bookmarkData.category,
          totalVisits: 0,
          uniqueBookmarks: new Set(),
          lastVisit: null,
        });
      }
      const categoryStat = this.categories.get(bookmarkData.category);
      categoryStat.totalVisits++;
      categoryStat.uniqueBookmarks.add(bookmarkId);
      categoryStat.lastVisit = visitRecord.timestamp;
    }

    return visitRecord;
  }

  // 记录搜索行为
  recordSearch(searchTerm, resultCount = 0) {
    if (!searchTerm || searchTerm.trim().length < 2) return;

    const normalizedTerm = searchTerm.toLowerCase().trim();
    const now = new Date();

    if (!this.searchTerms.has(normalizedTerm)) {
      this.searchTerms.set(normalizedTerm, {
        term: normalizedTerm,
        searchCount: 0,
        firstSearch: null,
        lastSearch: null,
        avgResultCount: 0,
        totalResultCount: 0,
      });
    }

    const searchStat = this.searchTerms.get(normalizedTerm);
    searchStat.searchCount++;
    searchStat.lastSearch = now.toISOString();
    if (!searchStat.firstSearch) {
      searchStat.firstSearch = now.toISOString();
    }
    searchStat.totalResultCount += resultCount;
    searchStat.avgResultCount =
      searchStat.totalResultCount / searchStat.searchCount;

    return searchStat;
  }

  // 获取热门书签
  getPopularBookmarks(limit = 10, timeRange = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    const popularBookmarks = [];

    for (const [bookmarkId, data] of this.visits) {
      const recentVisits = data.visitHistory.filter(
        (visit) => new Date(visit.timestamp) >= cutoffDate,
      );

      if (recentVisits.length > 0) {
        popularBookmarks.push({
          bookmarkId: data.bookmarkId,
          title: data.title,
          url: data.url,
          category: data.category,
          totalVisits: data.totalVisits,
          recentVisits: recentVisits.length,
          lastVisit: data.lastVisit,
          popularity: this.calculatePopularity(data, recentVisits),
        });
      }
    }

    return popularBookmarks
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  // 计算书签受欢迎程度
  calculatePopularity(data, recentVisits) {
    const recencyWeight = 0.4;
    const frequencyWeight = 0.6;

    // 频率得分（最近访问次数）
    const frequencyScore = Math.min(recentVisits.length / 10, 1);

    // 最近性得分（最后访问时间）
    const lastVisitTime = new Date(data.lastVisit).getTime();
    const now = Date.now();
    const daysSinceLastVisit = (now - lastVisitTime) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceLastVisit / 30);

    return (
      (frequencyScore * frequencyWeight + recencyScore * recencyWeight) * 100
    );
  }

  // 获取使用统计报告
  getUsageReport(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffKey = this.getDateKey(cutoffDate);

    const report = {
      summary: {
        totalVisits: 0,
        totalBookmarks: this.visits.size,
        activeDays: 0,
        avgVisitsPerDay: 0,
        reportPeriod: days,
        generatedAt: new Date().toISOString(),
      },
      dailyStats: [],
      popularBookmarks: this.getPopularBookmarks(10, days),
      categoryStats: [],
      searchStats: this.getSearchStatistics(days),
      timeDistribution: this.getTimeDistribution(days),
      insights: [],
    };

    // 统计每日数据
    const sortedDays = Array.from(this.dailyStats.keys())
      .filter((dateKey) => dateKey >= cutoffKey)
      .sort();

    for (const dateKey of sortedDays) {
      const dailyStat = this.dailyStats.get(dateKey);
      const dayData = {
        date: dateKey,
        totalVisits: dailyStat.totalVisits,
        uniqueBookmarks: dailyStat.uniqueBookmarks.size,
        categories: Array.from(dailyStat.categories.entries()).map(
          ([name, count]) => ({
            name,
            count,
          }),
        ),
        hourlyDistribution: dailyStat.hourlyDistribution,
      };

      report.dailyStats.push(dayData);
      report.summary.totalVisits += dailyStat.totalVisits;
    }

    report.summary.activeDays = sortedDays.length;
    report.summary.avgVisitsPerDay =
      report.summary.activeDays > 0
        ? Math.round(report.summary.totalVisits / report.summary.activeDays)
        : 0;

    // 分类统计
    for (const [categoryName, categoryData] of this.categories) {
      report.categoryStats.push({
        name: categoryName,
        totalVisits: categoryData.totalVisits,
        uniqueBookmarks: categoryData.uniqueBookmarks.size,
        lastVisit: categoryData.lastVisit,
        avgVisitsPerBookmark: Math.round(
          categoryData.totalVisits / categoryData.uniqueBookmarks.size,
        ),
      });
    }

    report.categoryStats.sort((a, b) => b.totalVisits - a.totalVisits);

    // 生成洞察
    report.insights = this.generateInsights(report);

    return report;
  }

  // 获取搜索统计
  getSearchStatistics(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const popularSearches = Array.from(this.searchTerms.values())
      .filter((search) => new Date(search.lastSearch) >= cutoffDate)
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 20);

    return {
      totalSearches: popularSearches.reduce(
        (sum, search) => sum + search.searchCount,
        0,
      ),
      uniqueTerms: popularSearches.length,
      popularTerms: popularSearches.map((search) => ({
        term: search.term,
        searchCount: search.searchCount,
        avgResultCount: Math.round(search.avgResultCount),
        lastSearch: search.lastSearch,
      })),
      noResultSearches: popularSearches.filter(
        (search) => search.avgResultCount === 0,
      ).length,
    };
  }

  // 获取时间分布统计
  getTimeDistribution(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffKey = this.getDateKey(cutoffDate);

    const hourlyTotal = new Array(24).fill(0);
    const daylyTotal = new Array(7).fill(0); // 0=Sunday, 6=Saturday

    for (const [dateKey, dailyStat] of this.dailyStats) {
      if (dateKey >= cutoffKey) {
        // 小时分布
        dailyStat.hourlyDistribution.forEach((count, hour) => {
          hourlyTotal[hour] += count;
        });

        // 星期分布
        const date = new Date(dateKey);
        const dayOfWeek = date.getDay();
        daylyTotal[dayOfWeek] += dailyStat.totalVisits;
      }
    }

    return {
      hourlyDistribution: hourlyTotal.map((count, hour) => ({
        hour,
        count,
        label: `${hour.toString().padStart(2, "0")}:00`,
      })),
      weeklyDistribution: daylyTotal.map((count, day) => ({
        day,
        count,
        label: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][day],
      })),
    };
  }

  // 生成使用洞察
  generateInsights(report) {
    const insights = [];

    // 使用频率洞察
    if (report.summary.avgVisitsPerDay > 10) {
      insights.push({
        type: "usage_pattern",
        title: "高频用户",
        description: `您每天平均访问 ${report.summary.avgVisitsPerDay} 个书签，是一个活跃用户！`,
        icon: "🔥",
      });
    } else if (report.summary.avgVisitsPerDay < 2) {
      insights.push({
        type: "usage_pattern",
        title: "轻度使用",
        description: "您可以尝试将常用网站添加为书签来提高效率",
        icon: "💡",
      });
    }

    // 时间模式洞察
    const timeStats = report.timeDistribution;
    const peakHour = timeStats.hourlyDistribution.reduce((max, current) =>
      current.count > max.count ? current : max,
    );

    if (peakHour.count > 0) {
      let timeDescription = "";
      if (peakHour.hour >= 9 && peakHour.hour <= 17) {
        timeDescription = "工作时间";
      } else if (peakHour.hour >= 18 && peakHour.hour <= 22) {
        timeDescription = "晚间时间";
      } else {
        timeDescription = "深夜时间";
      }

      insights.push({
        type: "time_pattern",
        title: "使用时间偏好",
        description: `您主要在${timeDescription}（${peakHour.label}）使用书签`,
        icon: "⏰",
      });
    }

    // 分类偏好洞察
    if (report.categoryStats.length > 0) {
      const topCategory = report.categoryStats[0];
      insights.push({
        type: "category_preference",
        title: "偏好分类",
        description: `您最常访问「${topCategory.name}」分类的书签（${topCategory.totalVisits}次访问）`,
        icon: "📁",
      });
    }

    // 搜索行为洞察
    if (report.searchStats.noResultSearches > 0) {
      insights.push({
        type: "search_behavior",
        title: "搜索优化建议",
        description: `有 ${report.searchStats.noResultSearches} 个搜索词没有找到结果，可能需要添加相关书签`,
        icon: "🔍",
      });
    }

    return insights;
  }

  // 获取日期键
  getDateKey(date) {
    return date.toISOString().split("T")[0];
  }

  // 清理旧数据
  cleanup(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();

    // 清理访问记录
    for (const [bookmarkId, data] of this.visits) {
      data.visitHistory = data.visitHistory.filter(
        (visit) => new Date(visit.timestamp).getTime() > cutoffTime,
      );

      // 如果没有访问记录，移除整个条目
      if (data.visitHistory.length === 0) {
        this.visits.delete(bookmarkId);
      }
    }

    // 清理每日统计
    const cutoffKey = this.getDateKey(cutoffDate);
    for (const dateKey of this.dailyStats.keys()) {
      if (dateKey < cutoffKey) {
        this.dailyStats.delete(dateKey);
      }
    }
  }

  // 导出统计数据
  exportData() {
    return {
      visits: Object.fromEntries(this.visits),
      dailyStats: Object.fromEntries(
        Array.from(this.dailyStats.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            uniqueBookmarks: Array.from(value.uniqueBookmarks),
            categories: Object.fromEntries(value.categories),
          },
        ]),
      ),
      categories: Object.fromEntries(
        Array.from(this.categories.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            uniqueBookmarks: Array.from(value.uniqueBookmarks),
          },
        ]),
      ),
      searchTerms: Object.fromEntries(this.searchTerms),
      exportedAt: new Date().toISOString(),
    };
  }

  // 导入统计数据
  importData(data) {
    if (data.visits) {
      this.visits = new Map(Object.entries(data.visits));
    }

    if (data.dailyStats) {
      this.dailyStats = new Map(
        Object.entries(data.dailyStats).map(([key, value]) => [
          key,
          {
            ...value,
            uniqueBookmarks: new Set(value.uniqueBookmarks),
            categories: new Map(Object.entries(value.categories)),
          },
        ]),
      );
    }

    if (data.categories) {
      this.categories = new Map(
        Object.entries(data.categories).map(([key, value]) => [
          key,
          {
            ...value,
            uniqueBookmarks: new Set(value.uniqueBookmarks),
          },
        ]),
      );
    }

    if (data.searchTerms) {
      this.searchTerms = new Map(Object.entries(data.searchTerms));
    }
  }
}

// 全局分析实例
export const bookmarkAnalytics = new BookmarkAnalytics();
