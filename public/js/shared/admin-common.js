const AdminUI = {
  confirmState: null,

  escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  },

  formatDate(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("zh-CN");
  },

  async requireAuth() {
    if (!window.Auth) {
      window.location.href = `/login.html?next=${encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      )}`;
      return false;
    }

    return await Auth.init({ requireAuth: true });
  },

  initToolsMenu(activePath = window.location.pathname) {
    const host = document.querySelector("[data-site-header]");
    if (host && window.SiteMenu?.markActive) {
      window.SiteMenu.markActive(host, activePath);
    }
  },

  showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `message-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  },

  confirm({
    title = "确认操作",
    message = "确定继续吗？",
    hint = "",
    expectedText = "",
    inputLabel = "",
    confirmText = "确认",
    cancelText = "取消",
    variant = "danger",
  } = {}) {
    const elements = this.ensureConfirmDialog();
    if (!elements) {
      return Promise.resolve(false);
    }

    if (this.confirmState?.resolve) {
      this.closeConfirmDialog(false);
    }

    const lastActive = document.activeElement;

    elements.title.textContent = title;
    elements.message.textContent = message;
    elements.hint.textContent = hint || "";
    elements.hint.hidden = !hint;
    elements.input.value = "";
    elements.inputField.hidden = !expectedText;
    elements.inputLabel.textContent =
      inputLabel || (expectedText ? `请输入“${expectedText}”继续` : "");
    elements.confirm.textContent = confirmText;
    elements.cancel.textContent = cancelText;
    elements.confirm.classList.toggle("btn-danger", variant === "danger");
    elements.confirm.classList.toggle("btn-primary", variant !== "danger");
    elements.confirm.disabled = Boolean(expectedText);
    elements.modal.classList.remove("hidden");
    if (expectedText) {
      elements.input.focus();
    } else {
      elements.confirm.focus();
    }

    return new Promise((resolve) => {
      this.confirmState = { resolve, lastActive, expectedText };
    });
  },

  ensureConfirmDialog() {
    let modal = document.getElementById("adminConfirmDialog");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "adminConfirmDialog";
      modal.className = "modal hidden admin-confirm-dialog";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "adminConfirmTitle");
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="adminConfirmTitle">确认操作</h3>
            <button id="adminConfirmClose" class="btn btn-secondary" type="button">关闭</button>
          </div>
          <div class="modal-body">
            <p id="adminConfirmMessage"></p>
            <label id="adminConfirmInputField" class="form-group" hidden>
              <span id="adminConfirmInputLabel">输入确认文字</span>
              <input id="adminConfirmInput" class="form-input" type="text" autocomplete="off" />
            </label>
            <p id="adminConfirmHint" class="form-help"></p>
            <div class="modal-actions">
              <button id="adminConfirmCancel" class="btn btn-secondary" type="button">取消</button>
              <button id="adminConfirmAccept" class="btn btn-danger" type="button">确认</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const input = modal.querySelector("#adminConfirmInput");
      const confirm = modal.querySelector("#adminConfirmAccept");

      input.addEventListener("input", () => {
        const expectedText = this.confirmState?.expectedText || "";
        confirm.disabled = Boolean(
          expectedText && input.value.trim() !== expectedText,
        );
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.closeConfirmDialog(true);
        }
      });

      modal.addEventListener("click", (event) => {
        if (
          event.target === modal ||
          event.target.id === "adminConfirmClose" ||
          event.target.id === "adminConfirmCancel"
        ) {
          this.closeConfirmDialog(false);
        }

        if (event.target.id === "adminConfirmAccept") {
          this.closeConfirmDialog(true);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.classList.contains("hidden")) {
          this.closeConfirmDialog(false);
        }
      });
    }

    return {
      modal,
      title: document.getElementById("adminConfirmTitle"),
      message: document.getElementById("adminConfirmMessage"),
      hint: document.getElementById("adminConfirmHint"),
      inputField: document.getElementById("adminConfirmInputField"),
      inputLabel: document.getElementById("adminConfirmInputLabel"),
      input: document.getElementById("adminConfirmInput"),
      cancel: document.getElementById("adminConfirmCancel"),
      confirm: document.getElementById("adminConfirmAccept"),
    };
  },

  closeConfirmDialog(confirmed) {
    const pending = this.confirmState;
    const modal = document.getElementById("adminConfirmDialog");
    const input = document.getElementById("adminConfirmInput");

    if (confirmed && pending?.expectedText) {
      const matches = input?.value.trim() === pending.expectedText;
      if (!matches) {
        input?.focus();
        return;
      }
    }

    modal?.classList.add("hidden");
    this.confirmState = null;

    if (pending?.lastActive?.focus) {
      pending.lastActive.focus();
    }

    pending?.resolve(Boolean(confirmed));
  },
};

window.AdminUI = AdminUI;
