/**
 * 后台菜单与路由的单一数据源。
 *
 * 侧边栏（admin-shell.js）、顶部标题、以及后续的 SPA 路由器（admin-router.js）
 * 都从这里读取后台导航信息，不再各自硬编码。
 *
 * href 由 hrefFor() 动态生成：
 *   - 在 SPA 外壳 /admin.html 内 → 哈希路由 `#/<key>`
 *   - 在过渡期的独立后台页（旧 .html）→ 整页链接 `/<key>.html`
 * 这样同一份数据既服务旧多页结构、又服务新的单页结构。
 */

const AdminMenu = {
  // 后台独立视图。key 同时是路由键、旧页面文件名（/<key>.html）和片段名。
  routes: [
    {
      key: "admin-dashboard",
      fragment: "/fragments/admin-dashboard.html",
      module: "AdminDashboardPage",
      text: "后台首页",
      desc: "查看书签、分类和维护摘要",
      icon: "概览",
      group: "概览",
      requiresAuth: true,
    },
    {
      key: "bookmarks-manage",
      fragment: "/fragments/bookmarks-manage.html",
      module: "BookmarkManagePage",
      text: "书签管理",
      desc: "搜索、筛选和批量移动书签",
      icon: "书签",
      group: "内容管理",
      requiresAuth: true,
    },
    {
      key: "categories",
      fragment: "/fragments/categories.html",
      module: "CategoryManagerPage",
      text: "分类管理",
      desc: "创建、编辑和迁移分类",
      icon: "分类",
      group: "内容管理",
      requiresAuth: true,
    },
    {
      key: "deleted-bookmarks",
      fragment: "/fragments/deleted-bookmarks.html",
      module: "DeletedBookmarksPage",
      text: "回收站",
      desc: "查看和恢复删除记录",
      icon: "回收",
      group: "内容管理",
      requiresAuth: true,
    },
    {
      key: "import",
      fragment: "/fragments/import.html",
      module: "ImportManager",
      text: "导入",
      desc: "导入书签文件或备份",
      icon: "导入",
      group: "数据工具",
      requiresAuth: true,
    },
    {
      key: "link-checker",
      fragment: "/fragments/link-checker.html",
      module: "LinkCheckerPage",
      text: "链接检查",
      desc: "检查书签可访问性",
      icon: "检查",
      group: "维护工具",
      requiresAuth: true,
    },
    {
      key: "notifications",
      fragment: "/fragments/notifications.html",
      module: "NotificationsPage",
      text: "通知",
      desc: "查看维护通知",
      icon: "通知",
      group: "维护工具",
      requiresAuth: true,
    },
    {
      key: "admin-settings",
      fragment: "/fragments/admin-settings.html",
      module: "AdminSettingsPage",
      text: "设置与密码",
      desc: "修改密码、导出书签和完整备份",
      icon: "设置",
      group: "账号与安全",
      requiresAuth: true,
    },
    {
      key: "token",
      fragment: "/fragments/token.html",
      module: "TokenPage",
      text: "同步令牌",
      desc: "管理同步访问令牌",
      icon: "令牌",
      group: "账号与安全",
      requiresAuth: true,
    },
  ],

  // 侧边栏分组顺序（与原 site-menu 信息架构一致，去掉公开首页项）。
  groupOrder: ["概览", "内容管理", "数据工具", "维护工具", "账号与安全"],

  defaultKey: "admin-dashboard",

  get(key) {
    return this.routes.find((route) => route.key === key) || null;
  },

  // 旧多页结构用 /<key>.html，SPA 外壳内用 #/<key>。
  hrefFor(key) {
    const inShell = window.location.pathname.endsWith("/admin.html");
    return inShell ? `#/${key}` : `/${key}.html`;
  },

  // 供 admin-shell.js 渲染侧边栏：按 groupOrder 聚合，并补上动态 href。
  getAdminMenuGroups() {
    return this.groupOrder
      .map((label) => ({
        label,
        items: this.routes
          .filter((route) => route.group === label)
          .map((route) => ({ ...route, href: this.hrefFor(route.key) })),
      }))
      .filter((group) => group.items.length);
  },
};

window.AdminMenu = AdminMenu;
