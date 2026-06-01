const SimpleSorter = {
  currentSort: {
    field: "created_at",
    direction: "desc",
  },

  ASC: "asc",
  DESC: "desc",

  _popularityCache: new Map(),
  _cacheTimeout: 5 * 60 * 1000,

  sort(bookmarks, field, direction = this.ASC) {
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return bookmarks;
    }

    const sorted = [...bookmarks].sort((a, b) => {
      const valueA = this.getValue(a, field);
      const valueB = this.getValue(b, field);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;

      if (typeof valueA === "string" && typeof valueB === "string") {
        const result = valueA.localeCompare(valueB, ["zh-CN", "zh"], {
          numeric: true,
          sensitivity: "accent",
        });
        return direction === this.DESC ? -result : result;
      }

      if (valueA < valueB) return direction === this.DESC ? 1 : -1;
      if (valueA > valueB) return direction === this.DESC ? -1 : 1;
      return 0;
    });

    this.currentSort = { field, direction };
    return sorted;
  },

  getValue(bookmark, field) {
    if (!bookmark) return "";

    try {
      switch (field) {
        case "title":
          return (bookmark.title || "").trim();
        case "url":
          return (bookmark.url || "").trim();
        case "category":
        case "category_name":
          return (
            bookmark.category_name ||
            bookmark.category ||
            window.I18n?.t("bookmarkCard.uncategorized") ||
            "未分类"
          ).trim();
        case "created_at":
        case "updated_at": {
          const date = new Date(bookmark[field] || 0);
          return Number.isNaN(date.getTime()) ? new Date(0) : date;
        }
        case "description":
          return (bookmark.description || "").trim();
        case "visit_count":
          return Math.max(0, parseInt(bookmark.visit_count || 0, 10));
        case "last_visited": {
          const lastVisited = new Date(bookmark.last_visited || 0);
          return Number.isNaN(lastVisited.getTime())
            ? new Date(0)
            : lastVisited;
        }
        case "popularity":
          return this.getPopularityWithCache(bookmark);
        default:
          return bookmark[field] || "";
      }
    } catch (error) {
      console.warn("获取排序字段时出错:", error, field, bookmark);
      return "";
    }
  },

  getPopularityWithCache(bookmark) {
    if (!bookmark || !bookmark.id) return 0;

    const cacheKey = `${bookmark.id}_${bookmark.visit_count || 0}_${bookmark.last_visited || 0}`;
    const cached = this._popularityCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this._cacheTimeout) {
      return cached.score;
    }

    const score = this.calculatePopularity(bookmark);
    this._popularityCache.set(cacheKey, {
      score,
      timestamp: Date.now(),
    });

    if (this._popularityCache.size > 1000) {
      this.clearExpiredCache();
    }

    return score;
  },

  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this._popularityCache.entries()) {
      if (now - value.timestamp > this._cacheTimeout) {
        this._popularityCache.delete(key);
      }
    }
  },

  calculatePopularity(bookmark) {
    if (!bookmark) return 0;

    const visitCount = Math.max(0, parseInt(bookmark.visit_count || 0, 10));
    const lastVisited = new Date(bookmark.last_visited || 0);
    const created = new Date(bookmark.created_at || 0);
    const now = new Date();

    if (Number.isNaN(created.getTime())) return 0;

    const daysSinceCreated = Math.max(
      0.1,
      (now - created) / (1000 * 60 * 60 * 24),
    );
    const daysSinceLastVisit = Number.isNaN(lastVisited.getTime())
      ? daysSinceCreated
      : (now - lastVisited) / (1000 * 60 * 60 * 24);

    const visitScore = visitCount >= 1 ? Math.log(visitCount) : 0;
    const recentScore =
      visitCount >= 1 ? 0.857 * Math.exp(-daysSinceLastVisit / 14) : 0;

    let regularityScore = 0;
    if (visitCount >= 2) {
      const avgDaysBetweenVisits = daysSinceCreated / visitCount;
      const idealInterval = 7;
      const intervalDeviation = Math.abs(avgDaysBetweenVisits - idealInterval);
      regularityScore = 0.571 * Math.exp(-intervalDeviation / 10);
    }

    const freshnessScore = 0.429 * Math.exp(-daysSinceCreated / 30);
    const totalScore =
      visitScore + recentScore + regularityScore + freshnessScore;

    return Math.min(100, Math.max(0, totalScore));
  },

  clickSort(bookmarks, field) {
    const direction =
      this.currentSort.field === field
        ? this.currentSort.direction === this.ASC
          ? this.DESC
          : this.ASC
        : this.getDefaultDirection(field);

    return this.sort(bookmarks, field, direction);
  },

  getDefaultDirection(field) {
    const descFields = [
      "created_at",
      "updated_at",
      "visit_count",
      "popularity",
    ];
    return descFields.includes(field) ? this.DESC : this.ASC;
  },

  getIndicator(field) {
    if (this.currentSort.field !== field) return "";
    return this.currentSort.direction === this.ASC ? "↑" : "↓";
  },

  reset() {
    this.currentSort = { field: "created_at", direction: "desc" };
    this.clearCache();
  },

  clearCache() {
    this._popularityCache.clear();
  },
};

window.SimpleSorter = SimpleSorter;
