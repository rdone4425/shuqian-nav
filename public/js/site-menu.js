const SiteMenu = {
  initialized: false,
  items: [
    { href: "/", icon: "首页", text: "首页", desc: "返回书签导航首页" },
    {
      href: "/bookmarks-manage.html",
      icon: "书签",
      text: "书签管理",
      desc: "搜索、筛选和批量移动书签",
    },
    {
      href: "/categories.html",
      icon: "分类",
      text: "分类管理",
      desc: "维护分类、颜色和迁移规则",
    },
    {
      href: "/import.html",
      icon: "导入",
      text: "导入",
      desc: "导入书签文件或备份",
    },
    {
      href: "/link-checker.html",
      icon: "检查",
      text: "链接检查",
      desc: "检查书签可访问性",
    },
    {
      href: "/deleted-bookmarks",
      icon: "回收",
      text: "回收站",
      desc: "查看和恢复删除记录",
    },
    {
      href: "/token.html",
      icon: "令牌",
      text: "同步令牌",
      desc: "管理同步访问令牌",
    },
    {
      href: "/notifications.html",
      icon: "通知",
      text: "通知",
      desc: "查看维护通知",
    },
  ],

  async init() {
    if (this.initialized || window.location.pathname.includes("login")) {
      return;
    }

    this.ensureMenu();
    this.bindMenu();
    this.markActive();
    this.initialized = true;

    if (window.Auth) {
      const authenticated = await Auth.init({ requireAuth: true });
      if (!authenticated) {
        return;
      }
    }
  },

  ensureMenu() {
    const headerActions = document.querySelector(".header-actions");
    if (!headerActions) return;

    const primaryActions = headerActions.querySelector(".primary-actions");
    const primaryActionsHTML = primaryActions ? primaryActions.outerHTML : "";

    headerActions.classList.add("site-nav-actions");
    headerActions.innerHTML = `
      ${primaryActionsHTML}
      <div class="action-group tools-menu site-menu-compact">
        <button
          id="toolsMenuToggle"
          class="action-btn-icon menu-toggle has-label site-menu-toggle"
          title="打开菜单"
          aria-expanded="false"
          aria-controls="toolsDropdown"
          type="button"
        >
          <span class="btn-icon">菜单</span>
          <span class="action-btn-label">管理</span>
        </button>
        <div id="toolsDropdown" class="dropdown-menu site-menu-dropdown" role="menu"></div>
      </div>
      <button id="logoutBtn" class="action-btn-icon site-logout-btn" type="button">
        <span class="btn-icon">退出</span>
        <span class="action-btn-label">退出</span>
      </button>
    `;

    const dropdown = document.getElementById("toolsDropdown");
    dropdown.innerHTML = `
      <div class="dropdown-section-label">常用管理</div>
      ${this.items
        .slice(0, 3)
        .map((item) => this.renderLink(item))
        .join("")}
      <div class="dropdown-section-label">维护工具</div>
      ${this.items
        .slice(3)
        .map((item) => this.renderLink(item))
        .join("")}
      ${
        document.getElementById("settingsPanel")
          ? `
            <div class="dropdown-divider"></div>
            <button id="settingsToggle" class="dropdown-item" role="menuitem" type="button">
              <span class="item-icon">设置</span>
              <div class="item-content">
                <span class="item-text">设置</span>
                <span class="item-desc">导出、备份和修改密码</span>
              </div>
            </button>
          `
          : ""
      }
    `;
  },

  renderLink(item) {
    return `
      <a href="${item.href}" class="dropdown-item" role="menuitem">
        <span class="item-icon">${item.icon}</span>
        <div class="item-content">
          <span class="item-text">${item.text}</span>
          <span class="item-desc">${item.desc}</span>
        </div>
      </a>
    `;
  },

  bindMenu() {
    const toggle = document.getElementById("toolsMenuToggle");
    const dropdown = document.getElementById("toolsDropdown");
    if (!toggle || !dropdown || toggle.dataset.siteMenuBound === "true") {
      return;
    }

    toggle.dataset.siteMenuBound = "true";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = dropdown.classList.toggle("show");
      toggle.classList.toggle("active", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", (event) => {
      if (!toggle.contains(event.target) && !dropdown.contains(event.target)) {
        this.closeMenu();
      }
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      window.Auth?.logout?.({ redirect: true });
    });

    document.getElementById("settingsToggle")?.addEventListener("click", () => {
      this.closeMenu();
      document.getElementById("settingsPanel")?.classList.toggle("hidden");
    });
  },

  closeMenu() {
    const toggle = document.getElementById("toolsMenuToggle");
    const dropdown = document.getElementById("toolsDropdown");
    dropdown?.classList.remove("show");
    toggle?.classList.remove("active");
    toggle?.setAttribute("aria-expanded", "false");
  },

  markActive() {
    const path = this.normalizePath(window.location.pathname);
    document
      .querySelectorAll("#toolsDropdown a.dropdown-item")
      .forEach((link) => {
        const href = this.normalizePath(link.getAttribute("href") || "");
        const isHome = href === "/" && (path === "/" || path === "/index");
        if (href === path || isHome) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
      });
  },

  normalizePath(value) {
    const path = value.split("?")[0].replace(/\/$/, "") || "/";
    return path.replace(/\.html$/, "");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  SiteMenu.init();
});

window.SiteMenu = SiteMenu;
