const AdminUI = {
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
    if (typeof Auth !== "undefined" && typeof Auth.init === "function") {
      await Auth.init();
    }

    if (typeof Auth !== "undefined" && Auth.checkAuthenticated()) {
      return true;
    }

    window.location.href = "/login.html";
    return false;
  },

  initToolsMenu(activePath = window.location.pathname) {
    const toolsMenuToggle = document.getElementById("toolsMenuToggle");
    const toolsDropdown = document.getElementById("toolsDropdown");
    const changePasswordBtn = document.getElementById("changePasswordBtn");

    if (toolsMenuToggle && toolsDropdown) {
      toolsMenuToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toolsDropdown.classList.toggle("show");
        toolsMenuToggle.classList.toggle("active");
      });

      document.addEventListener("click", (event) => {
        if (
          !toolsMenuToggle.contains(event.target) &&
          !toolsDropdown.contains(event.target)
        ) {
          toolsDropdown.classList.remove("show");
          toolsMenuToggle.classList.remove("active");
        }
      });
    }

    if (changePasswordBtn) {
      changePasswordBtn.addEventListener("click", () => {
        window.location.href = "/?action=change-password";
      });
    }

    document
      .querySelectorAll("#toolsDropdown a.dropdown-item")
      .forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) {
          return;
        }

        const matches =
          href === activePath ||
          (href === "/" && activePath === "/index.html") ||
          activePath.endsWith(href.replace(/^\//, ""));

        if (matches) {
          link.classList.add("active");
        }
      });
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
};

window.AdminUI = AdminUI;
