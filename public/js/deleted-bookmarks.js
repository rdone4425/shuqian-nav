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
      AdminUI.showToast("Bulk clear is not implemented.", "error");
    });

    document.getElementById("filterSelect").addEventListener("change", (event) => {
      this.currentFilter = event.target.value;
      this.currentPage = 1;
      this.loadDeletedRecords();
    });

    document.getElementById("searchInput").addEventListener("input", (event) => {
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

    document.getElementById("closeRestoreModal").addEventListener("click", () => {
      this.hideRestoreModal();
    });
    document.getElementById("cancelRestore").addEventListener("click", () => {
      this.hideRestoreModal();
    });
    document.getElementById("confirmRestore").addEventListener("click", () => {
      this.confirmRestore();
    });
    document.getElementById("closeDetailModal").addEventListener("click", () => {
      this.hideDetailModal();
    });

    document.getElementById("restoreModal").addEventListener("click", (event) => {
      if (event.target.id === "restoreModal") {
        this.hideRestoreModal();
      }
    });
    document.getElementById("detailModal").addEventListener("click", (event) => {
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
    recordsList.innerHTML = '<div class="loading">Loading deleted bookmarks...</div>';

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

      const response = await API.get(`/api/bookmarks/deleted?${params.toString()}`);
      if (!response.success) {
        throw new Error(response.error || "Failed to load deleted bookmarks");
      }

      this.deletedRecords = response.data?.bookmarks || [];
      this.totalPages = response.data?.pagination?.totalPages || 1;

      this.displayRecords();
      this.updatePagination();
      this.updateStats();
    } catch (error) {
      this.deletedRecords = [];
      recordsList.innerHTML = `<div class="empty-state">Load failed: ${AdminUI.escapeHtml(error.message)}</div>`;
      this.updatePagination();
      this.updateStats();
    }
  }

  displayRecords() {
    const recordsList = document.getElementById("recordsList");
    if (!this.deletedRecords.length) {
      recordsList.innerHTML =
        '<div class="empty-state">There are no deleted bookmark records.</div>';
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
    const safeTitle = AdminUI.escapeHtml(record.title || "Untitled bookmark");
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
            Restore
          </button>
          <button class="btn btn-secondary btn-sm detail-btn" data-record-id="${record.id}">
            Details
          </button>
          <button class="btn btn-danger btn-sm delete-btn" data-record-id="${record.id}">
            Delete forever
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
        return "Manual delete";
      case "link_check_failed":
        return "Link check failed";
      case "batch_delete_inaccessible":
        return "Batch delete";
      default:
        return "Other";
    }
  }

  updatePagination() {
    const pagination = document.getElementById("pagination");
    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    const pageInfo = document.getElementById("pageInfo");

    if (this.totalPages <= 1) {
      pagination.classList.add("hidden");
      pageInfo.textContent = "Page 1 of 1";
      return;
    }

    pagination.classList.remove("hidden");
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= this.totalPages;
    pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
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
        <strong>Title:</strong> ${AdminUI.escapeHtml(record.title || "Untitled bookmark")}<br>
        <strong>URL:</strong> ${AdminUI.escapeHtml(record.url || "")}<br>
        <strong>Deleted at:</strong> ${AdminUI.formatDate(record.deleted_at)}
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
        throw new Error(response.error || "Restore failed");
      }

      this.hideRestoreModal();
      AdminUI.showToast("Bookmark restored");
      await this.loadDeletedRecords();
    } catch (error) {
      AdminUI.showToast(`Restore failed: ${error.message}`, "error");
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
        <div><strong>Title:</strong> ${AdminUI.escapeHtml(record.title || "Untitled bookmark")}</div>
        <div><strong>URL:</strong> <a href="${AdminUI.escapeHtml(record.url || "")}" target="_blank" rel="noopener noreferrer">${AdminUI.escapeHtml(record.url || "")}</a></div>
        <div><strong>Category:</strong> ${AdminUI.escapeHtml(record.category || "Uncategorized")}</div>
        <div><strong>Description:</strong> ${AdminUI.escapeHtml(record.description || "None")}</div>
        <div><strong>Delete reason:</strong> ${this.getReasonText(record.deleted_reason)}</div>
        <div><strong>Deleted at:</strong> ${AdminUI.formatDate(record.deleted_at)}</div>
        <div><strong>Check status:</strong> ${AdminUI.escapeHtml(record.check_status || "-")}</div>
        <div><strong>Status code:</strong> ${AdminUI.escapeHtml(record.status_code || "-")}</div>
        <div><strong>Error message:</strong> ${AdminUI.escapeHtml(record.error_message || "-")}</div>
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
      `Delete the record "${record.title || "Untitled bookmark"}" forever? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await API.delete(`/api/bookmarks/deleted?id=${recordId}`);
      if (!response.success) {
        throw new Error(response.error || "Failed to delete record forever");
      }

      AdminUI.showToast("Record deleted forever");
      await this.loadDeletedRecords();
    } catch (error) {
      AdminUI.showToast(`Delete failed: ${error.message}`, "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const manager = new DeletedBookmarksManager();
  await manager.init();
});
