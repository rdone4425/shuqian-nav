const SiteMenu = {
  items: [
    { href: "/", icon: "H", text: "首页", desc: "返回书签导航首页" },
    {
      href: "/import.html",
      icon: "IN",
      text: "导入",
      desc: "导入书签文件或备份",
    },
    {
      href: "/link-checker.html",
      icon: "CK",
      text: "链接检查",
      desc: "检查书签可访问性",
    },
    {
      href: "/deleted-bookmarks",
      icon: "RC",
      text: "回收站",
      desc: "查看和恢复删除记录",
    },
    {
      href: "/notifications.html",
      icon: "NT",
      text: "通知",
      desc: "查看维护通知",
    },
    {
      href: "/token.html",
      icon: "AP",
      text: "同步令牌",
      desc: "查看同步与令牌说明",
    },
  ],

  async init() {
    if (window.location.pathname.includes("login")) {
      return;
    }

    if (window.Auth) {
      const authenticated = await Auth.init({ requireAuth: true });
      if (!authenticated) {
        return;
      }
    }

    this.ensureMenu();
    this.bindMenu();
    this.markActive();
  },

  ensureMenu() {
    const headerActions = document.querySelector(".header-actions");
    if (!headerActions) return;

    headerActions.classList.add("site-nav-actions");
    headerActions.innerHTML = `
      <nav class="site-nav-strip" aria-label="页面导航">
        ${this.items.map((item) => this.renderTopLink(item)).join("")}
      </nav>
      <button id="logoutBtn" class="action-btn-icon site-logout-btn" type="button">
        <span class="btn-icon">OUT</span>
        <span class="action-btn-label">退出</span>
      </button>
      <div class="action-group tools-menu site-menu-compact">
        <button
          id="toolsMenuToggle"
          class="action-btn-icon menu-toggle has-label site-menu-toggle"
          title="打开菜单"
          aria-expanded="false"
          aria-controls="toolsDropdown"
          type="button"
        >
          <span class="btn-icon">☰</span>
          <span class="action-btn-label">菜单</span>
        </button>
        <div id="toolsDropdown" class="dropdown-menu" role="menu"></div>
      </div>
    `;

    const dropdown = document.getElementById("toolsDropdown");
    dropdown.setAttribute("role", "menu");
    dropdown.innerHTML = `
      ${this.items.map((item) => this.renderLink(item)).join("")}
      <div class="dropdown-divider"></div>
      <button id="logoutMenuBtn" class="dropdown-item" role="menuitem" type="button">
        <span class="item-icon">OUT</span>
        <div class="item-content">
          <span class="item-text">退出登录</span>
          <span class="item-desc">回到登录页</span>
        </div>
      </button>
    `;
  },

  renderTopLink(item) {
    return `
      <a href="${item.href}" class="site-nav-link" title="${item.desc}">
        <span class="site-nav-icon">${item.icon}</span>
        <span>${item.text}</span>
      </a>
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
        dropdown.classList.remove("show");
        toggle.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document
      .querySelectorAll("#logoutBtn, #logoutMenuBtn")
      .forEach((button) => {
        button.addEventListener("click", () => {
          window.Auth?.logout?.({ redirect: true });
        });
      });
  },

  markActive() {
    const path = this.normalizePath(window.location.pathname);
    document
      .querySelectorAll("#toolsDropdown a.dropdown-item, .site-nav-link")
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
