// 书签管理模块
// 处理书签的增删改查、分类管理和UI渲染

const BookmarkManager = {
  // 数据状态
  bookmarks: [],
  categories: [],
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,

  // 当前过滤和排序状态
  currentFilters: {
    search: "",
    category: "",
    sortBy: "created_at",
    sortOrder: "desc",
  },

  // UI元素引用
  elements: {},

  // 初始化
  async init() {
    this.bindElements();
    this.bindEvents();
    await this.loadCategories();
    await this.loadBookmarks();
    this.restoreUserPreferences();
  },

  // 绑定DOM元素
  bindElements() {
    const selectors = {
      bookmarksGrid: "bookmarksGrid",
      loadingState: "loadingState",
      emptyState: "emptyState",
      errorState: "errorState",
      totalCount: "totalCount",
      currentPageInfo: "currentPageInfo",
      categoryFilter: "categoryFilter",
      sortSelect: "sortSelect",
      searchInput: "searchInput",
      paginationContainer: "paginationContainer",
      pageNumbers: "pageNumbers",
      prevPageBtn: "prevPageBtn",
      nextPageBtn: "nextPageBtn",
    };

    this.elements = DOMHelper.getElements(selectors);
  },

  // 绑定事件
  bindEvents() {
    // 分类过滤
    this.elements.categoryFilter?.addEventListener("change", (e) => {
      this.currentFilters.category = e.target.value;
      this.currentPage = 1;
      this.loadBookmarks();
    });

    // 排序
    this.elements.sortSelect?.addEventListener("change", (e) => {
      const [sortBy, sortOrder] = e.target.value.split(":");
      this.currentFilters.sortBy = sortBy;
      this.currentFilters.sortOrder = sortOrder;
      this.currentPage = 1;
      this.loadBookmarks();
      Storage.sort.set(sortBy, sortOrder);
    });

    // 初始化点击排序
    this.initClickSorting();

    // 搜索
    this.elements.searchInput?.addEventListener(
      "input",
      this.debounce((e) => {
        this.currentFilters.search = e.target.value.trim();
        this.currentPage = 1;
        this.loadBookmarks();
        Storage.search.save(
          this.currentFilters.search,
          this.currentFilters.category,
        );
      }, 300),
    );

    // 分页
    this.elements.prevPageBtn?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadBookmarks();
      }
    });

    this.elements.nextPageBtn?.addEventListener("click", () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.loadBookmarks();
      }
    });

    // 重试按钮
    document.getElementById("retryBtn")?.addEventListener("click", () => {
      this.loadBookmarks();
    });
  },

  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 加载书签列表
  async loadBookmarks() {
    try {
      this.showLoading();

      const params = {
        page: this.currentPage,
        limit: 20,
        search: this.currentFilters.search,
        category: this.currentFilters.category,
        sortBy: this.currentFilters.sortBy,
        sortOrder: this.currentFilters.sortOrder,
      };

      const response = await BookmarkAPI.getBookmarks(params);

      if (response.success) {
        this.bookmarks = response.data.bookmarks;
        this.updatePagination(response.data.pagination);
        this.renderBookmarks();
        this.updateStats();
        this.refreshWikiView();
      } else {
        this.showError(response.error || "加载书签失败");
      }
    } catch (error) {
      console.error("加载书签错误:", error);
      this.showError("网络连接异常，请稍后重试");
    }
  },

  // 加载分类列表
  async loadCategories() {
    try {
      const response = await BookmarkAPI.getCategories();
      if (response.success) {
        this.categories = response.data;
        this.renderCategoryFilter();
        this.refreshWikiView();
      }
    } catch (error) {
      console.error("加载分类错误:", error);
    }
  },

  // 渲染书签列表
  renderBookmarks() {
    if (!this.elements.bookmarksGrid) return;

    if (this.bookmarks.length === 0) {
      this.showEmpty();
      return;
    }

    this.hideStates();

    const bookmarksHTML = this.bookmarks
      .map((bookmark) => this.createBookmarkCard(bookmark))
      .join("");
    this.elements.bookmarksGrid.innerHTML = bookmarksHTML;

    // 绑定书签卡片事件
    this.bindBookmarkEvents();
  },

  // 创建书签卡片HTML
  createBookmarkCard(bookmark) {
    // 获取访问统计
    const localStats = this.getLocalVisitStats(bookmark.id);
    const visitCount = Math.max(bookmark.visit_count || 0, localStats.count);
    const lastVisited = localStats.lastVisit || bookmark.last_visited;

    const categoryBadge = bookmark.category_name
      ? `
      <div class="bookmark-category">
        <div class="category-dot" style="background-color: ${bookmark.category_color || "var(--accent)"}"></div>
        <span>${bookmark.category_name}</span>
      </div>
    `
      : "";

    const description = bookmark.description
      ? `
      <div class="bookmark-description">${this.escapeHtml(bookmark.description)}</div>
    `
      : "";

    // 访问统计信息
    const statsInfo =
      visitCount > 0
        ? `
      <div class="bookmark-stats">
        <span class="visit-count" title="访问次数">👁️ ${visitCount}</span>
        ${lastVisited ? `<span class="last-visited" title="最后访问">${this.formatRelativeTime(lastVisited)}</span>` : ""}
      </div>
    `
        : "";

    // 热度指示器
    const popularity = SimpleSorter.calculatePopularity(bookmark);
    const hotBadge =
      popularity > 50
        ? `<span class="hot-badge" title="热门书签">🔥</span>`
        : "";

    return `
      <div class="bookmark-card" data-id="${bookmark.id}">
        <div class="bookmark-header">
          <img src="${bookmark.favicon_url || "/favicon.ico"}"
               alt="favicon"
               class="bookmark-favicon"
               onerror="this.src='/favicon.ico'">
          <div class="bookmark-info">
            <h3 class="bookmark-title">
              ${this.escapeHtml(bookmark.title)}
              ${hotBadge}
            </h3>
            <a href="${bookmark.url}" target="_blank" class="bookmark-url" rel="noopener noreferrer">
              ${this.escapeHtml(bookmark.url)}
            </a>
          </div>
        </div>
        ${description}
        ${statsInfo}
        <div class="bookmark-footer">
          ${categoryBadge}
          <div class="bookmark-actions">
            <button class="action-btn edit-btn" data-id="${bookmark.id}" title="编辑">
              ✏️
            </button>
            <button class="action-btn delete-btn" data-id="${bookmark.id}" title="删除">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // 格式化相对时间
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    return date.toLocaleDateString();
  },

  // 绑定书签卡片事件
  bindBookmarkEvents() {
    // 书签链接点击 - 记录访问
    document.querySelectorAll(".bookmark-url").forEach((link) => {
      link.addEventListener("click", (e) => {
        const bookmarkCard = link.closest(".bookmark-card");
        const bookmarkId = bookmarkCard.dataset.id;
        this.recordVisit(bookmarkId);
      });
    });

    // 编辑按钮
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bookmarkId = btn.dataset.id;
        this.editBookmark(bookmarkId);
      });
    });

    // 删除按钮
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bookmarkId = btn.dataset.id;
        this.deleteBookmark(bookmarkId);
      });
    });
  },

  // 渲染分类过滤器
  renderCategoryFilter() {
    if (!this.elements.categoryFilter) return;

    const optionsHTML = this.categories
      .map(
        (category) =>
          `<option value="${category.id}">${category.name} (${category.bookmark_count})</option>`,
      )
      .join("");

    this.elements.categoryFilter.innerHTML = `
      <option value="">所有分类</option>
      ${optionsHTML}
    `;
  },

  // 更新分页信息
  updatePagination(pagination) {
    this.currentPage = pagination.page;
    this.totalPages = pagination.totalPages;
    this.totalCount = pagination.total;

    // 更新分页按钮状态
    if (this.elements.prevPageBtn) {
      this.elements.prevPageBtn.disabled = !pagination.hasPrev;
    }
    if (this.elements.nextPageBtn) {
      this.elements.nextPageBtn.disabled = !pagination.hasNext;
    }

    // 渲染页码
    this.renderPageNumbers();

    // 显示/隐藏分页容器
    if (this.elements.paginationContainer) {
      if (this.totalPages > 1) {
        this.elements.paginationContainer.classList.remove("hidden");
      } else {
        this.elements.paginationContainer.classList.add("hidden");
      }
    }
  },

  // 渲染页码按钮
  renderPageNumbers() {
    if (!this.elements.pageNumbers) return;

    const maxVisiblePages = 5;
    let startPage = Math.max(
      1,
      this.currentPage - Math.floor(maxVisiblePages / 2),
    );
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    let pagesHTML = "";

    // 第一页
    if (startPage > 1) {
      pagesHTML += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        pagesHTML += `<span class="page-ellipsis">...</span>`;
      }
    }

    // 中间页码
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === this.currentPage ? "active" : "";
      pagesHTML += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }

    // 最后一页
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        pagesHTML += `<span class="page-ellipsis">...</span>`;
      }
      pagesHTML += `<button class="page-btn" data-page="${this.totalPages}">${this.totalPages}</button>`;
    }

    this.elements.pageNumbers.innerHTML = pagesHTML;

    // 绑定页码点击事件
    this.elements.pageNumbers.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.dataset.page);
        if (page !== this.currentPage) {
          this.currentPage = page;
          this.loadBookmarks();
        }
      });
    });
  },

  // 更新统计信息
  updateStats() {
    if (this.elements.totalCount) {
      this.elements.totalCount.textContent = this.totalCount;
    }
    if (this.elements.currentPageInfo) {
      const start = (this.currentPage - 1) * 20 + 1;
      const end = Math.min(this.currentPage * 20, this.totalCount);
      this.elements.currentPageInfo.textContent = `${start}-${end}`;
    }
  },

  // 显示状态
  showLoading() {
    DOMHelper.setState("loading");
  },

  showEmpty() {
    DOMHelper.setState("empty");
  },

  showError(message) {
    DOMHelper.setState("error", { message: message });
  },

  hideStates() {
    DOMHelper.hide("loadingState", "emptyState", "errorState");
  },

  refreshWikiView() {
    if (!window.WikiView || typeof WikiView.update !== "function") return;
    const snapshot = this.mergeVisitData(this.bookmarks || []);
    WikiView.update({
      bookmarks: snapshot,
      categories: this.categories,
      summary: {
        total: this.totalCount,
        search: this.currentFilters.search,
        category: this.currentFilters.category,
      },
    });
  },

  // 恢复用户偏好设置
  restoreUserPreferences() {
    // 恢复排序偏好
    const sortPreference = Storage.sort.get();
    this.currentFilters.sortBy = sortPreference.sortBy;
    this.currentFilters.sortOrder = sortPreference.sortOrder;

    if (this.elements.sortSelect) {
      this.elements.sortSelect.value = `${sortPreference.sortBy}:${sortPreference.sortOrder}`;
    }

    // 恢复搜索
    const lastSearch = Storage.search.getLast();
    if (lastSearch.query) {
      this.currentFilters.search = lastSearch.query;
      if (this.elements.searchInput) {
        this.elements.searchInput.value = lastSearch.query;
      }
    }
  },

  // 编辑书签
  async editBookmark(bookmarkId) {
    // 这个方法将在app.js中实现，这里只是占位
    if (window.App && window.App.editBookmark) {
      window.App.editBookmark(bookmarkId);
    }
  },

  // 删除书签
  async deleteBookmark(bookmarkId) {
    // 这个方法将在app.js中实现，这里只是占位
    if (window.App && window.App.deleteBookmark) {
      window.App.deleteBookmark(bookmarkId);
    }
  },

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // 刷新书签列表
  async refresh() {
    await this.loadCategories();
    await this.loadBookmarks();
  },

  // 初始化点击排序（简化版）
  initClickSorting() {
    // 只保留访问统计功能，移除多余的快速按钮
    console.log("访问统计功能已启用");
  },

  // 记录书签访问
  async recordVisit(bookmarkId) {
    try {
      // 发送访问记录到服务器
      await BookmarkAPI.recordVisit(bookmarkId);

      // 更新本地数据
      const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
      if (bookmark) {
        bookmark.visit_count = (bookmark.visit_count || 0) + 1;
        bookmark.last_visited = new Date().toISOString();
      }

      // 保存到本地存储
      this.saveVisitToLocal(bookmarkId);
    } catch (error) {
      console.error("记录访问失败:", error);
      // 即使服务器失败，也要保存到本地
      this.saveVisitToLocal(bookmarkId);
    }
  },

  // 保存访问记录到本地存储
  saveVisitToLocal(bookmarkId) {
    const visits = JSON.parse(localStorage.getItem("bookmark_visits") || "{}");
    const today = new Date().toDateString();

    if (!visits[bookmarkId]) {
      visits[bookmarkId] = { count: 0, lastVisit: null, dailyVisits: {} };
    }

    visits[bookmarkId].count++;
    visits[bookmarkId].lastVisit = new Date().toISOString();
    visits[bookmarkId].dailyVisits[today] =
      (visits[bookmarkId].dailyVisits[today] || 0) + 1;

    localStorage.setItem("bookmark_visits", JSON.stringify(visits));
  },

  // 获取本地访问统计
  getLocalVisitStats(bookmarkId) {
    const visits = JSON.parse(localStorage.getItem("bookmark_visits") || "{}");
    return visits[bookmarkId] || { count: 0, lastVisit: null, dailyVisits: {} };
  },

  // 合并本地和服务器的访问数据
  mergeVisitData(bookmarks) {
    return bookmarks.map((bookmark) => {
      const localStats = this.getLocalVisitStats(bookmark.id);
      return {
        ...bookmark,
        visit_count: Math.max(bookmark.visit_count || 0, localStats.count),
        last_visited: localStats.lastVisit || bookmark.last_visited,
      };
    });
  },

  // 获取热门书签
  getPopularBookmarks(limit = 10) {
    const bookmarksWithStats = this.mergeVisitData(this.bookmarks);
    return SimpleSorter.sort(
      bookmarksWithStats,
      "popularity",
      SimpleSorter.DESC,
    ).slice(0, limit);
  },

  // 获取最近访问的书签
  getRecentlyVisited(limit = 10) {
    const bookmarksWithStats = this.mergeVisitData(this.bookmarks);
    return bookmarksWithStats
      .filter((b) => b.last_visited)
      .sort((a, b) => new Date(b.last_visited) - new Date(a.last_visited))
      .slice(0, limit);
  },
};

// 导出到全局作用域
window.BookmarkManager = BookmarkManager;
