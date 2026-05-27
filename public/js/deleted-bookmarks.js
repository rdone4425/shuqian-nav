class DeletedBookmarksManager {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 1;
    this.currentFilter = "all";
    this.searchQuery = "";
    this.deletedRecords = [];
    this.pendingRestoreId = null;
  }

  async init() {
    this.bindEvents();
    await this.loadDeletedRecords();
  }

  bindEvents() {
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.loadDeletedRecords();
    });

    document.getElementById("clearAllBtn").addEventListener("click", () => {
      AdminUI.showToast("暂不支持批量清空。", "error");
    });

    document
      .getElementById("filterSelect")
      .addEventListener("change", (event) => {
        this.currentFilter = event.target.value;
        this.currentPage = 1;
        this.loadDeletedRecords();
      });

    document
      .getElementById("searchInput")
      .addEventListener("input", (event) => {
        this.searchQuery = event.target.value.trim();
        this.currentPage = 1;
        this.loadDeletedRecords();
      });

    document.getElementById("prevPage").addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage -= 1;
        this.loadDeletedRecords();
      }
    });

    document.getElementById("nextPage").addEventListener("click", () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage += 1;
        this.loadDeletedRecords();
      }
    });

    document
      .getElementById("closeRestoreModal")
      .addEventListener("click", () => {
        this.hideRestoreModal();
      });
    document.getElementById("cancelRestore").addEventListener("click", () => {
      this.hideRestoreModal();
    });
    document.getElementById("confirmRestore").addEventListener("click", () => {
      this.confirmRestore();
    });
    document
      .getElementById("closeDetailModal")
      .addEventListener("click", () => {
        this.hideDetailModal();
      });

    document
      .getElementById("restoreModal")
      .addEventListener("click", (event) => {
        if (event.target.id === "restoreModal") {
          this.hideRestoreModal();
        }
      });
    document
      .getElementById("detailModal")
      .addEventListener("click", (event) => {
        if (event.target.id === "detailModal") {
          this.hideDetailModal();
        }
      });

    document.addEventListener("click", (event) => {
      const restoreButton = event.target.closest(".restore-btn");
      const detailButton = event.target.closest(".detail-btn");
      const deleteButton = event.target.closest(".delete-btn");

      if (restoreButton) {
        this.showRestoreModal(restoreButton.dataset.recordId);
        return;
      }

      if (detailButton) {
        this.showDetailModal(detailButton.dataset.recordId);
        return;
      }

      if (deleteButton) {
        this.permanentDelete(deleteButton.dataset.recordId);
      }
    });
  }

  async loadDeletedRecords() {
    const recordsList = document.getElementById("recordsList");
    recordsList.innerHTML = '<div class="loading">正在加载已删除书签...</div>';

    try {
      const params = new URLSearchParams({
        page: String(this.currentPage),
        limit: String(this.pageSize),
      });

      if (this.currentFilter !== "all") {
        params.set("filter", this.currentFilter);
      }

      if (this.searchQuery) {
        params.set("search", this.searchQuery);
      }

      const response = await API.get(
        `/api/bookmarks/deleted?${params.toString()}`,
      );
      if (!response.success) {
        throw new Error(response.error || "加载已删除书签失败");
      }

      this.deletedRecords = response.data?.bookmarks || [];
      this.totalPages = response.data?.pagination?.totalPages || 1;

      this.displayRecords();
      this.updatePagination();
      this.updateStats();
    } catch (error) {
      this.deletedRecords = [];
      recordsList.innerHTML = `<div class="empty-state">加载失败：${AdminUI.escapeHtml(error.message)}</div>`;
      this.updatePagination();
      this.updateStats();
    }
  }

  displayRecords() {
    const recordsList = document.getElementById("recordsList");
    if (!this.deletedRecords.length) {
      recordsList.innerHTML =
        '<div class="empty-state">暂时没有已删除书签记录。</div>';
      return;
    }

    recordsList.innerHTML = this.deletedRecords
      .map((record) => this.renderRecord(record))
      .join("");
  }

  renderRecord(record) {
    const deletedTime = AdminUI.formatDate(record.deleted_at);
    const reasonClass = this.getReasonClass(record.deleted_reason);
    const reasonText = this.getReasonText(record.deleted_reason);
    const safeTitle = AdminUI.escapeHtml(record.title || "未命名书签");
    const safeUrl = AdminUI.escapeHtml(record.url || "");

    return `
      <article class="record-item">
        <img
          src="${AdminUI.escapeHtml(record.favicon_url || "/favicon.ico")}"
          alt="favicon"
          class="record-favicon"
          onerror="this.src='/favicon.ico'"
        />
        <div class="record-info">
          <div class="record-title">${safeTitle}</div>
          <div class="record-url">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>
          </div>
        </div>
        <div class="record-meta">
          <span class="record-reason ${reasonClass}">${reasonText}</span>
          <span class="record-time">${deletedTime}</span>
        </div>
        <div class="record-actions">
          <button class="btn btn-primary btn-sm restore-btn" data-record-id="${record.id}">
            恢复
          </button>
          <button class="btn btn-secondary btn-sm detail-btn" data-record-id="${record.id}">
            详情
          </button>
          <button class="btn btn-danger btn-sm delete-btn" data-record-id="${record.id}">
            永久删除
          </button>
        </div>
      </article>
    `;
  }

  getReasonClass(reason) {
    switch (reason) {
      case "manual_delete":
        return "reason-manual";
      case "link_check_failed":
        return "reason-auto";
      case "batch_delete_inaccessible":
        return "reason-batch";
      default:
        return "reason-manual";
    }
  }

  getReasonText(reason) {
    switch (reason) {
      case "manual_delete":
        return "手动删除";
      case "link_check_failed":
        return "链接检查失败";
      case "batch_delete_inaccessible":
        return "批量删除";
      default:
        return "其他";
    }
  }

  updatePagination() {
    const pagination = document.getElementById("pagination");
    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    const pageInfo = document.getElementById("pageInfo");

    if (this.totalPages <= 1) {
      pagination.classList.add("hidden");
      pageInfo.textContent = "第 1 页，共 1 页";
      return;
    }

    pagination.classList.remove("hidden");
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= this.totalPages;
    pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
  }

  updateStats() {
    const total = this.deletedRecords.length;
    const manual = this.deletedRecords.filter(
      (record) => record.deleted_reason === "manual_delete",
    ).length;
    const auto = this.deletedRecords.filter(
      (record) =>
        record.deleted_reason === "link_check_failed" ||
        record.deleted_reason === "batch_delete_inaccessible",
    ).length;
    const today = this.deletedRecords.filter((record) => {
      const deletedDate = new Date(record.deleted_at);
      if (Number.isNaN(deletedDate.getTime())) {
        return false;
      }
      return deletedDate.toDateString() === new Date().toDateString();
    }).length;

    document.getElementById("totalDeleted").textContent = total;
    document.getElementById("manualDeleted").textContent = manual;
    document.getElementById("autoDeleted").textContent = auto;
    document.getElementById("todayDeleted").textContent = today;
  }

  showRestoreModal(recordId) {
    const record = this.deletedRecords.find(
      (item) => String(item.id) === String(recordId),
    );
    if (!record) {
      return;
    }

    this.pendingRestoreId = recordId;
    document.getElementById("restoreBookmarkInfo").innerHTML = `
      <div style="margin-bottom: 1rem;">
        <strong>标题：</strong> ${AdminUI.escapeHtml(record.title || "未命名书签")}<br>
        <strong>URL：</strong> ${AdminUI.escapeHtml(record.url || "")}<br>
        <strong>删除时间：</strong> ${AdminUI.formatDate(record.deleted_at)}
      </div>
    `;
    document.getElementById("restoreModal").classList.remove("hidden");
  }

  hideRestoreModal() {
    this.pendingRestoreId = null;
    document.getElementById("restoreModal").classList.add("hidden");
  }

  async confirmRestore() {
    if (!this.pendingRestoreId) {
      return;
    }

    try {
      const response = await API.post("/api/bookmarks/deleted", {
        deletedId: this.pendingRestoreId,
      });

      if (!response.success) {
        throw new Error(response.error || "恢复失败");
      }

      this.hideRestoreModal();
      AdminUI.showToast("书签已恢复");
      await this.loadDeletedRecords();
    } catch (error) {
      AdminUI.showToast(`恢复失败：${error.message}`, "error");
    }
  }

  showDetailModal(recordId) {
    const record = this.deletedRecords.find(
      (item) => String(item.id) === String(recordId),
    );
    if (!record) {
      return;
    }

    document.getElementById("bookmarkDetails").innerHTML = `
      <div class="detail-grid">
        <div><strong>标题：</strong> ${AdminUI.escapeHtml(record.title || "未命名书签")}</div>
        <div><strong>URL：</strong> <a href="${AdminUI.escapeHtml(record.url || "")}" target="_blank" rel="noopener noreferrer">${AdminUI.escapeHtml(record.url || "")}</a></div>
        <div><strong>分类：</strong> ${AdminUI.escapeHtml(record.category || "未分类")}</div>
        <div><strong>描述：</strong> ${AdminUI.escapeHtml(record.description || "无")}</div>
        <div><strong>删除原因：</strong> ${this.getReasonText(record.deleted_reason)}</div>
        <div><strong>删除时间：</strong> ${AdminUI.formatDate(record.deleted_at)}</div>
        <div><strong>检查状态：</strong> ${AdminUI.escapeHtml(record.check_status || "-")}</div>
        <div><strong>状态码：</strong> ${AdminUI.escapeHtml(record.status_code || "-")}</div>
        <div><strong>错误信息：</strong> ${AdminUI.escapeHtml(record.error_message || "-")}</div>
      </div>
    `;
    document.getElementById("detailModal").classList.remove("hidden");
  }

  hideDetailModal() {
    document.getElementById("detailModal").classList.add("hidden");
  }

  async permanentDelete(recordId) {
    const record = this.deletedRecords.find(
      (item) => String(item.id) === String(recordId),
    );
    if (!record) {
      return;
    }

    const confirmed = window.confirm(
      `确定永久删除记录「${record.title || "未命名书签"}」吗？此操作不可撤销。`,
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await API.delete(
        `/api/bookmarks/deleted?id=${recordId}`,
      );
      if (!response.success) {
        throw new Error(response.error || "永久删除记录失败");
      }

      AdminUI.showToast("记录已永久删除");
      await this.loadDeletedRecords();
    } catch (error) {
      AdminUI.showToast(`删除失败：${error.message}`, "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const manager = new DeletedBookmarksManager();
  await manager.init();
});
