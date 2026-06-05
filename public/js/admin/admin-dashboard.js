const AdminDashboardPage = {
  elements: {},

  async init() {
    const authenticated = await AdminUI.requireAuth();
    if (!authenticated) return;

    this.bindElements();
    await this.load();
  },

  bindElements() {
    this.elements = {
      bookmarkTotal: document.getElementById("dashboardBookmarkTotal"),
      categoryTotal: document.getElementById("dashboardCategoryTotal"),
      visibleTotal: document.getElementById("dashboardVisibleTotal"),
      visitedTotal: document.getElementById("dashboardVisitedTotal"),
      recentBookmarks: document.getElementById("dashboardRecentBookmarks"),
      categories: document.getElementById("dashboardCategories"),
    };
  },

  async load() {
    try {
      const [bookmarksResponse, categoriesResponse] = await Promise.all([
        BookmarkAPI.getBookmarks({
          page: 1,
          limit: 5,
          sortBy: "created_at",
          sortOrder: "desc",
        }),
        BookmarkAPI.getCategories(),
      ]);

      const bookmarks = bookmarksResponse.data?.bookmarks || [];
      const pagination = bookmarksResponse.data?.pagination || {};
      const categories = categoriesResponse.data || [];

      this.setText(this.elements.bookmarkTotal, pagination.total ?? 0);
      this.setText(this.elements.categoryTotal, categories.length);
      this.setText(this.elements.visibleTotal, bookmarks.length);
      this.setText(
        this.elements.visitedTotal,
        bookmarks.filter((bookmark) => bookmark.last_visited).length,
      );
      this.renderRecentBookmarks(bookmarks);
      this.renderCategories(categories);
    } catch (error) {
      console.error("Dashboard load failed:", error);
      AdminUI.showToast(`后台摘要加载失败: ${error.message}`, "error");
      this.renderError();
    }
  },

  renderRecentBookmarks(bookmarks) {
    if (!this.elements.recentBookmarks) return;
    if (!bookmarks.length) {
      this.elements.recentBookmarks.innerHTML =
        "<p>还没有书签。可以从书签管理页添加第一条。</p>";
      return;
    }

    this.elements.recentBookmarks.innerHTML = bookmarks
      .map(
        (bookmark) => `
          <div class="admin-dashboard-row">
            <span class="admin-row-mark"></span>
            <div>
              <strong>${AdminUI.escapeHtml(bookmark.title || "未命名站点")}</strong>
              <span>${AdminUI.escapeHtml(bookmark.url || "")}</span>
            </div>
          </div>
        `,
      )
      .join("");
  },

  renderCategories(categories) {
    if (!this.elements.categories) return;
    if (!categories.length) {
      this.elements.categories.innerHTML =
        "<p>还没有分类。可以从分类管理页创建分类。</p>";
      return;
    }

    this.elements.categories.innerHTML = categories
      .slice(0, 6)
      .map(
        (category) => `
          <div class="admin-dashboard-row">
            <span class="admin-row-mark" style="--row-mark: ${AdminUI.escapeHtml(category.color || "#2764e7")}"></span>
            <div>
              <strong>${AdminUI.escapeHtml(category.name || "未命名分类")}</strong>
              <span>${Number(category.bookmark_count || 0)} 条书签</span>
            </div>
          </div>
        `,
      )
      .join("");
  },

  renderError() {
    this.setText(this.elements.bookmarkTotal, "!");
    this.setText(this.elements.categoryTotal, "!");
    this.setText(this.elements.visibleTotal, "!");
    this.setText(this.elements.visitedTotal, "!");
    if (this.elements.recentBookmarks) {
      this.elements.recentBookmarks.innerHTML = "<p>后台摘要加载失败。</p>";
    }
    if (this.elements.categories) {
      this.elements.categories.innerHTML = "<p>分类摘要加载失败。</p>";
    }
  },

  setText(element, value) {
    if (element) {
      element.textContent = String(value);
    }
  },
};

// 旧多页结构下自启动；在 SPA 外壳 /admin.html 内由路由器调用 init()。
if (!window.location.pathname.endsWith("/admin.html")) {
  document.addEventListener("DOMContentLoaded", () => {
    AdminDashboardPage.init();
  });
}

window.AdminDashboardPage = AdminDashboardPage;
