/**
 * 前端UI通用助手库
 * 统一处理常见的UI操作，减少重复代码
 */

class UIHelper {
  /**
   * 显示/隐藏加载状态
   */
  static showLoading(containerId = null) {
    const containers = containerId
      ? [containerId]
      : ["loadingState", "loading", "spinner"];

    containers.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = "block";
      }
    });

    this.hideStates(["errorState", "emptyState", "content"]);
  }

  static hideLoading(containerId = null) {
    const containers = containerId
      ? [containerId]
      : ["loadingState", "loading", "spinner"];

    containers.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = "none";
      }
    });
  }

  /**
   * 显示错误状态
   */
  static showError(message = "加载失败", containerId = "errorState") {
    this.hideStates(["loadingState", "emptyState"]);

    const errorElement = document.getElementById(containerId);
    if (errorElement) {
      errorElement.style.display = "block";
      const messageElement = errorElement.querySelector(".error-message");
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }

  /**
   * 显示空状态
   */
  static showEmpty(message = "暂无数据", containerId = "emptyState") {
    this.hideStates(["loadingState", "errorState"]);

    const emptyElement = document.getElementById(containerId);
    if (emptyElement) {
      emptyElement.style.display = "block";
      const messageElement = emptyElement.querySelector(".empty-message");
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }

  /**
   * 隐藏指定状态元素
   */
  static hideStates(stateIds) {
    stateIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = "none";
      }
    });
  }

  /**
   * 显示内容区域
   */
  static showContent(containerId = "content") {
    this.hideStates(["loadingState", "errorState", "emptyState"]);

    const contentElement = document.getElementById(containerId);
    if (contentElement) {
      contentElement.style.display = "block";
    }
  }

  /**
   * 创建并显示模态框
   */
  static showModal(options = {}) {
    const {
      title = "提示",
      content = "",
      confirmText = "确定",
      cancelText = "取消",
      onConfirm = () => {},
      onCancel = () => {},
      showCancel = true,
    } = options;

    this.hideModal("dynamicModal");

    const modalHtml = `
      <div class="modal-overlay" id="dynamicModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" type="button">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          <div class="modal-footer">
            ${showCancel ? `<button class="btn btn-secondary modal-cancel">${cancelText}</button>` : ""}
            <button class="btn btn-primary modal-confirm">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modal = document.getElementById("dynamicModal");
    const confirmBtn = modal.querySelector(".modal-confirm");
    const cancelBtn = modal.querySelector(".modal-cancel");
    const closeBtn = modal.querySelector(".modal-close");

    const cancel = () => {
      onCancel();
      this.hideModal("dynamicModal");
    };

    confirmBtn.addEventListener("click", () => {
      onConfirm();
      this.hideModal("dynamicModal");
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", cancel);
    }

    closeBtn?.addEventListener("click", cancel);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        cancel();
      }
    });

    return modal;
  }

  /**
   * 隐藏模态框
   */
  static hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
    }
  }

  /**
   * 显示通知消息
   */
  static showNotification(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // 添加样式
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 20px",
      borderRadius: "6px",
      color: "white",
      zIndex: "9999",
      fontSize: "14px",
      maxWidth: "300px",
      opacity: "0",
      transform: "translateX(100%)",
      transition: "all 0.3s ease",
    });

    // 设置颜色
    const colors = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#3b82f6",
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateX(0)";
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  /**
   * 分页组件
   */
  static createPagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = "";
      return;
    }

    const pagination = document.createElement("div");
    pagination.className = "pagination";

    const addButton = (label, page, options = {}) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pagination-btn";
      button.textContent = label;
      button.dataset.page = String(page);

      if (options.active) {
        button.classList.add("active");
      }
      if (options.disabled) {
        button.classList.add("disabled");
        button.disabled = true;
      } else if (typeof onPageChange === "function") {
        button.addEventListener("click", () => onPageChange(page));
      }

      pagination.appendChild(button);
    };

    const addEllipsis = () => {
      const ellipsis = document.createElement("span");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.textContent = "...";
      pagination.appendChild(ellipsis);
    };

    addButton("上一页", currentPage - 1, { disabled: currentPage <= 1 });

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      addButton("1", 1);
      if (startPage > 2) {
        addEllipsis();
      }
    }

    for (let i = startPage; i <= endPage; i += 1) {
      addButton(String(i), i, { active: i === currentPage });
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        addEllipsis();
      }
      addButton(String(totalPages), totalPages);
    }

    addButton("下一页", currentPage + 1, {
      disabled: currentPage >= totalPages,
    });

    container.replaceChildren(pagination);
  }

  /**
   * 防抖函数
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * 节流函数
   */
  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * 格式化日期
   */
  static formatDate(dateString, format = "YYYY-MM-DD HH:mm") {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return format
      .replace("YYYY", year)
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes);
  }

  /**
   * 复制到剪贴板
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification("已复制到剪贴板", "success");
      return true;
    } catch (err) {
      console.error("复制失败:", err);
      this.showNotification("复制失败", "error");
      return false;
    }
  }

  static escapeHtml(text = "") {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * 确认对话框
   */
  static confirm(message, onConfirm, onCancel = () => {}) {
    return this.showModal({
      title: "确认操作",
      content: `<p>${this.escapeHtml(message)}</p>`,
      confirmText: "确定",
      cancelText: "取消",
      onConfirm,
      onCancel,
      showCancel: true,
    });
  }
}

// 全局暴露
window.UIHelper = UIHelper;
