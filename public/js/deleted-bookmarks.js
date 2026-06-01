class DeletedBookmarksManager {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 1;
    this.currentFilter = "all";
    this.searchQuery = "";
    this.deletedRecords = [];
    this.pendingRestoreId = null;
    this.selectedRecordIds = new Set();
  }

  async init() {
    this.bindEvents();
    await this.loadDeletedRecords();
  }

  bindEvents() {
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.loadDeletedRecords();
    });

    document.getElementById("batchRestoreBtn").addEventListener("click", () => {
      this.batchRestoreSelected();
    });

    document.getElementById("batchDeleteBtn").addEventListener("click", () => {
      this.batchPermanentDeleteSelected();
    });

    document
      .getElementById("selectAllRecords")
      .addEventListener("change", (event) => {
        this.selectAllVisible(event.target.checked);
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
      .getElementById("closeActionConfirm")
      .addEventListener("click", () => {
        this.closeActionConfirm(false);
      });
    document
      .getElementById("cancelActionConfirm")
      .addEventListener("click", () => {
        this.closeActionConfirm(false);
      });
    document
      .getElementById("confirmActionConfirm")
      .addEventListener("click", () => {
        this.closeActionConfirm(true);
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
    document
      .getElementById("actionConfirmModal")
      .addEventListener("click", (event) => {
        if (event.target.id === "actionConfirmModal") {
          this.closeActionConfirm(false);
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

    document.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".record-select");
      if (!checkbox) {
        return;
      }

      this.toggleRecordSelection(checkbox.dataset.recordId, checkbox.checked);
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
      this.selectedRecordIds.clear();

      this.displayRecords();
      this.updatePagination();
      this.updateStats();
      this.updateBulkControls();
    } catch (error) {
      this.deletedRecords = [];
      this.selectedRecordIds.clear();
      recordsList.innerHTML = `<div class="empty-state">加载失败：${AdminUI.escapeHtml(error.message)}</div>`;
      this.updatePagination();
      this.updateStats();
      this.updateBulkControls();
    }
  }

  displayRecords() {
    const recordsList = document.getElementById("recordsList");
    if (!this.deletedRecords.length) {
      recordsList.innerHTML =
        '<div class="empty-state">暂时没有已删除书签记录。</div>';
      this.updateBulkControls();
      return;
    }

    recordsList.innerHTML = this.deletedRecords
      .map((record) => this.renderRecord(record))
      .join("");
    this.updateBulkControls();
  }

  renderRecord(record) {
    const deletedTime = AdminUI.formatDate(record.deleted_at);
    const reasonClass = this.getReasonClass(record.deleted_reason);
    const reasonText = this.getReasonText(record.deleted_reason);
    const safeTitle = AdminUI.escapeHtml(record.title || "未命名书签");
    const safeUrl = AdminUI.escapeHtml(record.url || "");
    const recordId = String(record.id);

    return `
      <article class="record-item">
        <label class="record-select-wrap" title="选择这条记录">
          <input
            class="record-select"
            type="checkbox"
            data-record-id="${AdminUI.escapeHtml(recordId)}"
            ${this.selectedRecordIds.has(recordId) ? "checked" : ""}
          />
        </label>
        <img
          src="${AdminUI.escapeHtml(record.favicon_url || "/favicon.ico")}"
          alt=""
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
          <button class="btn btn-primary btn-sm restore-btn" type="button" data-record-id="${AdminUI.escapeHtml(recordId)}">
            恢复
          </button>
          <button class="btn btn-secondary btn-sm detail-btn" type="button" data-record-id="${AdminUI.escapeHtml(recordId)}">
            详情
          </button>
          <button class="btn btn-danger btn-sm delete-btn" type="button" data-record-id="${AdminUI.escapeHtml(recordId)}">
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
      document.getElementById("recordsPageHint").textContent = "第 1 页";
      return;
    }

    pagination.classList.remove("hidden");
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= this.totalPages;
    pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
    document.getElementById("recordsPageHint").textContent =
      `第 ${this.currentPage} / ${this.totalPages} 页`;
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

  toggleRecordSelection(recordId, selected) {
    if (!recordId) {
      return;
    }

    if (selected) {
      this.selectedRecordIds.add(String(recordId));
    } else {
      this.selectedRecordIds.delete(String(recordId));
    }

    this.updateBulkControls();
  }

  selectAllVisible(selected) {
    this.deletedRecords.forEach((record) => {
      const recordId = String(record.id);
      if (selected) {
        this.selectedRecordIds.add(recordId);
      } else {
        this.selectedRecordIds.delete(recordId);
      }
    });

    document.querySelectorAll(".record-select").forEach((checkbox) => {
      checkbox.checked = selected;
    });

    this.updateBulkControls();
  }

  getSelectedRecords() {
    return this.deletedRecords.filter((record) =>
      this.selectedRecordIds.has(String(record.id)),
    );
  }

  updateBulkControls() {
    const selectedRecords = this.getSelectedRecords();
    const selectedCount = selectedRecords.length;
    const totalVisible = this.deletedRecords.length;
    const selectAll = document.getElementById("selectAllRecords");
    const selectedCountEl = document.getElementById("selectedCount");
    const batchRestoreBtn = document.getElementById("batchRestoreBtn");
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");

    selectedCountEl.textContent = `已选择 ${selectedCount} 条`;
    batchRestoreBtn.disabled = selectedCount === 0;
    batchDeleteBtn.disabled = selectedCount === 0;

    selectAll.checked = totalVisible > 0 && selectedCount === totalVisible;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < totalVisible;
    selectAll.disabled = totalVisible === 0;
  }

  async batchRestoreSelected() {
    const targets = this.getSelectedRecords();
    if (!targets.length) {
      return;
    }

    const confirmed = await this.requestActionConfirm({
      title: "批量恢复书签",
      message: `确定恢复选中的 ${targets.length} 条记录吗？恢复后这些书签会回到可用书签列表。`,
      hint: "恢复不会删除回收站以外的数据。",
      confirmText: "恢复选中记录",
      variant: "primary",
    });
    if (!confirmed) {
      return;
    }

    await this.runBatchAction({
      targets,
      busyText: "正在恢复...",
      successText: "恢复",
      action: async (record) =>
        API.post("/api/bookmarks/deleted", {
          deletedId: record.id,
        }),
    });
  }

  async batchPermanentDeleteSelected() {
    const targets = this.getSelectedRecords();
    if (!targets.length) {
      return;
    }

    const confirmed = await this.requestActionConfirm({
      title: "批量永久删除",
      message: `确定永久删除选中的 ${targets.length} 条记录吗？`,
      hint: "永久删除后无法从回收站恢复，请确认这些记录已经不再需要。",
      confirmText: "永久删除选中记录",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }

    await this.runBatchAction({
      targets,
      busyText: "正在删除...",
      successText: "删除",
      action: async (record) =>
        API.delete(`/api/bookmarks/deleted?id=${record.id}`),
    });
  }

  async runBatchAction({ targets, busyText, successText, action }) {
    const batchRestoreBtn = document.getElementById("batchRestoreBtn");
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");
    const originalRestoreText = batchRestoreBtn.textContent;
    const originalDeleteText = batchDeleteBtn.textContent;

    batchRestoreBtn.disabled = true;
    batchDeleteBtn.disabled = true;
    batchRestoreBtn.textContent = busyText;
    batchDeleteBtn.textContent = busyText;

    let successCount = 0;
    let failedCount = 0;

    for (const record of targets) {
      try {
        const response = await action(record);
        if (!response.success) {
          throw new Error(response.error || `${successText}失败`);
        }
        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    batchRestoreBtn.textContent = originalRestoreText;
    batchDeleteBtn.textContent = originalDeleteText;
    this.selectedRecordIds.clear();

    AdminUI.showToast(
      `${successText}完成：成功 ${successCount} 条${failedCount ? `，失败 ${failedCount} 条` : ""}`,
      failedCount ? "error" : "success",
    );
    await this.loadDeletedRecords();
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

  requestActionConfirm({ title, message, hint, confirmText, variant }) {
    const modal = document.getElementById("actionConfirmModal");
    const titleEl = document.getElementById("actionConfirmTitle");
    const messageEl = document.getElementById("actionConfirmMessage");
    const hintEl = document.getElementById("actionConfirmHint");
    const confirmBtn = document.getElementById("confirmActionConfirm");

    if (!modal || !confirmBtn) {
      return Promise.resolve(false);
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    hintEl.textContent = hint || "";
    confirmBtn.textContent = confirmText || "确认";
    confirmBtn.classList.toggle("btn-primary", variant === "primary");
    confirmBtn.classList.toggle("btn-danger", variant !== "primary");
    modal.classList.remove("hidden");
    confirmBtn.focus();

    return new Promise((resolve) => {
      this.pendingActionConfirm = { resolve };
    });
  }

  closeActionConfirm(confirmed) {
    const pending = this.pendingActionConfirm;
    if (!pending) {
      return;
    }

    document.getElementById("actionConfirmModal").classList.add("hidden");
    this.pendingActionConfirm = null;
    pending.resolve(Boolean(confirmed));
  }

  async permanentDelete(recordId) {
    const record = this.deletedRecords.find(
      (item) => String(item.id) === String(recordId),
    );
    if (!record) {
      return;
    }

    const confirmed = await this.requestActionConfirm({
      title: "永久删除记录",
      message: `确定永久删除记录「${record.title || "未命名书签"}」吗？`,
      hint: "此操作不可撤销，删除后无法再恢复这条历史记录。",
      confirmText: "永久删除",
      variant: "danger",
    });
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
  const authenticated = await AdminUI.requireAuth();
  if (!authenticated) {
    return;
  }

  const manager = new DeletedBookmarksManager();
  await manager.init();
});
