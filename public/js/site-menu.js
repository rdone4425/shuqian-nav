/**
 * Unified site header.
 *
 * Single source of truth lives in /components/header.html. Every page that
 * wants the global navigation just drops a host element and this module
 * injects the partial on DOMContentLoaded:
 *
 *   <div data-site-header
 *        data-page-key="home"
 *        data-logo-icon="N"
 *        data-logo-text="书签导航"
 *        data-logo-subtitle="你的常用站点入口"></div>
 *
 * Pages that need a search box / add button in the header-actions area put
 * them as children of the host and we hoist them into the .primary-actions
 * slot rendered by the partial. Pages that just want the menu + logout
 * leave the host empty.
 */

const SiteMenu = {
  initialized: false,
  partialUrl: "/components/header.html",

  items: [
    {
      key: "home",
      href: "/",
      icon: "首页",
      text: "首页",
      desc: "返回书签导航首页",
    },
    {
      key: "bookmarks-manage",
      href: "/bookmarks-manage.html",
      icon: "书签",
      text: "书签管理",
      desc: "搜索、筛选和批量移动书签",
      requiresAuth: true,
    },
    {
      key: "categories",
      href: "/categories.html",
      icon: "分类",
      text: "分类管理",
      desc: "创建、编辑和迁移分类",
      requiresAuth: true,
    },
    {
      key: "quick-add-bookmark",
      href: "/?new=bookmark",
      icon: "新增",
      text: "新增书签",
      desc: "打开首页添加站点弹窗",
      requiresAuth: true,
    },
    {
      key: "quick-add-category",
      href: "/categories.html?create=1",
      icon: "新类",
      text: "新建分类",
      desc: "直接聚焦分类创建表单",
      requiresAuth: true,
    },
    {
      key: "import",
      href: "/import.html",
      icon: "导入",
      text: "导入",
      desc: "导入书签文件或备份",
      requiresAuth: true,
    },
    {
      key: "link-checker",
      href: "/link-checker.html",
      icon: "检查",
      text: "链接检查",
      desc: "检查书签可访问性",
      requiresAuth: true,
    },
    {
      key: "deleted-bookmarks",
      href: "/deleted-bookmarks",
      icon: "回收",
      text: "回收站",
      desc: "查看和恢复删除记录",
      requiresAuth: true,
    },
    {
      key: "token",
      href: "/token.html",
      icon: "令牌",
      text: "同步令牌",
      desc: "管理同步访问令牌",
      requiresAuth: true,
    },
    {
      key: "notifications",
      href: "/notifications.html",
      icon: "通知",
      text: "通知",
      desc: "查看维护通知",
      requiresAuth: true,
    },
  ],

  menuGroups: [
    { label: "概览", keys: ["home"] },
    {
      label: "内容管理",
      keys: ["bookmarks-manage", "categories", "deleted-bookmarks"],
    },
    { label: "快速新建", keys: ["quick-add-bookmark", "quick-add-category"] },
    { label: "数据工具", keys: ["import"] },
    { label: "维护工具", keys: ["link-checker", "notifications"] },
    { label: "账号与安全", keys: ["token"] },
  ],

  async init() {
    if (this.initialized) return;
    if (window.location.pathname.includes("login")) return;

    const host = document.querySelector("[data-site-header]");
    if (!host) return;

    try {
      await this.inject(host);
      this.bindMenu(host);
      this.markActive(host);
      this.initialized = true;

      if (window.Auth) {
        const requireAuth = host.getAttribute("data-require-auth") !== "false";
        const ok = await Auth.init({ requireAuth });
        if (requireAuth && !ok) return;
        this.syncAuthState(host, requireAuth);
        this.syncMenuAuthState(host, requireAuth);
      }

      if (window.I18n?.apply) {
        I18n.apply();
        this.restorePageSubtitle(host);
      }
    } catch (error) {
      console.error("SiteMenu failed to initialize:", error);
    }
  },

  async inject(host) {
    const response = await fetch(this.partialUrl, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load header partial: ${response.status}`);
    }
    const markup = await response.text();
    const template = document.createElement("template");
    template.innerHTML = markup.trim();

    // The partial renders the inner header-content; the host may carry a
    // wrapper class (e.g. .header). Adopt the partial's first child.
    const fragment = template.content.cloneNode(true);
    const rendered = fragment.firstElementChild;
    if (!rendered) {
      throw new Error("Header partial is empty.");
    }

    this.applyPageIdentity(rendered, host);
    this.renderDropdown(rendered);
    this.hoistPrimarySlots(rendered, host);

    host.replaceChildren(rendered);
  },

  applyPageIdentity(rendered, host) {
    const read = (name, fallback) => host.getAttribute(name) ?? fallback;
    const icon = read("data-logo-icon", "N");
    const text = read("data-logo-text", "书签导航");
    const subtitle = read("data-logo-subtitle", "你的常用站点入口");

    const iconEl = rendered.querySelector("[data-site-header-logo-icon]");
    const textEl = rendered.querySelector("[data-site-header-logo-text]");
    const subEl = rendered.querySelector("[data-site-header-logo-subtitle]");

    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.textContent = text;
    if (subEl) {
      subEl.textContent = subtitle;
      // The subtitle may carry a fixed value per page, so do not let i18n
      // overwrite it. Keep the data-i18n key on the partial but restore
      // text after I18n.apply so translations stay opt-in per page.
      subEl.setAttribute("data-site-header-subtitle-original", subtitle);
    }
  },

  restorePageSubtitle(host) {
    const subtitle = host.getAttribute("data-logo-subtitle");
    const subEl = host.querySelector("[data-site-header-logo-subtitle]");
    if (subtitle && subEl) {
      subEl.textContent = subtitle;
    }
  },

  renderDropdown(rendered) {
    const dropdown = rendered.querySelector("#toolsDropdown");
    if (!dropdown) return;

    dropdown.innerHTML = this.menuGroups
      .map((group) => this.renderGroup(group))
      .join("");

    if (document.getElementById("settingsPanel")) {
      dropdown.insertAdjacentHTML(
        "beforeend",
        `
          <div class="dropdown-divider"></div>
          <button id="settingsToggle" class="dropdown-item" role="menuitem" type="button" data-auth-required="true">
            <span class="item-icon">设置</span>
            <div class="item-content">
              <span class="item-text">设置与密码</span>
              <span class="item-desc">导出、备份和修改密码</span>
            </div>
          </button>
        `,
      );
    }
  },

  renderGroup(group) {
    const links = group.keys
      .map((key) => this.items.find((item) => item.key === key))
      .filter(Boolean)
      .map((item) => this.renderLink(item))
      .join("");

    if (!links) return "";

    const requiresAuthGroup = group.keys.every((key) => {
      const item = this.items.find((candidate) => candidate.key === key);
      return item?.requiresAuth;
    });

    return `
      <div class="dropdown-section" data-menu-group="${group.label}"${
        requiresAuthGroup ? ' data-auth-group="true"' : ""
      }>
      <div class="dropdown-section-label">${group.label}</div>
      ${links}
      </div>
    `;
  },

  renderLink(item) {
    return `
      <a href="${item.href}" class="dropdown-item" role="menuitem" data-site-menu-key="${item.key}"${
        item.requiresAuth ? ' data-auth-required="true"' : ""
      }>
        <span class="item-icon">${item.icon}</span>
        <div class="item-content">
          <span class="item-text">${item.text}</span>
          <span class="item-desc">${item.desc}</span>
        </div>
      </a>
    `;
  },

  hoistPrimarySlots(rendered, host) {
    // Pages that need a search/add control keep them in the host as children.
    // We move them into the .primary-actions slot rendered by the partial so
    // the visual rhythm of the header stays consistent.
    const slot = rendered.querySelector('[data-site-header-slot="primary"]');
    if (!slot) return;

    const provided = Array.from(host.children).filter((child) =>
      child.hasAttribute("data-site-header-primary"),
    );
    provided.forEach((node) => slot.appendChild(node));
  },

  bindMenu(host) {
    const toggle = host.querySelector("#toolsMenuToggle");
    const dropdown = host.querySelector("#toolsDropdown");
    if (!toggle || !dropdown) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = dropdown.classList.toggle("show");
      toggle.classList.toggle("active", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    host.addEventListener(
      "click",
      (event) => {
        const protectedLink = event.target.closest("[data-auth-required]");
        if (!protectedLink || window.Auth?.isAuthenticated) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.closeMenu(host);
        this.redirectToLogin(protectedLink.getAttribute("href"));
      },
      true,
    );

    document.addEventListener("click", (event) => {
      if (!toggle.contains(event.target) && !dropdown.contains(event.target)) {
        this.closeMenu(host);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeMenu(host);
    });

    host.querySelector("#logoutBtn")?.addEventListener("click", () => {
      if (window.Auth?.isAuthenticated) {
        window.Auth.logout({ redirect: true });
        return;
      }

      this.redirectToLogin();
    });

    host.querySelector("#settingsToggle")?.addEventListener("click", () => {
      if (!this.requireAdmin()) {
        return;
      }

      this.closeMenu(host);
      document.getElementById("settingsPanel")?.classList.toggle("hidden");
    });
  },

  syncAuthState(host, requireAuth) {
    const logoutBtn = host.querySelector("#logoutBtn");
    if (!logoutBtn) return;

    const authenticated = Boolean(window.Auth?.isAuthenticated);
    logoutBtn.classList.toggle("is-login-action", !authenticated);
    logoutBtn.title = authenticated ? "退出登录" : "登录后台";
    logoutBtn.querySelector(".btn-icon").textContent = authenticated
      ? "退出"
      : "登录";
    logoutBtn.querySelector(".action-btn-label").textContent = authenticated
      ? "退出"
      : "登录后台";

    if (!requireAuth && !authenticated) {
      host
        .querySelector("#settingsToggle")
        ?.setAttribute("data-auth-required", "true");
    }
  },

  syncMenuAuthState(host, requireAuth) {
    const authenticated = Boolean(window.Auth?.isAuthenticated);
    const isPublicGuest = !requireAuth && !authenticated;

    host.querySelectorAll('[data-menu-group="快速新建"]').forEach((group) => {
      group.classList.toggle("hidden", isPublicGuest);
    });

    host.querySelectorAll("[data-auth-required]").forEach((element) => {
      element.classList.toggle("requires-login", !authenticated);
      if (!authenticated) {
        element.setAttribute("aria-label", "登录后台后使用");
      } else {
        element.removeAttribute("aria-label");
      }
    });
  },

  requireAdmin() {
    if (window.Auth?.isAuthenticated) {
      return true;
    }

    this.redirectToLogin();
    return false;
  },

  redirectToLogin(target = null) {
    if (!target && window.Auth?.redirectToLogin) {
      window.Auth.redirectToLogin();
      return;
    }

    const next = this.resolveNextPath(target);
    window.location.href = `/login.html?next=${encodeURIComponent(next)}`;
  },

  resolveNextPath(target = null) {
    if (!target) {
      return `${window.location.pathname}${window.location.search}`;
    }

    try {
      const url = new URL(target, window.location.origin);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      // Fall through to the current page when an invalid target is supplied.
    }

    return `${window.location.pathname}${window.location.search}`;
  },

  closeMenu(host) {
    const toggle = host.querySelector("#toolsMenuToggle");
    const dropdown = host.querySelector("#toolsDropdown");
    dropdown?.classList.remove("show");
    toggle?.classList.remove("active");
    toggle?.setAttribute("aria-expanded", "false");
  },

  markActive(host) {
    const pageKey = host.getAttribute("data-page-key");
    const path = this.normalizePath(window.location.pathname);

    // Highlight the dropdown entry whose key matches the page.
    if (pageKey) {
      host
        .querySelectorAll(`#toolsDropdown [data-site-menu-key]`)
        .forEach((link) => {
          if (link.getAttribute("data-site-menu-key") === pageKey) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
          }
        });
    }

    // Highlight the inline nav menu link based on path (fallback when no
    // page-key is provided).
    const navLinks = host.querySelectorAll("[data-site-header-nav-link]");
    navLinks.forEach((link) => {
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
