/**
 * 后台 SPA 哈希路由器。
 *
 * 监听 `#/<key>?<query>`，从 AdminMenu 取路由信息，fetch 对应片段注入内容区，
 * 再调用该视图模块的 init(params)。切换视图前调用上一个视图的 destroy()。
 *
 * 仅在 SPA 外壳 /admin.html 内运行（该页才加载本脚本）。
 */

const AdminRouter = {
  currentKey: null,
  currentView: null,
  navToken: 0,
  contentEl: null,
  loadingEl: null,
  errorEl: null,
  errorMsgEl: null,

  start() {
    this.contentEl = document.getElementById("adminViewContent");
    this.loadingEl = document.getElementById("adminViewLoading");
    this.errorEl = document.getElementById("adminViewError");
    this.errorMsgEl = this.errorEl?.querySelector(".admin-view-error-msg");

    document
      .querySelector("[data-admin-view-retry]")
      ?.addEventListener("click", () => this.handleRoute());
    window.addEventListener("hashchange", () => this.handleRoute());

    this.handleRoute();
  },

  // `#/bookmarks-manage?new=bookmark` -> { key, params }
  parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const [path, queryString = ""] = raw.split("?");
    const key = path || window.AdminMenu.defaultKey;
    const params = Object.fromEntries(
      new URLSearchParams(queryString).entries(),
    );
    return { key, params };
  },

  async handleRoute() {
    // 鉴权守卫：每次路由都校验（Auth 有缓存，命中不发请求；token 过期会跳登录）。
    const authenticated = await AdminUI.requireAuth();
    if (!authenticated) return;

    const { key, params } = this.parseHash();
    const route = window.AdminMenu.get(key);
    if (!route) {
      window.location.replace(`#/${window.AdminMenu.defaultKey}`);
      return;
    }

    // 同一视图已挂载、仅 query 变化：交给视图自行响应，不重新加载。
    if (key === this.currentKey && this.currentView) {
      this.currentView.onParams?.(params);
      return;
    }

    const token = ++this.navToken;
    this.showLoading();
    this.setActive(key);

    let html;
    try {
      const response = await fetch(route.fragment, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`片段加载失败 (${response.status})`);
      }
      html = await response.text();
    } catch (error) {
      if (token !== this.navToken) return; // 已有更新的导航，丢弃本次结果
      await this.teardownCurrent();
      this.currentKey = null;
      this.showError(error.message);
      return;
    }

    if (token !== this.navToken) return; // fetch 期间用户又切了页

    await this.teardownCurrent();
    this.contentEl.innerHTML = html;
    this.hideLoading();

    const view = window[route.module];
    this.currentKey = key;
    this.currentView = view || null;

    if (!view || typeof view.init !== "function") {
      this.currentKey = null;
      this.showError(`视图模块 ${route.module} 尚未就绪`);
      return;
    }

    try {
      await view.init(params);
    } catch (error) {
      console.error(`视图 ${key} 初始化失败:`, error);
      this.showError("页面初始化失败");
    }
  },

  async teardownCurrent() {
    if (this.currentView?.destroy) {
      try {
        await this.currentView.destroy();
      } catch (error) {
        console.error("视图卸载失败:", error);
      }
    }
    this.currentView = null;
  },

  // 更新顶部标题与侧边栏高亮。
  setActive(key) {
    const host = document.querySelector("[data-site-header]");
    if (host) {
      host.setAttribute("data-page-key", key);
      window.SiteMenu?.refreshAdminTitle?.();
    }
    document.querySelectorAll(".admin-sidebar-link").forEach((link) => {
      const isActive = link.getAttribute("href") === `#/${key}`;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  },

  showLoading() {
    this.loadingEl?.classList.remove("hidden");
    this.errorEl?.classList.add("hidden");
  },

  hideLoading() {
    this.loadingEl?.classList.add("hidden");
  },

  showError(message) {
    this.hideLoading();
    if (this.contentEl) this.contentEl.innerHTML = "";
    if (this.errorMsgEl) this.errorMsgEl.textContent = `加载失败：${message}`;
    this.errorEl?.classList.remove("hidden");
  },
};

window.AdminRouter = AdminRouter;
document.addEventListener("DOMContentLoaded", () => AdminRouter.start());
