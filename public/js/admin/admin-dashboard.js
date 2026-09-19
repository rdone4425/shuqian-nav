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
      trashTotal: document.getElementById("dashboardTrashTotal"),
      trashEligible: document.getElementById("dashboardTrashEligible"),
      lastCheck: document.getElementById("dashboardLastCheck"),
      backupStatus: document.getElementById("dashboardBackupStatus"),
      popularBookmarks: document.getElementById("dashboardPopularBookmarks"),
    };
  },

  async load() {
    try {
      const [
        bookmarksResponse,
        categoriesResponse,
        trashResponse,
        checkResponse,
        backupResponse,
        popularResponse,
      ] = await Promise.allSettled([
        BookmarkAPI.getBookmarks({
          page: 1,
          limit: 5,
          sortBy: "created_at",
          sortOrder: "desc",
        }),
        BookmarkAPI.getCategories(),
        API.get("/api/system/trash-cleanup"),
        API.get("/api/system/check-links"),
        API.get("/api/system/backup-auto?action=status"),
        API.get("/api/analytics?type=popular&limit=5"),
      ]);

      const bookmarks =
        bookmarksResponse.status === "fulfilled"
          ? bookmarksResponse.value?.data?.bookmarks || []
          : [];
      const pagination =
        bookmarksResponse.status === "fulfilled"
          ? bookmarksResponse.value?.data?.pagination || {}
          : {};
      const categories =
        categoriesResponse.status === "fulfilled"
          ? categoriesResponse.value?.data || []
          : [];

      this.setText(this.elements.bookmarkTotal, pagination.total ?? 0);
      this.setText(this.elements.categoryTotal, categories.length);
      this.setText(this.elements.visibleTotal, bookmarks.length);
      this.setText(
        this.elements.visitedTotal,
        bookmarks.filter((bookmark) => bookmark.last_visited).length,
      );
      this.renderRecentBookmarks(bookmarks);
      this.renderCategories(categories);
      this.renderTrash(trashResponse);
      this.renderLastCheck(checkResponse);
      this.renderBackup(backupResponse);
      this.renderPopular(popularResponse);
    } catch (error) {
      console.error("Dashboard load failed:", error);
      AdminUI.showToast(`后台摘要加载失败: ${error.message}`, "error");
      this.renderError();
    }
  },

  getFulfilledValue(result, fallback = null) {
    if (result?.status !== "fulfilled" || !result.value?.success) {
      return fallback;
    }
    return result.value.data;
  },

  renderTrash(result) {
    const data = this.getFulfilledValue(result);
    this.setText(
      this.elements.trashTotal,
      data ? (data.totalDeleted ?? 0) : "-",
    );
    this.setText(
      this.elements.trashEligible,
      data ? (data.eligibleDeleted ?? 0) : "-",
    );
  },

  renderLastCheck(result) {
    const history = this.getFulfilledValue(result, []);
    const latest = Array.isArray(history) ? history[0] : null;
    this.setText(
      this.elements.lastCheck,
      latest?.checkedAt || latest?.timestamp
        ? AdminUI.formatDate(latest.checkedAt || latest.timestamp)
        : "暂无记录",
    );
  },

  renderBackup(result) {
    const data = this.getFulfilledValue(result);
    this.setText(
      this.elements.backupStatus,
      data ? (data.r2Configured ? "R2 已配置" : "本地模式") : "-",
    );
  },

  renderPopular(result) {
    const data = this.getFulfilledValue(result, { popularBookmarks: [] });
    const popularBookmarks = data?.popularBookmarks || [];
    if (!this.elements.popularBookmarks) return;

    if (!popularBookmarks.length) {
      this.elements.popularBookmarks.innerHTML =
        "<p>还没有可展示的热门书签。</p>";
      return;
    }

    this.elements.popularBookmarks.innerHTML = popularBookmarks
      .slice(0, 5)
      .map(
        (bookmark) => `
          <div class="admin-dashboard-row">
            <span class="admin-row-mark"></span>
            <div>
              <strong>${AdminUI.escapeHtml(bookmark.title || "未命名站点")}</strong>
              <span>${Number(bookmark.visit_count ?? 0)} 次访问</span>
            </div>
          </div>
        `,
      )
      .join("");
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
    this.setText(this.elements.trashTotal, "!");
    this.setText(this.elements.trashEligible, "!");
    this.setText(this.elements.lastCheck, "!");
    this.setText(this.elements.backupStatus, "!");
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

// 30-day trend chart
async function loadTrendChart() {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  try {
    const token =
      localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
    const res = await fetch("/api/analytics/trend", {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    if (!res.ok) return;
    const data = await res.json();
    const points = data.data?.data || [];
    if (points.length === 0) {
      ctx.fillStyle = "var(--text-muted, #748399)";
      ctx.font = "12px sans-serif";
      ctx.fillText("暂无访问数据", canvas.width / 2 - 40, canvas.height / 2);
      return;
    }
    const w = canvas.width;
    const h = canvas.height;
    const maxVal = Math.max(...points.map((p) => p.visits), 1);
    const stepX = w / (points.length + 1);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    points.forEach((p, i) => {
      const x = stepX * (i + 1);
      const y = h - (p.visits / maxVal) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw area
    ctx.lineTo(stepX * points.length, h);
    ctx.lineTo(stepX, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
    ctx.fill();

    // Draw dots
    points.forEach((p, i) => {
      const x = stepX * (i + 1);
      const y = h - (p.visits / maxVal) * (h - 20) - 10;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();
    });

    // Labels (first and last date)
    ctx.fillStyle = "#748399";
    ctx.font = "10px sans-serif";
    ctx.fillText(points[0].date, 4, h - 2);
    const lastLabel = points[points.length - 1].date;
    ctx.fillText(lastLabel, w - 50, h - 2);

    // Max value label
    ctx.fillText("max: " + maxVal, w - 60, 12);
  } catch (e) {
    console.warn("Trend chart load failed:", e);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  loadTrendChart();
});
