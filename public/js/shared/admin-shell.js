const AdminShell = {
  initialized: false,

  init() {
    if (this.initialized) return;
    if (
      window.location.pathname === "/" ||
      window.location.pathname.includes("login")
    ) {
      return;
    }

    const host = document.querySelector("[data-site-header]");
    if (!host || host.getAttribute("data-require-auth") === "false") {
      return;
    }

    document.body.classList.add("admin-site");
    this.render(host);
    this.bind();
    this.initialized = true;
  },

  render(host) {
    const pageKey = host.getAttribute("data-page-key") || "";
    const groups = window.SiteMenu?.getAdminMenuGroups?.() || [];
    const sidebar = document.createElement("aside");
    sidebar.className = "admin-sidebar";
    sidebar.setAttribute("aria-label", "后台管理菜单");
    sidebar.innerHTML = `
      <div class="admin-sidebar-brand">
        <a class="admin-sidebar-logo" href="/admin-dashboard.html">
          <span class="admin-sidebar-icon">N</span>
          <span>
            <strong>书签后台</strong>
            <small>统一管理工作台</small>
          </span>
        </a>
      </div>
      <nav class="admin-sidebar-nav">
        ${groups.map((group) => this.renderGroup(group, pageKey)).join("")}
      </nav>
      <div class="admin-sidebar-footer">
        <a class="admin-sidebar-link" href="/">
          <span>首页</span>
          <small>返回公开导航</small>
        </a>
        <button class="admin-sidebar-logout" type="button" data-admin-shell-logout>
          退出登录
        </button>
      </div>
    `;

    const toggle = document.createElement("button");
    toggle.className = "admin-mobile-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "adminSidebar");
    toggle.setAttribute("aria-label", "打开后台菜单");
    toggle.textContent = "菜单";
    toggle.dataset.adminShellToggle = "true";

    const backdrop = document.createElement("div");
    backdrop.className = "admin-sidebar-backdrop";
    backdrop.dataset.adminShellBackdrop = "true";

    sidebar.id = "adminSidebar";
    document.body.prepend(backdrop);
    document.body.prepend(sidebar);
    document.body.prepend(toggle);
    document.body.classList.add("admin-shell-ready");
  },

  renderGroup(group, pageKey) {
    return `
      <section class="admin-sidebar-group">
        <div class="admin-sidebar-label">${this.escapeHtml(group.label)}</div>
        ${group.items.map((item) => this.renderItem(item, pageKey)).join("")}
      </section>
    `;
  },

  renderItem(item, pageKey) {
    const active = item.key === pageKey ? " active" : "";
    const current = item.key === pageKey ? ' aria-current="page"' : "";
    return `
      <a class="admin-sidebar-link${active}" href="${this.escapeHtml(item.href)}"${current}>
        <span>${this.escapeHtml(item.text)}</span>
        <small>${this.escapeHtml(item.desc || "")}</small>
      </a>
    `;
  },

  bind() {
    const toggle = document.querySelector("[data-admin-shell-toggle]");
    const backdrop = document.querySelector("[data-admin-shell-backdrop]");
    const sidebar = document.getElementById("adminSidebar");

    const setOpen = (open) => {
      document.body.classList.toggle("admin-sidebar-open", open);
      toggle?.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggle?.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("admin-sidebar-open"));
    });
    backdrop?.addEventListener("click", () => setOpen(false));
    sidebar?.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
    document
      .querySelector("[data-admin-shell-logout]")
      ?.addEventListener("click", () => {
        window.Auth?.logout?.({ redirect: true });
      });
  },

  escapeHtml(value = "") {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  AdminShell.init();
});

window.AdminShell = AdminShell;
