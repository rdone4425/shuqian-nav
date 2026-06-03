# 首页/后台加载矩阵

本文件是 `docs/refactor-roadmap.md` 第一阶段的执行基线。它约束哪些脚本可以被首页加载，哪些脚本只能被后台加载，避免后续 UI 重构时再次把两个产品面混在一起。

## 页面分组

### 公开首页

| 页面                      | 认证                                    | 允许加载                                                                         |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `/` (`public/index.html`) | 不强制登录，`data-require-auth="false"` | `/js/home/i18n.js`、`/js/shared/api.js`、`/js/shared/site-menu.js`、`/js/home/*` |

首页只负责浏览、搜索、分类筛选、排序、打开书签和访问统计。新增、编辑、删除、导入、备份、改密码等管理动作只允许出现在后台页面。

### 登录页

| 页面          | 认证       | 允许加载                             |
| ------------- | ---------- | ------------------------------------ |
| `/login.html` | 不强制登录 | `/js/shared/auth.js`、`/js/login.js` |

登录页不加载 `/js/shared/site-menu.js`，避免未登录状态出现管理菜单。

### 后台页面

| 页面                      | 认证     | 页面模块                             |
| ------------------------- | -------- | ------------------------------------ |
| `/admin-dashboard.html`   | 必须登录 | `/js/admin/admin-dashboard.js`       |
| `/admin-settings.html`    | 必须登录 | `/js/admin/admin-settings.js`        |
| `/bookmarks-manage.html`  | 必须登录 | `/js/admin/bookmark-manager-page.js` |
| `/categories.html`        | 必须登录 | `/js/admin/category-manager.js`      |
| `/deleted-bookmarks.html` | 必须登录 | `/js/admin/deleted-bookmarks.js`     |
| `/import.html`            | 必须登录 | `/js/admin/import.js`                |
| `/link-checker.html`      | 必须登录 | `/js/admin/link-checker-page.js`     |
| `/notifications.html`     | 必须登录 | `/js/admin/notifications-page.js`    |
| `/token.html`             | 必须登录 | `/js/admin/token-page.js`            |

后台页面必须加载共享后台运行时和自己的 `/js/admin/...` 页面模块：需要 API 客户端的页面按 `/js/shared/api.js`、`/js/shared/auth.js`、`/js/shared/site-menu.js`、`/js/shared/admin-common.js`、`/js/shared/admin-shell.js`、页面模块的顺序加载；`token.html` 不加载 API 客户端，按 `/js/shared/auth.js`、`/js/shared/site-menu.js`、`/js/shared/admin-common.js`、`/js/shared/admin-shell.js`、`/js/admin/token-page.js` 加载。

后台页面不允许加载 `/js/home/*`。后台业务入口应由 `/js/shared/admin-shell.js` 渲染，不在每个页面重复硬编码同一套工具入口。所有后台页面模块必须先调用 `AdminUI.requireAuth()` 再执行受保护工作。

## 当前目录约定

```text
public/js/
  login.js                 # login page only
  shared/                  # shared runtime
    api.js
    auth.js
    site-menu.js
    admin-common.js
    admin-shell.js
  home/                    # homepage-only scripts
    i18n.js
    app.js
    bookmarks.js
    storage.js
    sorting.js
    dom-helper.js
    ui-helper.js
    ui-enhancements.js
  admin/                   # protected admin page modules
    admin-dashboard.js
    admin-settings.js
    bookmark-manager-page.js
    category-manager.js
    deleted-bookmarks.js
    import.js
    link-checker-page.js
    notifications-page.js
    token-page.js
```

## 根目录约束

`public/js/` 根目录只允许保留 `login.js`。首页脚本必须在 `public/js/home/`，后台页面模块必须在 `public/js/admin/`，共享运行时代码必须在 `public/js/shared/`。

## 加载顺序约束

无构建脚本依赖全局对象，HTML 中的 `<script>` 顺序必须稳定。首页先加载 `/js/home/i18n.js`、`/js/home/storage.js`、`/js/shared/api.js`，再加载 home helpers、`/js/shared/site-menu.js` 和 `/js/home/app.js`。后台页先加载 shared 运行时，再加载 `/js/shared/admin-common.js`、`/js/shared/admin-shell.js` 和本页 `/js/admin/*` 模块。登录页只加载 `/js/shared/auth.js` 和 `/js/login.js`。

所有 HTML 中的本地 `/js/...` 引用都必须带 `?v=nav-...` 缓存版本。除 `/css/styles.css` 外，本地 `/css/...` 引用也必须带 `?v=nav-...`。

## Enforcement Checks

Use these checks before merging homepage/admin separation work:

```powershell
node --check scripts/audit-loading-matrix.mjs
node scripts/audit-loading-matrix.mjs
node --check public/js/home/app.js
node --check public/js/home/bookmarks.js
node --check public/js/shared/site-menu.js
node --check public/js/shared/admin-shell.js
npm test
```

Expected result:

- Only `public/index.html` references `/js/home/*`.
- No page references old homepage paths such as `/js/bookmarks.js` or `/js/utils/sorting.js`.
- No page references old shared paths such as `/js/auth.js`, `/js/site-menu.js`, `/js/admin-common.js`, or `/js/utils/api.js`.
- Admin pages load `/js/shared/...` runtime scripts, `/js/shared/admin-shell.js`, and their `/js/admin/...` page modules.
- `public/js/` root contains only `login.js`.
