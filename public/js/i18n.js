const I18n = {
  lang: localStorage.getItem("lang") || "zh",

  dict: {
    zh: {
      common: {
        appName: "书签导航",
        loading: "加载中...",
        retry: "重试",
        clear: "清除",
        loadFailed: "加载失败",
      },
      nav: {
        directory: "导航目录",
      },
      header: {
        searchTitle: "聚焦搜索",
        addTitle: "添加站点",
        toolsTitle: "打开工具菜单",
        searchButton: "搜索",
        addButton: "新增站点",
        toolsButton: "菜单",
        import: "导入",
        importDesc: "导入导出文件或备份",
        linkChecker: "链接检查",
        linkCheckerDesc: "检查书签可访问性",
        deleted: "回收站",
        deletedDesc: "查看和恢复删除记录",
        notifications: "通知",
        notificationsDesc: "查看最近维护通知",
        apiTokens: "同步令牌",
        apiTokensDesc: "查看同步与令牌说明",
        settings: "设置",
        settingsDesc: "导出、备份和导入",
      },
      search: {
        placeholder: "搜索标题、描述、网址...",
        action: "搜索",
      },
      filter: {
        categoryLabel: "分类",
        sortLabel: "排序",
        allCategories: "全部分类",
        newest: "最新收录",
        popular: "最常用",
        mostVisited: "访问最多",
        recentVisited: "最近访问",
        titleAZ: "标题 A-Z",
        titleZA: "标题 Z-A",
        recentUpdated: "最近更新",
        oldest: "最早收录",
        gridView: "网格视图",
        listView: "列表视图",
        gridShort: "网格",
        listShort: "列表",
      },
      stats: {
        total: "站点总数",
        currentPage: "当前范围",
      },
      home: {
        logoSubtitle: "你的常用站点入口",
        bookmarksKicker: "导航目录",
        bookmarksTitle: "常用站点",
        bookmarksCopy:
          "所有站点按当前筛选条件展示，点击网址直接访问，或用卡片按钮编辑维护。",
        loadFailedMessage: "站点目录加载失败。",
        settingsNote:
          "首页作为导航入口，导入、检查、恢复和备份集中放在菜单与设置里。",
      },
      empty: {
        noBookmarks: "还没有站点",
        noBookmarksHint: "点击顶部“新增站点”按钮添加第一个导航链接。",
      },
      bookmarkCard: {
        hot: "常用站点",
        visitCount: "访问",
        lastVisited: "最近访问",
        edit: "编辑",
        delete: "删除",
        open: "打开链接",
        uncategorized: "未分类",
        untitled: "未命名站点",
        justNow: "刚刚",
        minutesAgo: "分钟前",
        hoursAgo: "小时前",
        daysAgo: "天前",
        weeksAgo: "周前",
      },
      bookmarkModal: {
        addTitle: "添加站点",
        editTitle: "编辑站点",
        title: "标题 *",
        url: "URL *",
        description: "描述",
        descriptionPlaceholder: "可选的描述...",
        category: "分类",
        noCategory: "无分类",
        saveBtn: "保存",
        saving: "保存中...",
        cancelBtn: "取消",
      },
      settings: {
        title: "设置",
        data: "数据",
        exportHtml: "导出 HTML",
        exportJson: "导出 JSON",
        backupJson: "完整备份 (JSON)",
        backupHtml: "完整备份 (HTML)",
        import: "导入书签",
      },
      messages: {
        appInitFailed: "应用初始化失败",
        loadCategoriesFailed: "加载分类失败",
        loadBookmarksFailed: "加载书签失败",
        networkError: "网络连接异常，请稍后重试",
        titleUrlRequired: "标题和 URL 是必填字段",
        saveFailed: "保存失败",
        bookmarkUpdated: "站点更新成功",
        bookmarkCreated: "站点创建成功",
        getBookmarkFailed: "获取站点信息失败",
        confirmDelete: "确定要删除站点“{title}”吗？此操作会进入回收记录。",
        deleteFailed: "删除失败",
        bookmarkDeleted: "站点删除成功",
        exportPreparing: "正在导出书签...",
        exportEmpty: "没有书签可以导出",
        exportSuccess: "成功导出 {count} 个书签",
        exportFailed: "导出失败",
        exportFetching: "正在获取书签... 已获取 {count} 个",
        backupPreparing: "正在创建 {format} 格式的完整备份...",
        backupSuccess: "完整备份已下载：{filename}",
        backupFailed: "备份失败",
      },
      pagination: {
        prev: "上一页",
        next: "下一页",
      },
    },
    en: {
      common: {
        appName: "Bookmark Navigator",
        loading: "Loading...",
        retry: "Retry",
        clear: "Clear",
        loadFailed: "Load failed",
      },
      nav: {
        directory: "Directory",
      },
      header: {
        searchTitle: "Focus search",
        addTitle: "Add site",
        toolsTitle: "Open tools menu",
        searchButton: "Search",
        addButton: "Add site",
        toolsButton: "Menu",
        import: "Import",
        importDesc: "Import exports or backups",
        linkChecker: "Link Checker",
        linkCheckerDesc: "Check bookmark reachability",
        deleted: "Recycle Bin",
        deletedDesc: "Review and restore deleted records",
        notifications: "Notifications",
        notificationsDesc: "View maintenance notices",
        apiTokens: "Sync Tokens",
        apiTokensDesc: "Read token and sync guidance",
        settings: "Settings",
        settingsDesc: "Export, backup, and import",
      },
      search: {
        placeholder: "Search title, description, or URL...",
        action: "Search",
      },
      filter: {
        categoryLabel: "Category",
        sortLabel: "Sort",
        allCategories: "All categories",
        newest: "Newest",
        popular: "Most used",
        mostVisited: "Most visited",
        recentVisited: "Recently visited",
        titleAZ: "Title A-Z",
        titleZA: "Title Z-A",
        recentUpdated: "Recently updated",
        oldest: "Oldest",
        gridView: "Grid view",
        listView: "List view",
        gridShort: "Grid",
        listShort: "List",
      },
      stats: {
        total: "Total sites",
        currentPage: "Current range",
      },
      home: {
        logoSubtitle: "Your everyday site entry",
        bookmarksKicker: "Directory",
        bookmarksTitle: "Common sites",
        bookmarksCopy:
          "Sites are shown with the current filters. Open the URL directly, or maintain items from the card actions.",
        loadFailedMessage: "The site directory could not be loaded.",
        settingsNote:
          "The homepage acts as the navigation entry, while import, checks, restore, and backups live in the menu and settings.",
      },
      empty: {
        noBookmarks: "No sites yet",
        noBookmarksHint: "Use Add site to create the first navigation link.",
      },
      bookmarkCard: {
        hot: "Common site",
        visitCount: "Visits",
        lastVisited: "Last visited",
        edit: "Edit",
        delete: "Delete",
        open: "Open link",
        uncategorized: "Uncategorized",
        untitled: "Untitled site",
        justNow: "Just now",
        minutesAgo: "m ago",
        hoursAgo: "h ago",
        daysAgo: "d ago",
        weeksAgo: "w ago",
      },
      bookmarkModal: {
        addTitle: "Add site",
        editTitle: "Edit site",
        title: "Title *",
        url: "URL *",
        description: "Description",
        descriptionPlaceholder: "Optional description...",
        category: "Category",
        noCategory: "No category",
        saveBtn: "Save",
        saving: "Saving...",
        cancelBtn: "Cancel",
      },
      settings: {
        title: "Settings",
        data: "Data",
        exportHtml: "Export HTML",
        exportJson: "Export JSON",
        backupJson: "Full backup (JSON)",
        backupHtml: "Full backup (HTML)",
        import: "Import bookmarks",
      },
      messages: {
        appInitFailed: "App initialization failed",
        loadCategoriesFailed: "Failed to load categories",
        loadBookmarksFailed: "Failed to load bookmarks",
        networkError: "Network connection failed. Please try again later.",
        titleUrlRequired: "Title and URL are required",
        saveFailed: "Save failed",
        bookmarkUpdated: "Site updated",
        bookmarkCreated: "Site created",
        getBookmarkFailed: "Failed to load site details",
        confirmDelete:
          "Delete site “{title}”? This will create a recycle record.",
        deleteFailed: "Delete failed",
        bookmarkDeleted: "Site deleted",
        exportPreparing: "Preparing export...",
        exportEmpty: "No bookmarks to export",
        exportSuccess: "Exported {count} bookmarks",
        exportFailed: "Export failed",
        exportFetching: "Fetching bookmarks... {count} loaded",
        backupPreparing: "Creating a full {format} backup...",
        backupSuccess: "Full backup downloaded: {filename}",
        backupFailed: "Backup failed",
      },
      pagination: {
        prev: "Previous",
        next: "Next",
      },
    },
  },

  t(key, params = {}) {
    const parts = key.split(".");
    const ns = parts[0];
    const k = parts.slice(1).join(".");
    const dict = this.dict[this.lang] || this.dict.zh;
    let value =
      dict[ns] && dict[ns][k] !== undefined
        ? dict[ns][k]
        : this.dict.zh[ns] && this.dict.zh[ns][k] !== undefined
          ? this.dict.zh[ns][k]
          : key;

    Object.entries(params).forEach(([name, replacement]) => {
      value = value.replace(`{${name}}`, String(replacement));
    });

    return value;
  },

  apply() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = this.t(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const text = this.t(key);
      if (text && text !== key) el.placeholder = text;
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const text = this.t(key);
      if (text && text !== key) el.title = text;
    });
    const titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) {
      const key = titleEl.getAttribute("data-i18n");
      const text = this.t(key);
      if (text && text !== key) document.title = text;
    }
  },

  init() {
    this.apply();
  },
};

window.I18n = I18n;
