const NotificationsPage = {
  state: {
    items: [],
    filter: "all",
    loading: false,
  },

  async init() {
    const authenticated = await AdminUI.requireAuth();
    if (!authenticated) return;

    document
      .getElementById("refreshBtn")
      .addEventListener("click", () => this.loadNotifications());
    document
      .getElementById("notificationFilter")
      .addEventListener("change", (event) => {
        this.state.filter = event.target.value;
        this.renderNotifications();
      });
    document
      .getElementById("refreshAuditBtn")
      ?.addEventListener("click", () => this.loadAuditLogs());
    await Promise.all([this.loadNotifications(), this.loadAuditLogs()]);
  },

  getAuditLabel(action) {
    const labels = {
      trash_cleanup: "回收站自动清理",
      trash_batch_delete: "批量删除回收站",
      import_bookmarks: "导入书签",
      password_change: "修改管理员密码",
      backup_create: "创建备份",
    };
    return labels[action] || action;
  },

  getAuditSummary(details = {}) {
    const parts = [];
    if (typeof details.deleted === "number")
      parts.push(`删除 ${details.deleted} 条`);
    if (typeof details.imported === "number")
      parts.push(`新增 ${details.imported} 条`);
    if (typeof details.updated === "number")
      parts.push(`覆盖 ${details.updated} 条`);
    if (typeof details.skipped === "number")
      parts.push(`跳过 ${details.skipped} 条`);
    if (typeof details.errors === "number")
      parts.push(`失败 ${details.errors} 条`);
    if (details.source) parts.push(`来源 ${details.source}`);
    if (details.type) parts.push(`类型 ${details.type}`);
    return parts.join("，") || "无详情";
  },

  async loadAuditLogs() {
    const listEl = document.getElementById("auditList");
    if (!listEl) return;

    try {
      const response = await API.get("/api/system/audit-logs?limit=20");
      if (!response.success) {
        throw new Error(response.error || "加载操作日志失败");
      }

      const logs = response.data || [];
      if (!logs.length) {
        listEl.innerHTML =
          '<div class="notification-description">暂无操作日志。</div>';
        return;
      }

      listEl.innerHTML = logs
        .map(
          (log) => `
            <div class="audit-item">
              <div>
                <strong>${AdminUI.escapeHtml(this.getAuditLabel(log.action))}</strong>
                <div>${AdminUI.escapeHtml(this.getAuditSummary(log.details))}</div>
              </div>
              <span>${AdminUI.formatDate(log.loggedAt || log.createdAt)}</span>
            </div>
          `,
        )
        .join("");
    } catch (error) {
      listEl.innerHTML = `<div class="notification-description">操作日志加载失败：${AdminUI.escapeHtml(error.message)}</div>`;
    }
  },

  getNotificationLabel(type) {
    if (type === "weekly_check_notification") return "自动通知";
    if (type === "weekly_auto_check") return "自动检查";
    return "系统记录";
  },

  getInaccessibleCount(item) {
    return item.inaccessible ?? item.inaccessibleCount ?? 0;
  },

  matchesFilter(item) {
    const inaccessible = this.getInaccessibleCount(item);
    switch (this.state.filter) {
      case "issues":
        return inaccessible > 0;
      case "clean":
        return inaccessible === 0;
      case "weekly_auto_check":
      case "weekly_check_notification":
        return item.type === this.state.filter;
      case "all":
      default:
        return true;
    }
  },

  getFilterLabel() {
    const filter = document.getElementById("notificationFilter");
    return filter?.selectedOptions?.[0]?.textContent || "全部记录";
  },

  renderNotificationItem(item) {
    const typeLabel = this.getNotificationLabel(item.type);
    const sample = item.inaccessibleBookmarks || [];
    const total =
      typeof item.total === "number" ? item.total : item.inaccessibleCount || 0;
    const inaccessible = this.getInaccessibleCount(item);
    const deleted =
      typeof item.deleted === "number" ? item.deleted : item.deletedCount || 0;
    const statusClass =
      inaccessible > 0
        ? "critical"
        : item.type === "weekly_auto_check"
          ? "important"
          : "unread";

    return `
      <article class="notification-item ${statusClass}">
        <div class="notification-header">
          <div class="notification-info">
            <h3 class="notification-title">${typeLabel}</h3>
            <p class="notification-subtitle">${AdminUI.formatDate(item.checkedAt || item.timestamp || item.createdAt)}</p>
          </div>
        </div>
        <div class="notification-content">
          <p class="notification-description">
            ${
              inaccessible > 0
                ? `发现 ${inaccessible} 个不可访问链接。`
                : "本次运行没有发现不可访问链接。"
            }
          </p>
        </div>
        <div class="notification-stats">
          <div class="stat-group"><span class="stat-text">已检查</span><span class="stat-value">${total}</span></div>
          <div class="stat-group"><span class="stat-text">可访问</span><span class="stat-value">${item.accessible ?? 0}</span></div>
          <div class="stat-group"><span class="stat-text">不可访问</span><span class="stat-value">${inaccessible}</span></div>
          <div class="stat-group"><span class="stat-text">已删除</span><span class="stat-value">${deleted}</span></div>
        </div>
        ${
          sample.length
            ? `<div class="notification-content"><div class="notification-description"><strong>示例：</strong><ul>${sample
                .slice(0, 5)
                .map(
                  (bookmark) =>
                    `<li>${AdminUI.escapeHtml(bookmark.title || bookmark.url || "未命名")}${
                      bookmark.url
                        ? ` - ${AdminUI.escapeHtml(bookmark.url)}`
                        : ""
                    }</li>`,
                )
                .join("")}</ul></div></div>`
            : ""
        }
        <div class="notification-actions">
          <a class="btn btn-secondary btn-sm" href="/link-checker.html">去检查链接</a>
          <a class="btn btn-outline btn-sm" href="/deleted-bookmarks.html">去回收站</a>
        </div>
      </article>
    `;
  },

  updateSummary(items, visibleItems) {
    const totalChecks = items.length;
    const totalInaccessible = items.reduce(
      (sum, item) => sum + this.getInaccessibleCount(item),
      0,
    );
    const lastItem = items[0];
    document.getElementById("totalChecks").textContent = totalChecks;
    document.getElementById("totalInaccessible").textContent =
      totalInaccessible;
    document.getElementById("visibleNotifications").textContent =
      visibleItems.length;
    document.getElementById("lastCheckTime").textContent = lastItem
      ? AdminUI.formatDate(
          lastItem.checkedAt || lastItem.timestamp || lastItem.createdAt,
        )
      : "-";
  },

  renderNotifications() {
    const container = document.getElementById("notificationsList");
    const visibleItems = this.state.items.filter((item) =>
      this.matchesFilter(item),
    );

    this.updateSummary(this.state.items, visibleItems);
    document.getElementById("filterStatus").textContent =
      `${this.getFilterLabel()}：${visibleItems.length}/${this.state.items.length} 条`;

    if (!this.state.items.length) {
      container.innerHTML =
        '<div class="notification-description">暂时还没有通知记录。</div>';
      return;
    }

    if (!visibleItems.length) {
      container.innerHTML =
        '<div class="notification-description">当前筛选下没有记录。</div>';
      return;
    }

    container.innerHTML = visibleItems
      .map((item) => this.renderNotificationItem(item))
      .join("");
  },

  async loadNotifications() {
    const container = document.getElementById("notificationsList");
    const button = document.getElementById("refreshBtn");
    const originalText = button.textContent;
    this.state.loading = true;
    button.disabled = true;
    button.textContent = "刷新中...";
    container.innerHTML =
      '<div class="notification-description">正在加载通知记录...</div>';

    try {
      const response = await API.get("/api/cron/weekly-check");
      if (!response.success) {
        throw new Error(response.error || "加载记录失败");
      }

      this.state.items = response.data || [];
      this.renderNotifications();
    } catch (error) {
      this.state.items = [];
      this.updateSummary([], []);
      container.innerHTML = `<div class="notification-description">加载失败：${AdminUI.escapeHtml(error.message)}</div>`;
    } finally {
      this.state.loading = false;
      button.disabled = false;
      button.textContent = originalText;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  NotificationsPage.init();
});
