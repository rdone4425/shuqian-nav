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
  fallbackTranslations: {
    "bookmarkCard.uncategorized": "\u672a\u5206\u7c7b",
    "bookmarkCard.untitled": "\u672a\u547d\u540d\u7ad9\u70b9",
    "bookmarkCard.hot": "\u5e38\u7528\u7ad9\u70b9",
    "bookmarkCard.visitCount": "\u8bbf\u95ee",
    "bookmarkCard.lastVisited": "\u6700\u8fd1\u8bbf\u95ee",
    "bookmarkCard.open": "\u6253\u5f00\u94fe\u63a5",
    "bookmarkCard.orphanCategory": "\u5206\u7c7b #{id}",
    "bookmarkCard.justNow": "\u521a\u521a",
    "bookmarkCard.minutesAgo": "\u5206\u949f\u524d",
    "bookmarkCard.hoursAgo": "\u5c0f\u65f6\u524d",
    "bookmarkCard.daysAgo": "\u5929\u524d",
    "bookmarkCard.weeksAgo": "\u5468\u524d",
    "filter.allCategories": "\u5168\u90e8\u5206\u7c7b",
    "messages.loadBookmarksFailed": "\u52a0\u8f7d\u4e66\u7b7e\u5931\u8d25",
  },

  async init() {
    this.bindElements();
    this.bindEvents();
    this.restoreUserPreferences();
    const categoriesPromise = this.loadCategories();
    await this.loadBookmarks();
    await categoriesPromise;
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
      categoryRail: "categoryRail",
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
      this.syncCategoryRailState();
      this.loadBookmarks();
      Storage.search.save(
        this.currentFilters.search,
        this.currentFilters.category,
      );
    });

    this.elements.categoryRail?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category-id]");
      if (!button) return;

      this.currentFilters.category = button.dataset.categoryId;
      this.currentPage = 1;
      if (this.elements.categoryFilter) {
        this.elements.categoryFilter.value = this.currentFilters.category;
      }
      this.syncCategoryRailState();
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

    this.elements.bookmarksGrid?.addEventListener("click", (event) => {
      const link = event.target.closest(".bookmark-url");
      if (link) {
        const bookmarkCard = link.closest(".bookmark-card");
        const bookmarkId = bookmarkCard?.dataset.id;
        if (bookmarkId) {
          this.recordVisit(bookmarkId);
        }
      }
    });
  },

  t(key, params = {}) {
    const value = window.I18n?.t?.(key, params);
    if (
      typeof value === "string" &&
      value &&
      value !== key &&
      !value.includes(key)
    ) {
      return this.interpolate(value, params);
    }

    return this.interpolate(this.fallbackTranslations[key] || key, params);
  },

  interpolate(text, params = {}) {
    return Object.entries(params).reduce(
      (result, [name, replacement]) =>
        result.replace(`{${name}}`, String(replacement)),
      text,
    );
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  normalizeCategoryFilter() {
    if (
      this.currentFilters.category &&
      !this.categories.some(
        (category) =>
          String(category.id) === String(this.currentFilters.category),
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
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
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
        this.updatePagination(response.data.pagination);
        this.renderBookmarks();
        this.updateStats();
      } else {
        this.showEmpty();
      }
    } catch (error) {
      console.error("加载书签错误:", error);
      this.showError(error.message || this.t("messages.loadBookmarksFailed"));
    }
  },

  async loadCategories() {
    try {
      const response = await this.fetchJsonOnce("/api/bookmarks/categories");
      if (response.success) {
        this.categories = response.data || [];
      } else {
        this.categories = [];
      }
    } catch (error) {
      console.error("加载分类错误:", error);
      this.categories = [];
    }
    this.normalizeCategoryFilter();
    this.renderCategoryFilter();
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
  },

  createBookmarkCard(bookmark) {
    const hotLabel = this.t("bookmarkCard.hot");
    const visitCountLabel = this.t("bookmarkCard.visitCount");
    const lastVisitedLabel = this.t("bookmarkCard.lastVisited");
    const openLabel = this.t("bookmarkCard.open");

    const localStats = this.getLocalVisitStats(bookmark.id);
    const visitCount = Math.max(bookmark.visit_count || 0, localStats.count);
    const lastVisited = localStats.lastVisit || bookmark.last_visited;
    const popularity = SimpleSorter.calculatePopularity(bookmark);

    const favicon = this.getDisplayFaviconSources(bookmark);
    const title = this.escapeHtml(
      bookmark.title || this.t("bookmarkCard.untitled"),
    );
    const rawUrl = bookmark.url || "";
    const url = this.escapeHtml(rawUrl);
    const description = bookmark.description
      ? this.escapeHtml(bookmark.description)
      : "";
    const category = this.getCategoryDisplay(bookmark);
    const categoryName = category ? this.escapeHtml(category.name) : "";

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

    const catColor = this.escapeHtml(category?.color || "var(--accent)");
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
            <img src="${this.escapeHtml(favicon.src)}" srcset="${this.escapeHtml(favicon.srcSet)}" alt="" aria-hidden="true" class="bookmark-favicon" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${this.escapeHtml(favicon.fallback)}'">
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
        </div>
      </article>
    `;
  },

  getCategoryDisplay(bookmark) {
    const directName = bookmark.category_name || bookmark.category;
    if (directName) {
      return {
        name: String(directName),
        color: bookmark.category_color || this.findCategoryColor(directName),
      };
    }

    const categoryId = bookmark.category_id;
    if (categoryId !== null && categoryId !== undefined && categoryId !== "") {
      const matchedCategory = this.categories.find(
        (category) => String(category.id) === String(categoryId),
      );
      if (matchedCategory) {
        return {
          name: matchedCategory.name,
          color: bookmark.category_color || matchedCategory.color,
        };
      }

      const rawCategoryId = String(categoryId).trim();
      if (!/^\d+$/.test(rawCategoryId)) {
        return {
          name: rawCategoryId,
          color:
            bookmark.category_color || this.findCategoryColor(rawCategoryId),
        };
      }

      return {
        name: this.t("bookmarkCard.orphanCategory", { id: rawCategoryId }),
        color: bookmark.category_color || "var(--accent)",
      };
    }

    return null;
  },

  findCategoryColor(categoryName) {
    const matchedCategory = this.categories.find(
      (category) => category.name === categoryName,
    );
    return matchedCategory?.color || "var(--accent)";
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
    this.renderCategoryRail();
  },

  renderCategoryRail() {
    if (!this.elements.categoryRail) return;

    const allActive = !this.currentFilters.category ? " active" : "";
    const allButton = `
      <button class="category-chip${allActive}" type="button" data-category-id="">
        <span class="category-chip-dot"></span>
        <span>${this.t("filter.allCategories")}</span>
      </button>
    `;

    const categoryButtons = this.categories
      .map((category) => {
        const active =
          String(category.id) === String(this.currentFilters.category)
            ? " active"
            : "";
        const color = this.escapeHtml(category.color || "var(--wr-blue)");
        const id = this.escapeHtml(String(category.id));
        const name = this.escapeHtml(category.name);
        return `
          <button class="category-chip${active}" type="button" data-category-id="${id}" style="--chip-color: ${color}">
            <span class="category-chip-dot"></span>
            <span>${name}</span>
          </button>
        `;
      })
      .join("");

    this.elements.categoryRail.innerHTML = `${allButton}${categoryButtons}`;
    this.syncCategoryRailState();
  },

  syncCategoryRailState() {
    if (!this.elements.categoryRail) return;

    this.elements.categoryRail
      .querySelectorAll(".category-chip")
      .forEach((chip) => {
        chip.classList.toggle(
          "active",
          String(chip.dataset.categoryId || "") ===
            String(this.currentFilters.category || ""),
        );
      });
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

  async refresh() {
    const categoriesPromise = this.loadCategories();
    await this.loadBookmarks();
    await categoriesPromise;
  },

  initClickSorting() {},

  getDisplayFaviconSources(bookmark = {}) {
    const fallback = this.getNormalizedStoredFavicon(bookmark.favicon_url);
    const domainIcon = this.getGoogleFaviconUrl(bookmark.url, 128);
    const retinaIcon = this.getGoogleFaviconUrl(bookmark.url, 256);
    const src = domainIcon || fallback;

    return {
      src,
      srcSet: retinaIcon ? `${src} 1x, ${retinaIcon} 2x` : `${src} 1x`,
      fallback,
    };
  },

  getGoogleFaviconUrl(bookmarkUrl, size = 128) {
    try {
      const url = new URL(bookmarkUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }
      return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.origin)}&sz=${size}`;
    } catch {
      return "";
    }
  },

  getNormalizedStoredFavicon(faviconUrl) {
    if (!faviconUrl) {
      return "/favicon.ico";
    }

    try {
      const url = new URL(faviconUrl, window.location.origin);
      if (
        url.hostname === "www.google.com" &&
        url.pathname === "/s2/favicons"
      ) {
        url.searchParams.set("sz", "128");
      }
      return url.toString();
    } catch {
      return faviconUrl;
    }
  },

  escapeHtml(text = "") {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

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
