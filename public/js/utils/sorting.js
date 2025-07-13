// 简化的排序工具模块
// 专注于实用性和易用性

const SimpleSorter = {
  // 当前排序状态
  currentSort: {
    field: 'created_at',
    direction: 'desc'
  },

  // 排序方向
  ASC: 'asc',
  DESC: 'desc',

  // 热度分数缓存
  _popularityCache: new Map(),
  _cacheTimeout: 5 * 60 * 1000, // 5分钟缓存

  // 简单排序方法 - 使用原生sort，性能更好
  sort(bookmarks, field, direction = this.ASC) {
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return bookmarks;
    }

    const sorted = [...bookmarks].sort((a, b) => {
      let valueA = this.getValue(a, field);
      let valueB = this.getValue(b, field);

      // 处理空值
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;

      // 字符串比较（优化中文支持）
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        // 先按拼音排序，再按字符排序，确保中文排序的一致性
        const result = valueA.localeCompare(valueB, ['zh-CN', 'zh'], {
          numeric: true,
          sensitivity: 'accent',
          ignorePunctuation: false,
          caseFirst: 'lower'
        });
        return direction === this.DESC ? -result : result;
      }

      // 数字和日期比较
      if (valueA < valueB) return direction === this.DESC ? 1 : -1;
      if (valueA > valueB) return direction === this.DESC ? -1 : 1;
      return 0;
    });

    // 更新当前排序状态
    this.currentSort = { field, direction };
    return sorted;
  },

  // 获取字段值 - 改进版
  getValue(bookmark, field) {
    if (!bookmark) return '';

    try {
      switch (field) {
        case 'title':
          return (bookmark.title || '').trim();
        case 'url':
          return (bookmark.url || '').trim();
        case 'category':
        case 'category_name':
          return (bookmark.category_name || bookmark.category || '未分类').trim();
        case 'created_at':
        case 'updated_at':
          const date = new Date(bookmark[field] || 0);
          return isNaN(date.getTime()) ? new Date(0) : date;
        case 'description':
          return (bookmark.description || '').trim();
        case 'visit_count':
          // 访问次数从1开始计算，0表示从未访问
          return Math.max(0, parseInt(bookmark.visit_count || 0));
        case 'last_visited':
          const lastVisited = new Date(bookmark.last_visited || 0);
          return isNaN(lastVisited.getTime()) ? new Date(0) : lastVisited;
        case 'popularity':
          return this.getPopularityWithCache(bookmark);
        default:
          return bookmark[field] || '';
      }
    } catch (error) {
      console.warn('获取字段值时出错:', error, field, bookmark);
      return '';
    }
  },

  // 带缓存的热度计算
  getPopularityWithCache(bookmark) {
    if (!bookmark || !bookmark.id) return 0;

    const cacheKey = `${bookmark.id}_${bookmark.visit_count || 0}_${bookmark.last_visited || 0}`;
    const cached = this._popularityCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this._cacheTimeout) {
      return cached.score;
    }

    const score = this.calculatePopularity(bookmark);
    this._popularityCache.set(cacheKey, {
      score,
      timestamp: Date.now()
    });

    // 清理过期缓存
    if (this._popularityCache.size > 1000) {
      this.clearExpiredCache();
    }

    return score;
  },

  // 清理过期缓存
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this._popularityCache.entries()) {
      if (now - value.timestamp > this._cacheTimeout) {
        this._popularityCache.delete(key);
      }
    }
  },

  // 计算书签热度分数 - 改进版算法
  calculatePopularity(bookmark) {
    // 输入验证
    if (!bookmark) return 0;

    // 访问次数：0=从未访问，1=访问1次，以此类推
    const visitCount = Math.max(0, parseInt(bookmark.visit_count || 0));
    const lastVisited = new Date(bookmark.last_visited || 0);
    const created = new Date(bookmark.created_at || 0);
    const now = new Date();

    // 验证日期有效性
    if (isNaN(created.getTime())) return 0;

    const daysSinceCreated = Math.max(0.1, (now - created) / (1000 * 60 * 60 * 24));
    const daysSinceLastVisit = isNaN(lastVisited.getTime()) ?
      daysSinceCreated : (now - lastVisited) / (1000 * 60 * 60 * 24);

    // 权重系统：从1开始，按重要性递减
    // 权重1: 访问次数 (最重要) - 从1开始计算，使用对数函数避免线性上限
    const visitScore = visitCount >= 1 ? Math.log(visitCount) * 1 : 0;

    // 权重2: 最近访问 - 指数衰减，14天半衰期，只有访问过才计算
    const recentScore = visitCount >= 1 ? 0.857 * Math.exp(-daysSinceLastVisit / 14) : 0;

    // 权重3: 访问规律性 - 基于访问间隔的一致性，至少需要2次访问
    let regularityScore = 0;
    if (visitCount >= 2) {
      const avgDaysBetweenVisits = daysSinceCreated / visitCount;
      // 访问间隔越规律（接近7天）分数越高
      const idealInterval = 7; // 理想访问间隔
      const intervalDeviation = Math.abs(avgDaysBetweenVisits - idealInterval);
      regularityScore = 0.571 * Math.exp(-intervalDeviation / 10);
    }

    // 权重4: 新鲜度 (最低权重) - 渐进式衰减，30天半衰期
    const freshnessScore = 0.429 * Math.exp(-daysSinceCreated / 30);

    const totalScore = visitScore + recentScore + regularityScore + freshnessScore;

    // 返回0-100范围内的分数
    return Math.min(100, Math.max(0, totalScore));
  },

  // 点击排序 - 智能切换方向
  clickSort(bookmarks, field) {
    let direction = this.ASC;

    // 如果点击的是当前字段，切换方向
    if (this.currentSort.field === field) {
      direction = this.currentSort.direction === this.ASC ? this.DESC : this.ASC;
    } else {
      // 不同字段的默认方向
      direction = this.getDefaultDirection(field);
    }

    return this.sort(bookmarks, field, direction);
  },

  // 获取字段默认排序方向
  getDefaultDirection(field) {
    const descFields = ['created_at', 'updated_at'];
    return descFields.includes(field) ? this.DESC : this.ASC;
  },

  // 获取排序指示器
  getIndicator(field) {
    if (this.currentSort.field !== field) return '';
    return this.currentSort.direction === this.ASC ? '↑' : '↓';
  },

  // 重置排序
  reset() {
    this.currentSort = { field: 'created_at', direction: 'desc' };
    this.clearCache();
  },

  // 清空所有缓存
  clearCache() {
    this._popularityCache.clear();
  }
};

// 导出到全局作用域
window.SimpleSorter = SimpleSorter;
