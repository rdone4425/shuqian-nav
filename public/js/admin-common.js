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
    if (!window.Auth) {
      window.location.href = `/login.html?next=${encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      )}`;
      return false;
    }

    return await Auth.init({ requireAuth: true });
  },

  initToolsMenu(activePath = window.location.pathname) {
    const toolsMenuToggle = document.getElementById("toolsMenuToggle");
    const toolsDropdown = document.getElementById("toolsDropdown");

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
