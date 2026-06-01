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
};

window.AdminUI = AdminUI;
