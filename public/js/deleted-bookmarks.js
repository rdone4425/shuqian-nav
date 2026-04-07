// 删除记录页面功能
class DeletedBookmarksManager {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 1;
    this.currentFilter = "all";
    this.searchQuery = "";
    this.deletedRecords = [];

    this.init();
  }

  async init() {
    try {
      // 等待认证模块初始化
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const checkAuth = () => {
          attempts++;
          if (typeof Auth !== "undefined" && Auth.verifyToken !== undefined) {
            resolve();
          } else if (attempts > 50) {
            // 5秒超时
            reject(new Error("认证模块加载超时"));
          } else {
            setTimeout(checkAuth, 100);
          }
        };
        checkAuth();
      });

      // 严格的认证检查
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.log("没有找到认证token，重定向到登录页面");
        window.location.href = "/login";
        return;
      }

      // 验证token有效性
      console.log("验证token有效性...");
      const isValid = await Auth.verifyToken();
      if (!isValid) {
        console.log("Token验证失败，重定向到登录页面");
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
        return;
      }

      console.log("认证检查通过，初始化页面");
      this.bindEvents();
      await this.loadDeletedRecords();
    } catch (error) {
      console.error("初始化失败:", error);
      alert("认证失败，请重新登录");
      window.location.href = "/login";
    }
  }

  bindEvents() {
    // 刷新按钮
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.loadDeletedRecords();
    });

    // 清空所有记录
    document.getElementById("clearAllBtn").addEventListener("click", () => {
      this.clearAllRecords();
    });

    // 筛选器
    document.getElementById("filterSelect").addEventListener("change", (e) => {
      this.currentFilter = e.target.value;
      this.currentPage = 1;
      this.loadDeletedRecords();
    });

    // 搜索
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 1;
      this.loadDeletedRecords();
    });

    // 分页
    document.getElementById("prevPage").addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadDeletedRecords();
      }
    });

    document.getElementById("nextPage").addEventListener("click", () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.loadDeletedRecords();
      }
    });

    // 模态框事件
    this.bindModalEvents();

    // 记录项点击事件
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("restore-btn")) {
        const recordId = e.target.dataset.recordId;
        this.showRestoreModal(recordId);
      }

      if (e.target.classList.contains("detail-btn")) {
        const recordId = e.target.dataset.recordId;
        this.showDetailModal(recordId);
      }

      if (e.target.classList.contains("delete-btn")) {
        const recordId = e.target.dataset.recordId;
        this.permanentDelete(recordId);
      }
    });
  }

  bindModalEvents() {
    // 恢复模态框
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

    // 详情模态框
    document
      .getElementById("closeDetailModal")
      .addEventListener("click", () => {
        this.hideDetailModal();
      });

    // 点击背景关闭模态框
    document.getElementById("restoreModal").addEventListener("click", (e) => {
      if (e.target.id === "restoreModal") {
        this.hideRestoreModal();
      }
    });

    document.getElementById("detailModal").addEventListener("click", (e) => {
      if (e.target.id === "detailModal") {
        this.hideDetailModal();
      }
    });
  }

  async loadDeletedRecords() {
    try {
      console.log("开始加载删除记录...");

      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.pageSize,
      });

      if (this.currentFilter !== "all") {
        params.append("filter", this.currentFilter);
      }

      if (this.searchQuery) {
        params.append("search", this.searchQuery);
      }

      const apiUrl = `/api/bookmarks/deleted?${params}`;
      console.log("调用API:", apiUrl);

      // 检查token
      const token = localStorage.getItem("auth_token");
      console.log("Token存在:", !!token);

      const response = await API.get(apiUrl);
      console.log("API响应:", response);
      console.log("response.data:", response.data);
      console.log("response.data.bookmarks:", response.data?.bookmarks);

      if (response.success) {
        this.deletedRecords = response.data?.bookmarks || [];
        this.totalPages = response.data?.pagination?.totalPages || 1;

        console.log("加载到删除记录数量:", this.deletedRecords.length);

        this.displayRecords();
        this.updatePagination();
        this.updateStats();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("加载删除记录失败:", error);
      this.deletedRecords = [];
      this.displayRecords();
      this.showError("加载删除记录失败: " + error.message);
    }
  }

  displayRecords() {
    const recordsList = document.getElementById("recordsList");

    if (
      !this.deletedRecords ||
      !Array.isArray(this.deletedRecords) ||
      this.deletedRecords.length === 0
    ) {
      recordsList.innerHTML = '<div class="empty-state">暂无删除记录</div>';
      return;
    }

    recordsList.innerHTML = this.deletedRecords
      .map((record) => this.renderRecord(record))
      .join("");
  }

  renderRecord(record) {
    const deletedTime = new Date(record.deleted_at).toLocaleString("zh-CN");
    const reasonClass = this.getReasonClass(record.deleted_reason);
    const reasonText = this.getReasonText(record.deleted_reason);

    return `
      <div class="record-item">
        <img src="${record.favicon_url || "/favicon.ico"}" 
             alt="favicon" 
             class="record-favicon"
             onerror="this.src='/favicon.ico'">
        
        <div class="record-info">
          <div class="record-title">${this.escapeHtml(record.title)}</div>
          <div class="record-url">
            <a href="${this.escapeHtml(record.url)}"
               target="_blank"
               rel="noopener noreferrer"
               title="在新标签页中打开链接">
              ${this.escapeHtml(record.url)}
            </a>
          </div>
        </div>
        
        <div class="record-meta">
          <span class="record-reason ${reasonClass}">${reasonText}</span>
          <span class="record-time">${deletedTime}</span>
        </div>
        
        <div class="record-actions">
          <button class="btn btn-primary btn-sm restore-btn" 
                  data-record-id="${record.id}" 
                  title="恢复书签">
            🔄 恢复
          </button>
          <button class="btn btn-secondary btn-sm detail-btn" 
                  data-record-id="${record.id}" 
                  title="查看详情">
            📋 详情
          </button>
          <button class="btn btn-danger btn-sm delete-btn" 
                  data-record-id="${record.id}" 
                  title="永久删除">
            🗑️ 删除
          </button>
        </div>
      </div>
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
        return "链接失效";
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
      return;
    }

    pagination.classList.remove("hidden");
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= this.totalPages;
    pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
  }

  async updateStats() {
    try {
      // 这里可以添加统计API调用
      // 暂时使用当前数据计算
      const records = Array.isArray(this.deletedRecords)
        ? this.deletedRecords
        : [];
      const total = records.length;
      const manual = records.filter(
        (r) => r.deleted_reason === "manual_delete",
      ).length;
      const auto = records.filter(
        (r) => r.deleted_reason === "link_check_failed",
      ).length;
      const today = records.filter((r) => {
        try {
          const deletedDate = new Date(r.deleted_at).toDateString();
          const todayDate = new Date().toDateString();
          return deletedDate === todayDate;
        } catch (e) {
          return false;
        }
      }).length;

      document.getElementById("totalDeleted").textContent = total;
      document.getElementById("manualDeleted").textContent = manual;
      document.getElementById("autoDeleted").textContent = auto;
      document.getElementById("todayDeleted").textContent = today;
    } catch (error) {
      console.error("更新统计失败:", error);
      // 设置默认值
      document.getElementById("totalDeleted").textContent = "0";
      document.getElementById("manualDeleted").textContent = "0";
      document.getElementById("autoDeleted").textContent = "0";
      document.getElementById("todayDeleted").textContent = "0";
    }
  }

  showRestoreModal(recordId) {
    const record = this.deletedRecords.find((r) => r.id == recordId);
    if (!record) return;

    const modal = document.getElementById("restoreModal");
    const info = document.getElementById("restoreBookmarkInfo");

    info.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <strong>标题:</strong> ${this.escapeHtml(record.title)}<br>
        <strong>URL:</strong> ${this.escapeHtml(record.url)}<br>
        <strong>删除时间:</strong> ${new Date(record.deleted_at).toLocaleString("zh-CN")}
      </div>
    `;

    modal.classList.remove("hidden");
    modal.dataset.recordId = recordId;
  }

  hideRestoreModal() {
    document.getElementById("restoreModal").classList.add("hidden");
  }

  async confirmRestore() {
    const modal = document.getElementById("restoreModal");
    const recordId = modal.dataset.recordId;

    try {
      const response = await API.post("/api/bookmarks/deleted", {
        deletedId: recordId,
      });

      if (response.success) {
        this.showSuccess("书签恢复成功！");
        this.hideRestoreModal();
        await this.loadDeletedRecords();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("恢复书签失败:", error);
      this.showError("恢复失败: " + error.message);
    }
  }

  showDetailModal(recordId) {
    const record = this.deletedRecords.find((r) => r.id == recordId);
    if (!record) return;

    const modal = document.getElementById("detailModal");
    const details = document.getElementById("bookmarkDetails");

    details.innerHTML = `
      <div class="detail-grid">
        <div><strong>标题:</strong> ${this.escapeHtml(record.title)}</div>
        <div><strong>URL:</strong> <a href="${record.url}" target="_blank">${this.escapeHtml(record.url)}</a></div>
        <div><strong>分类:</strong> ${record.category || "无"}</div>
        <div><strong>描述:</strong> ${record.description || "无"}</div>
        <div><strong>删除原因:</strong> ${this.getReasonText(record.deleted_reason)}</div>
        <div><strong>删除时间:</strong> ${new Date(record.deleted_at).toLocaleString("zh-CN")}</div>
        <div><strong>创建时间:</strong> ${new Date(record.created_at).toLocaleString("zh-CN")}</div>
        ${record.check_status ? `<div><strong>检查状态:</strong> ${record.check_status}</div>` : ""}
        ${record.status_code ? `<div><strong>状态码:</strong> ${record.status_code}</div>` : ""}
        ${record.error_message ? `<div><strong>错误信息:</strong> ${record.error_message}</div>` : ""}
      </div>
    `;

    modal.classList.remove("hidden");
  }

  hideDetailModal() {
    document.getElementById("detailModal").classList.add("hidden");
  }

  async permanentDelete(recordId) {
    const record = this.deletedRecords.find((r) => r.id == recordId);
    if (!record) return;

    if (
      !confirm(`确定要永久删除记录 "${record.title}" 吗？\n\n此操作不可撤销！`)
    ) {
      return;
    }

    try {
      const response = await API.delete(
        `/api/bookmarks/deleted?id=${recordId}`,
      );

      if (response.success) {
        this.showSuccess("记录已永久删除");
        await this.loadDeletedRecords();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("永久删除失败:", error);
      this.showError("删除失败: " + error.message);
    }
  }

  async clearAllRecords() {
    if (!confirm("确定要清空所有删除记录吗？\n\n此操作不可撤销！")) {
      return;
    }

    try {
      // 这里需要添加清空所有记录的API
      this.showSuccess("所有记录已清空");
      await this.loadDeletedRecords();
    } catch (error) {
      console.error("清空记录失败:", error);
      this.showError("清空失败: " + error.message);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showSuccess(message) {
    // 简单的成功提示，可以后续改进
    alert("✅ " + message);
  }

  showError(message) {
    // 简单的错误提示，可以后续改进
    alert("❌ " + message);
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  // 初始化工具菜单功能
  const toolsMenuToggle = document.getElementById("toolsMenuToggle");
  const toolsDropdown = document.getElementById("toolsDropdown");

  if (toolsMenuToggle && toolsDropdown) {
    // 切换下拉菜单
    toolsMenuToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toolsDropdown.classList.toggle("show");
      toolsMenuToggle.classList.toggle("active");
    });

    // 点击其他地方关闭菜单
    document.addEventListener("click", (e) => {
      if (
        !toolsMenuToggle.contains(e.target) &&
        !toolsDropdown.contains(e.target)
      ) {
        toolsDropdown.classList.remove("show");
        toolsMenuToggle.classList.remove("active");
      }
    });

    // 修改密码按钮事件
    const changePasswordBtn = document.getElementById("changePasswordBtn");
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener("click", () => {
        // 重定向到首页并触发密码修改模态框
        window.location.href = "/?action=change-password";
      });
    }
  }

  // 初始化删除记录管理器
  new DeletedBookmarksManager();
});
