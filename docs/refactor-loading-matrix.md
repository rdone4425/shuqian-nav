# 首页/后台加载矩阵

本文件是 `docs/refactor-roadmap.md` 第一阶段的执行基线。它约束哪些脚本可以被首页加载，哪些脚本只能被后台加载，避免后续 UI 重构时再次把两个产品面混在一起。

## 页面分组

### 公开首页

| 页面                      | 认证                                    | 允许加载                                                          |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `/` (`public/index.html`) | 不强制登录，`data-require-auth="false"` | `auth.js`、`site-menu.js`、`utils/api.js`、`i18n.js`、`js/home/*` |

首页只负责浏览、搜索、分类筛选、排序、打开书签和访问统计。新增、编辑、删除、导入、备份、改密码等管理动作必须由前端 `App.requireAdminAction()` 或后台页面拦截。

### 登录页

| 页面          | 认证       | 允许加载              |
| ------------- | ---------- | --------------------- |
| `/login.html` | 不强制登录 | `auth.js`、`login.js` |

登录页不加载 `site-menu.js`，避免未登录状态出现管理菜单。

### 后台页面

| 页面                      | 认证     | 允许加载                                                               |
| ------------------------- | -------- | ---------------------------------------------------------------------- |
| `/bookmarks-manage.html`  | 必须登录 | `auth.js`、`site-menu.js`、`admin-common.js`、`utils/api.js`、页面模块 |
| `/categories.html`        | 必须登录 | `auth.js`、`site-menu.js`、`admin-common.js`、`utils/api.js`、页面模块 |
| `/deleted-bookmarks.html` | 必须登录 | `auth.js`、`site-menu.js`、`admin-common.js`、`utils/api.js`、页面模块 |
| `/import.html`            | 必须登录 | `auth.js`、`site-menu.js`、`utils/api.js`、页面模块                    |
| `/link-checker.html`      | 必须登录 | `auth.js`、`site-menu.js`、`admin-common.js`、`utils/api.js`、页面逻辑 |
| `/notifications.html`     | 必须登录 | `auth.js`、`site-menu.js`、`admin-common.js`、`utils/api.js`、页面逻辑 |
| `/token.html`             | 必须登录 | `auth.js`、`site-menu.js`、页面逻辑                                    |

后台页面不允许加载 `js/home/*`。后台业务入口应由 `site-menu.js` 或后续统一 admin shell 渲染，不在每个页面重复硬编码同一套工具入口。

## 当前目录约定

```text
public/js/
  auth.js                 # shared
  site-menu.js            # shared header/menu runtime
  utils/api.js            # shared API client
  home/                   # homepage-only scripts
    app.js
    bookmarks.js
    storage.js
    sorting.js
    dom-helper.js
    ui-helper.js
    ui-enhancements.js
  admin-common.js         # admin-only helper
  bookmark-manager-page.js
  category-manager.js
  deleted-bookmarks.js
  import.js
```

## Enforcement Checks

Use these checks before merging homepage/admin separation work:

```powershell
rg -n "/js/home/" public -g "*.html"
rg -n "/js/(app|bookmarks|ui-enhancements)\.js|/js/utils/(storage|sorting|dom-helper|ui-helper)\.js" public -g "*.html"
node --check public/js/home/app.js
node --check public/js/home/bookmarks.js
node --check public/js/home/storage.js
node --check public/js/home/sorting.js
node --check public/js/home/dom-helper.js
node --check public/js/home/ui-helper.js
node --check public/js/home/ui-enhancements.js
```

Expected result:

- Only `public/index.html` references `/js/home/*`.
- No page references old homepage paths such as `/js/bookmarks.js` or `/js/utils/sorting.js`.
- Admin pages still load `utils/api.js`, `auth.js`, `site-menu.js`, and their page modules.
