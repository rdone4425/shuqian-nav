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
      key: "admin-dashboard",
      href: "/admin-dashboard.html",
      icon: "概览",
      text: "后台首页",
      desc: "查看书签、分类和维护摘要",
      requiresAuth: true,
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
      href: "/bookmarks-manage.html?new=bookmark",
      icon: "新增",
      text: "新增书签",
      desc: "打开书签管理页添加站点",
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
      href: "/deleted-bookmarks.html",
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
      key: "admin-settings",
      href: "/admin-settings.html",
      icon: "设置",
      text: "设置与密码",
      desc: "修改密码、导出书签和完整备份",
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
    { label: "概览", keys: ["home", "admin-dashboard"] },
    {
      label: "内容管理",
      keys: ["bookmarks-manage", "categories", "deleted-bookmarks"],
    },
    { label: "数据工具", keys: ["import"] },
    { label: "维护工具", keys: ["link-checker", "notifications"] },
    { label: "账号与安全", keys: ["admin-settings", "token"] },
  ],

  getAdminMenuGroups() {
    return this.menuGroups
      .map((group) => ({
        label: group.label,
        items: group.keys
          .filter((key) => key !== "home")
          .map((key) => this.items.find((item) => item.key === key))
          .filter(Boolean),
      }))
      .filter((group) => group.items.length);
  },

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

      const requireAuth = host.getAttribute("data-require-auth") !== "false";
      if (window.Auth) {
        const ok = await Auth.init({ requireAuth });
        if (requireAuth && !ok) return;
      }
      this.syncAuthState(host, requireAuth);
      this.syncMenuAuthState(host, requireAuth);

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
    dropdown.appendChild(this.renderGuestLoginPrompt());
  },

  renderGuestLoginPrompt() {
    const section = document.createElement("div");
    section.className = "dropdown-section public-login-prompt hidden";
    section.setAttribute("data-public-login-prompt", "true");
    section.innerHTML = `
      <div class="dropdown-section-label">后台</div>
      <a href="/login.html" class="dropdown-item" role="menuitem" data-site-menu-login>
        <span class="item-icon">登录</span>
        <div class="item-content">
          <span class="item-text">登录后台</span>
          <span class="item-desc">管理书签、分类、导入和系统工具</span>
        </div>
      </a>
    `;
    return section;
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
      const requireAuth = host.getAttribute("data-require-auth") !== "false";
      if (!requireAuth && window.Auth?.isAuthenticated) {
        window.location.href = "/admin-dashboard.html";
        return;
      }

      if (window.Auth?.isAuthenticated) {
        window.Auth.logout({ redirect: true });
        return;
      }

      this.redirectToLogin("/admin-dashboard.html");
    });
  },

  syncAuthState(host, requireAuth) {
    const logoutBtn = host.querySelector("#logoutBtn");
    if (!logoutBtn) return;

    const authenticated = Boolean(window.Auth?.isAuthenticated);
    const isPublicPage = !requireAuth;
    const isAdminEntry = isPublicPage && authenticated;
    logoutBtn.classList.toggle("is-login-action", !authenticated);
    logoutBtn.classList.toggle("is-admin-entry", isAdminEntry);
    logoutBtn.title = isAdminEntry
      ? "进入后台"
      : authenticated
        ? "退出登录"
        : "登录后台";
    logoutBtn.querySelector(".btn-icon").textContent = isAdminEntry
      ? "后台"
      : authenticated
        ? "退出"
        : "登录";
    logoutBtn.querySelector(".action-btn-label").textContent = isAdminEntry
      ? "进入后台"
      : authenticated
        ? "退出"
        : "登录后台";
  },

  syncMenuAuthState(host, requireAuth) {
    const authenticated = Boolean(window.Auth?.isAuthenticated);
    const isPublicPage = !requireAuth;
    const isPublicGuest = isPublicPage && !authenticated;
    const dropdown = host.querySelector("#toolsDropdown");
    const guestPrompt = host.querySelector("[data-public-login-prompt]");

    host.querySelectorAll("[data-auth-group]").forEach((group) => {
      group.classList.toggle("hidden", isPublicPage);
    });

    guestPrompt?.classList.toggle("hidden", !isPublicPage);
    const publicEntry = guestPrompt?.querySelector("[data-site-menu-login]");
    if (publicEntry) {
      publicEntry.setAttribute(
        "href",
        authenticated
          ? "/admin-dashboard.html"
          : `/login.html?next=${encodeURIComponent("/admin-dashboard.html")}`,
      );
      publicEntry.querySelector(".item-icon").textContent = authenticated
        ? "后台"
        : "登录";
      publicEntry.querySelector(".item-text").textContent = authenticated
        ? "进入后台"
        : "登录后台";
      publicEntry.querySelector(".item-desc").textContent = authenticated
        ? "打开统一管理工作台"
        : "登录后管理书签、分类和系统工具";
    }

    dropdown?.classList.toggle("is-public-guest-menu", isPublicPage);

    host.querySelectorAll("[data-auth-required]").forEach((element) => {
      const hiddenOnPublicHome = isPublicPage;
      element.classList.toggle("requires-login", !authenticated);
      element.classList.toggle("hidden", hiddenOnPublicHome);
      element.setAttribute("tabindex", hiddenOnPublicHome ? "-1" : "0");
      if (!authenticated || hiddenOnPublicHome) {
        element.setAttribute(
          "aria-label",
          hiddenOnPublicHome ? "进入后台后使用" : "登录后台后使用",
        );
      } else {
        element.removeAttribute("aria-label");
        element.removeAttribute("tabindex");
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
  },
};

document.addEventListener("DOMContentLoaded", () => {
  SiteMenu.init();
});

window.SiteMenu = SiteMenu;
