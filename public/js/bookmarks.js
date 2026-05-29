const BookmarkManager = {
  bookmarks: [],
  categories: [],
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,

  currentFilters: {
    search: "",
    category: "",
    sortBy: "created_at",
    sortOrder: "desc",
  },

  elements: {},

  defaultCategories: [
    { id: "default-search", name: "搜索", color: "#2563eb" },
    { id: "default-dev", name: "开发", color: "#16a34a" },
    { id: "default-tools", name: "工具", color: "#7c3aed" },
    { id: "default-design", name: "设计", color: "#db2777" },
    { id: "default-news", name: "资讯", color: "#ea580c" },
  ],

  defaultBookmarks: [
    {
      id: "default-google",
      title: "Google",
      url: "https://www.google.com",
      description: "全球搜索入口，适合信息检索、资料查询和日常访问。",
      category_id: "default-search",
      category_name: "搜索",
      category_color: "#2563eb",
      favicon_url: "https://www.google.com/s2/favicons?domain=google.com&sz=32",
      visit_count: 96,
      created_at: "2026-01-01T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-bing",
      title: "Bing",
      url: "https://www.bing.com",
      description: "微软搜索服务，适合网页、图片、新闻和 AI 辅助搜索。",
      category_id: "default-search",
      category_name: "搜索",
      category_color: "#2563eb",
      favicon_url: "https://www.google.com/s2/favicons?domain=bing.com&sz=32",
      visit_count: 74,
      created_at: "2026-01-02T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-baidu",
      title: "百度",
      url: "https://www.baidu.com",
      description: "中文搜索和本地化内容入口。",
      category_id: "default-search",
      category_name: "搜索",
      category_color: "#2563eb",
      favicon_url: "https://www.google.com/s2/favicons?domain=baidu.com&sz=32",
      visit_count: 64,
      created_at: "2026-01-03T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-github",
      title: "GitHub",
      url: "https://github.com",
      description: "代码托管、开源项目和工程协作入口。",
      category_id: "default-dev",
      category_name: "开发",
      category_color: "#16a34a",
      favicon_url: "https://www.google.com/s2/favicons?domain=github.com&sz=32",
      visit_count: 118,
      created_at: "2026-01-04T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-mdn",
      title: "MDN Web Docs",
      url: "https://developer.mozilla.org",
      description: "前端标准、浏览器 API 和 Web 技术文档。",
      category_id: "default-dev",
      category_name: "开发",
      category_color: "#16a34a",
      favicon_url: "https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32",
      visit_count: 90,
      created_at: "2026-01-05T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-stackoverflow",
      title: "Stack Overflow",
      url: "https://stackoverflow.com",
      description: "开发问题检索、排错和社区问答。",
      category_id: "default-dev",
      category_name: "开发",
      category_color: "#16a34a",
      favicon_url: "https://www.google.com/s2/favicons?domain=stackoverflow.com&sz=32",
      visit_count: 82,
      created_at: "2026-01-06T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-npm",
      title: "npm",
      url: "https://www.npmjs.com",
      description: "JavaScript 包搜索、版本信息和依赖文档。",
      category_id: "default-dev",
      category_name: "开发",
      category_color: "#16a34a",
      favicon_url: "https://www.google.com/s2/favicons?domain=npmjs.com&sz=32",
      visit_count: 58,
      created_at: "2026-01-07T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-chatgpt",
      title: "ChatGPT",
      url: "https://chatgpt.com",
      description: "写作、分析、代码和日常问题处理。",
      category_id: "default-tools",
      category_name: "工具",
      category_color: "#7c3aed",
      favicon_url: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=32",
      visit_count: 130,
      created_at: "2026-01-08T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-cloudflare",
      title: "Cloudflare",
      url: "https://dash.cloudflare.com",
      description: "域名、DNS、Workers 和网站安全管理。",
      category_id: "default-tools",
      category_name: "工具",
      category_color: "#7c3aed",
      favicon_url: "https://www.google.com/s2/favicons?domain=cloudflare.com&sz=32",
      visit_count: 48,
      created_at: "2026-01-09T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-vercel",
      title: "Vercel",
      url: "https://vercel.com",
      description: "前端部署、项目预览和站点托管。",
      category_id: "default-tools",
      category_name: "工具",
      category_color: "#7c3aed",
      favicon_url: "https://www.google.com/s2/favicons?domain=vercel.com&sz=32",
      visit_count: 42,
      created_at: "2026-01-10T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-figma",
      title: "Figma",
      url: "https://www.figma.com",
      description: "界面设计、原型协作和设计稿交付。",
      category_id: "default-design",
      category_name: "设计",
      category_color: "#db2777",
      favicon_url: "https://www.google.com/s2/favicons?domain=figma.com&sz=32",
      visit_count: 55,
      created_at: "2026-01-11T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-iconify",
      title: "Iconify",
      url: "https://icon-sets.iconify.design",
      description: "图标集合检索和 SVG 图标资源。",
      category_id: "default-design",
      category_name: "设计",
      category_color: "#db2777",
      favicon_url: "https://www.google.com/s2/favicons?domain=iconify.design&sz=32",
      visit_count: 33,
      created_at: "2026-01-12T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-sspai",
      title: "少数派",
      url: "https://sspai.com",
      description: "效率工具、数字生活和科技内容。",
      category_id: "default-news",
      category_name: "资讯",
      category_color: "#ea580c",
      favicon_url: "https://www.google.com/s2/favicons?domain=sspai.com&sz=32",
      visit_count: 47,
      created_at: "2026-01-13T00:00:00.000Z",
      is_default: true,
    },
    {
      id: "default-ruanyifeng",
      title: "阮一峰的网络日志",
      url: "https://www.ruanyifeng.com/blog/",
      description: "技术文章、周刊和互联网观察。",
      category_id: "default-news",
      category_name: "资讯",
      category_color: "#ea580c",
      favicon_url: "https://www.google.com/s2/favicons?domain=ruanyifeng.com&sz=32",
      visit_count: 61,
      created_at: "2026-01-14T00:00:00.000Z",
      is_default: true,
    },
  ],

  async init() {
    this.bindElements();
    this.bindEvents();
    this.restoreUserPreferences();
    await this.loadCategories();
    await this.loadBookmarks();
  },

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

  bindEvents() {
    this.elements.categoryFilter?.addEventListener("change", (event) => {
      this.currentFilters.category = event.target.value;
      this.currentPage = 1;
      this.loadBookmarks();
      Storage.search.save(
        this.currentFilters.search,
        this.currentFilters.category,
      );
    });

    this.elements.sortSelect?.addEventListener("change", (event) => {
      const [sortBy, sortOrder] = event.target.value.split(":");
      this.currentFilters.sortBy = sortBy;
      this.currentFilters.sortOrder = sortOrder;
      this.currentPage = 1;
      this.loadBookmarks();
      Storage.sort.set(sortBy, sortOrder);
    });

    this.elements.searchInput?.addEventListener(
      "input",
      this.debounce((event) => {
        this.currentFilters.search = event.target.value.trim();
        this.currentPage = 1;
        this.loadBookmarks();
        Storage.search.save(
          this.currentFilters.search,
          this.currentFilters.category,
        );
      }, 300),
    );

    this.elements.prevPageBtn?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage -= 1;
        this.loadBookmarks();
      }
    });

    this.elements.nextPageBtn?.addEventListener("click", () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage += 1;
        this.loadBookmarks();
      }
    });

    document.getElementById("retryBtn")?.addEventListener("click", () => {
      this.loadBookmarks();
    });
  },

  t(key, params = {}) {
    return window.I18n?.t(key, params) || key;
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  getDefaultCategories() {
    return this.defaultCategories.map((category) => ({ ...category }));
  },

  getDefaultBookmarks() {
    return this.defaultBookmarks.map((bookmark) => ({ ...bookmark }));
  },

  normalizeCategoryFilter() {
    if (
      this.currentFilters.category &&
      !this.categories.some(
        (category) => String(category.id) === String(this.currentFilters.category),
      )
    ) {
      this.currentFilters.category = "";
    }
  },

  async fetchJsonOnce(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${path}?${query}` : path;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  },

  getFilteredDefaultBookmarks() {
    const keyword = this.currentFilters.search.trim().toLowerCase();
    const categoryId = this.currentFilters.category;

    let bookmarks = this.getDefaultBookmarks().filter((bookmark) => {
      const matchesCategory = !categoryId || bookmark.category_id === categoryId;
      if (!matchesCategory) return false;
      if (!keyword) return true;

      return [bookmark.title, bookmark.url, bookmark.description, bookmark.category_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword));
    });

    const direction = this.currentFilters.sortOrder === "asc" ? 1 : -1;
    const sortBy = this.currentFilters.sortBy;

    bookmarks = bookmarks.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "zh-CN") * direction;
      }
      if (sortBy === "visit_count" || sortBy === "popularity") {
        return ((a.visit_count || 0) - (b.visit_count || 0)) * direction;
      }
      return (new Date(a.created_at) - new Date(b.created_at)) * direction;
    });

    return bookmarks;
  },

  useDefaultBookmarks() {
    if (!this.categories.length) {
      this.categories = this.getDefaultCategories();
      this.renderCategoryFilter();
    }
    this.normalizeCategoryFilter();

    const allBookmarks = this.getFilteredDefaultBookmarks();
    const pageSize = 20;
    const total = allBookmarks.length;
    this.totalPages = Math.max(1, Math.ceil(total / pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);

    const start = (this.currentPage - 1) * pageSize;
    this.bookmarks = allBookmarks.slice(start, start + pageSize);
    this.updatePagination({
      page: this.currentPage,
      totalPages: this.totalPages,
      total,
      hasPrev: this.currentPage > 1,
      hasNext: this.currentPage < this.totalPages,
    });
    this.renderBookmarks();
    this.updateStats();
  },

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

      const response = await this.fetchJsonOnce("/api/bookmarks", params);

      if (response.success) {
        this.bookmarks = response.data.bookmarks || [];
        if (this.bookmarks.length === 0) {
          this.useDefaultBookmarks();
          return;
        }
        this.updatePagination(response.data.pagination);
        this.renderBookmarks();
        this.updateStats();
      } else {
        this.useDefaultBookmarks();
      }
    } catch (error) {
      console.error("加载书签错误:", error);
      this.useDefaultBookmarks();
    }
  },

  async loadCategories() {
    try {
      const response = await this.fetchJsonOnce("/api/bookmarks/categories");
      if (response.success) {
        this.categories = response.data || [];
        if (this.categories.length === 0) {
          this.categories = this.getDefaultCategories();
        }
        this.normalizeCategoryFilter();
        this.renderCategoryFilter();
      } else {
        this.categories = this.getDefaultCategories();
        this.normalizeCategoryFilter();
        this.renderCategoryFilter();
      }
    } catch (error) {
      console.error("加载分类错误:", error);
      this.categories = this.getDefaultCategories();
      this.normalizeCategoryFilter();
      this.renderCategoryFilter();
    }
  },

  renderBookmarks() {
    if (!this.elements.bookmarksGrid) return;

    if (this.bookmarks.length === 0) {
      this.elements.bookmarksGrid.innerHTML = "";
      this.showEmpty();
      return;
    }

    this.hideStates();
    this.elements.bookmarksGrid.innerHTML = this.bookmarks
      .map((bookmark) => this.createBookmarkCard(bookmark))
      .join("");

    this.bindBookmarkEvents();
  },

  createBookmarkCard(bookmark) {
    const hotLabel = this.t("bookmarkCard.hot");
    const visitCountLabel = this.t("bookmarkCard.visitCount");
    const lastVisitedLabel = this.t("bookmarkCard.lastVisited");
    const editLabel = this.t("bookmarkCard.edit");
    const deleteLabel = this.t("bookmarkCard.delete");
    const openLabel = this.t("bookmarkCard.open");

    const localStats = this.getLocalVisitStats(bookmark.id);
    const visitCount = Math.max(bookmark.visit_count || 0, localStats.count);
    const lastVisited = localStats.lastVisit || bookmark.last_visited;
    const popularity = SimpleSorter.calculatePopularity(bookmark);

    const faviconUrl = bookmark.favicon_url || "/favicon.ico";
    const title = this.escapeHtml(
      bookmark.title || this.t("bookmarkCard.untitled"),
    );
    const rawUrl = bookmark.url || "";
    const url = this.escapeHtml(rawUrl);
    const description = bookmark.description
      ? this.escapeHtml(bookmark.description)
      : "";
    const categoryName = bookmark.category_name
      ? this.escapeHtml(bookmark.category_name)
      : "";

    const statsParts = [];
    if (visitCount > 0) {
      statsParts.push(
        `<span class="visit-count" title="${this.escapeHtml(visitCountLabel)}">${visitCountLabel} ${visitCount}</span>`,
      );
    }
    if (lastVisited) {
      statsParts.push(
        `<span class="last-visited" title="${this.escapeHtml(lastVisitedLabel)}">${this.formatRelativeTime(lastVisited)}</span>`,
      );
    }

    const catColor = this.escapeHtml(bookmark.category_color || "var(--accent)");
    const categoryBadge = categoryName
      ? `<div class="bookmark-category" style="background-color: ${catColor}25; color: ${catColor}; border: 1px solid ${catColor}40;"><span class="category-dot" style="background-color: ${catColor};"></span><span>${categoryName}</span></div>`
      : `<span class="bookmark-id">${this.t("bookmarkCard.uncategorized")}</span>`;

    const hotBadge =
      popularity > 50
        ? `<span class="hot-badge" title="${this.escapeHtml(hotLabel)}">HOT</span>`
        : "";

    return `
      <article class="bookmark-card" data-id="${bookmark.id}" style="--card-accent: ${catColor}">
        <div class="bookmark-card-top">
          <div class="bookmark-favicon-wrap">
            <img src="${this.escapeHtml(faviconUrl)}" alt="" aria-hidden="true" class="bookmark-favicon" onerror="this.src='/favicon.ico'">
          </div>
          <div class="bookmark-main">
            <div class="bookmark-title-row">
              <h3 class="bookmark-title">${title}</h3>
              ${hotBadge}
            </div>
            <a href="${this.escapeHtml(rawUrl)}" target="_blank" class="bookmark-url" rel="noopener noreferrer" aria-label="${this.escapeHtml(openLabel)} ${title}">${url}</a>
          </div>
        </div>

        ${description ? `<p class="bookmark-description">${description}</p>` : ""}

        ${statsParts.length ? `<div class="bookmark-stats">${statsParts.join("")}</div>` : ""}

        <div class="bookmark-footer">
          <div class="bookmark-meta">${categoryBadge}</div>
          ${
            bookmark.is_default
              ? ""
              : `<div class="bookmark-actions">
                  <button class="action-btn edit-btn" data-id="${bookmark.id}" title="${this.escapeHtml(editLabel)}">
                    <span class="action-icon">Edit</span>
                    <span class="action-text">${this.escapeHtml(editLabel)}</span>
                  </button>
                  <button class="action-btn delete-btn" data-id="${bookmark.id}" title="${this.escapeHtml(deleteLabel)}">
                    <span class="action-icon">Del</span>
                    <span class="action-text">${this.escapeHtml(deleteLabel)}</span>
                  </button>
                </div>`
          }
        </div>
      </article>
    `;
  },

  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return this.t("bookmarkCard.justNow");
    if (diffMinutes < 60) {
      return `${diffMinutes}${this.t("bookmarkCard.minutesAgo")}`;
    }
    if (diffHours < 24) return `${diffHours}${this.t("bookmarkCard.hoursAgo")}`;
    if (diffDays < 7) return `${diffDays}${this.t("bookmarkCard.daysAgo")}`;
    if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)}${this.t("bookmarkCard.weeksAgo")}`;
    }
    return date.toLocaleDateString();
  },

  bindBookmarkEvents() {
    document.querySelectorAll(".bookmark-url").forEach((link) => {
      link.addEventListener("click", () => {
        const bookmarkCard = link.closest(".bookmark-card");
        const bookmarkId = bookmarkCard?.dataset.id;
        if (bookmarkId) {
          this.recordVisit(bookmarkId);
        }
      });
    });

    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.editBookmark(btn.dataset.id);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.deleteBookmark(btn.dataset.id);
      });
    });
  },

  renderCategoryFilter() {
    if (!this.elements.categoryFilter) return;

    const optionsHTML = this.categories
      .map(
        (category) =>
          `<option value="${category.id}">${this.escapeHtml(category.name)}</option>`,
      )
      .join("");

    this.elements.categoryFilter.innerHTML = `
      <option value="">${this.t("filter.allCategories")}</option>
      ${optionsHTML}
    `;
    this.elements.categoryFilter.value = this.currentFilters.category || "";
  },

  updatePagination(pagination = {}) {
    this.currentPage = pagination.page || 1;
    this.totalPages = pagination.totalPages || 1;
    this.totalCount = pagination.total || 0;

    if (this.elements.prevPageBtn) {
      this.elements.prevPageBtn.disabled = !pagination.hasPrev;
    }
    if (this.elements.nextPageBtn) {
      this.elements.nextPageBtn.disabled = !pagination.hasNext;
    }

    this.renderPageNumbers();

    if (this.elements.paginationContainer) {
      this.elements.paginationContainer.classList.toggle(
        "hidden",
        this.totalPages <= 1,
      );
      this.elements.paginationContainer.setAttribute(
        "aria-hidden",
        this.totalPages <= 1 ? "true" : "false",
      );
    }
  },

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

    if (startPage > 1) {
      pagesHTML += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        pagesHTML += `<span class="page-ellipsis">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i += 1) {
      const activeClass = i === this.currentPage ? "active" : "";
      pagesHTML += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }

    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        pagesHTML += `<span class="page-ellipsis">...</span>`;
      }
      pagesHTML += `<button class="page-btn" data-page="${this.totalPages}">${this.totalPages}</button>`;
    }

    this.elements.pageNumbers.innerHTML = pagesHTML;

    this.elements.pageNumbers.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page !== this.currentPage) {
          this.currentPage = page;
          this.loadBookmarks();
        }
      });
    });
  },

  updateStats() {
    if (this.elements.totalCount) {
      this.elements.totalCount.textContent = String(this.totalCount);
    }
    if (this.elements.currentPageInfo) {
      if (this.totalCount === 0) {
        this.elements.currentPageInfo.textContent = "0";
        return;
      }

      const start = (this.currentPage - 1) * 20 + 1;
      const end = Math.min(this.currentPage * 20, this.totalCount);
      this.elements.currentPageInfo.textContent = `${start}-${end}`;
    }
  },

  showLoading() {
    DOMHelper.setState("loading");
  },

  showEmpty() {
    DOMHelper.setState("empty");
  },

  showError(message) {
    DOMHelper.setState("error", { message });
  },

  hideStates() {
    DOMHelper.hide("loadingState", "emptyState", "errorState");
  },

  restoreUserPreferences() {
    const sortPreference = Storage.sort.get();
    this.currentFilters.sortBy = sortPreference.sortBy;
    this.currentFilters.sortOrder = sortPreference.sortOrder;

    if (this.elements.sortSelect) {
      this.elements.sortSelect.value = `${sortPreference.sortBy}:${sortPreference.sortOrder}`;
    }

    const lastSearch = Storage.search.getLast();
    if (lastSearch.query) {
      this.currentFilters.search = lastSearch.query;
      if (this.elements.searchInput) {
        this.elements.searchInput.value = lastSearch.query;
      }
    }

    if (lastSearch.category) {
      this.currentFilters.category = lastSearch.category;
    }
  },

  async editBookmark(bookmarkId) {
    if (window.App?.editBookmark) {
      window.App.editBookmark(bookmarkId);
    }
  },

  async deleteBookmark(bookmarkId) {
    if (window.App?.deleteBookmark) {
      window.App.deleteBookmark(bookmarkId);
    }
  },

  escapeHtml(text = "") {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  async refresh() {
    await this.loadCategories();
    await this.loadBookmarks();
  },

  initClickSorting() {},

  async recordVisit(bookmarkId) {
    try {
      if (!String(bookmarkId).startsWith("default-")) {
        await BookmarkAPI.recordVisit(bookmarkId);
      }

      const bookmark = this.bookmarks.find(
        (item) => String(item.id) === String(bookmarkId),
      );
      if (bookmark) {
        bookmark.visit_count = (bookmark.visit_count || 0) + 1;
        bookmark.last_visited = new Date().toISOString();
      }

      this.saveVisitToLocal(bookmarkId);
    } catch (error) {
      console.error("记录访问失败:", error);
      this.saveVisitToLocal(bookmarkId);
    }
  },

  saveVisitToLocal(bookmarkId) {
    const visits = JSON.parse(localStorage.getItem("bookmark_visits") || "{}");
    const today = new Date().toDateString();

    if (!visits[bookmarkId]) {
      visits[bookmarkId] = { count: 0, lastVisit: null, dailyVisits: {} };
    }

    visits[bookmarkId].count += 1;
    visits[bookmarkId].lastVisit = new Date().toISOString();
    visits[bookmarkId].dailyVisits[today] =
      (visits[bookmarkId].dailyVisits[today] || 0) + 1;

    localStorage.setItem("bookmark_visits", JSON.stringify(visits));
  },

  getLocalVisitStats(bookmarkId) {
    const visits = JSON.parse(localStorage.getItem("bookmark_visits") || "{}");
    return visits[bookmarkId] || { count: 0, lastVisit: null, dailyVisits: {} };
  },

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

  getPopularBookmarks(limit = 10) {
    const bookmarksWithStats = this.mergeVisitData(this.bookmarks);
    return SimpleSorter.sort(
      bookmarksWithStats,
      "popularity",
      SimpleSorter.DESC,
    ).slice(0, limit);
  },

  getRecentlyVisited(limit = 10) {
    const bookmarksWithStats = this.mergeVisitData(this.bookmarks);
    return bookmarksWithStats
      .filter((bookmark) => bookmark.last_visited)
      .sort((a, b) => new Date(b.last_visited) - new Date(a.last_visited))
      .slice(0, limit);
  },
};

window.BookmarkManager = BookmarkManager;
