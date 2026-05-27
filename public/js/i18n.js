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
      header: {
        searchTitle: "搜索书签",
        addTitle: "添加书签",
        toolsTitle: "工具菜单",
        searchButton: "搜索",
        addButton: "新增书签",
        toolsButton: "工具",
        import: "导入",
        importDesc: "导入导出文件或备份",
        linkChecker: "链接检查",
        linkCheckerDesc: "检查书签可访问性",
        deleted: "已删除书签",
        deletedDesc: "查看和恢复删除记录",
        notifications: "通知",
        notificationsDesc: "查看最近维护通知",
        apiTokens: "同步令牌",
        apiTokensDesc: "查看同步与令牌说明",
        settings: "设置",
        settingsDesc: "导出、备份和导入",
      },
      search: {
        placeholder: "搜索书签标题、描述或 URL...",
        action: "搜索",
      },
      filter: {
        categoryLabel: "分类",
        sortLabel: "排序",
        allCategories: "全部分类",
        newest: "最新优先",
        popular: "最受欢迎",
        mostVisited: "访问最多",
        recentVisited: "最近访问",
        titleAZ: "标题 A-Z",
        titleZA: "标题 Z-A",
        recentUpdated: "最近更新",
        oldest: "最早优先",
        gridView: "网格视图",
        listView: "列表视图",
        gridShort: "网格",
        listShort: "列表",
      },
      stats: {
        total: "总计",
        currentPage: "当前页",
      },
      home: {
        logoSubtitle: "简洁书签工作台",
        heroBadge: "首页",
        heroTitle: "搜索优先，把常用链接更快找出来。",
        heroDescription:
          "首页只保留搜索、筛选和书签列表。导入、检查、恢复这些较重工具放进工具菜单里。",
        heroStartSearch: "开始搜索",
        heroBrowseLibrary: "浏览书签",
        heroMetricSearchLabel: "搜索",
        heroMetricSearchValue: "实时筛选",
        heroMetricManageLabel: "维护",
        heroMetricManageValue: "工具菜单集中管理",
        heroMetricMaintainLabel: "视图",
        heroMetricMaintainValue: "网格与列表切换",
        bookmarksKicker: "书签",
        bookmarksTitle: "当前书签库",
        bookmarksCopy:
          "首页只负责找链接；更深的导入、检查和恢复工作放到独立页面。",
        workspaceLabel: "浏览工作台",
        controlsHint: "先搜索，再按分类或排序缩小范围。",
        statsShortcutLabel: "使用建议",
        statsShortcutValue: "搜索、筛选、打开",
        loadFailedMessage: "书签列表加载失败。",
        settingsNote:
          "当前首页保持简洁，导入、检查和恢复功能统一放到工具页面里。",
      },
      empty: {
        noBookmarks: "还没有书签",
        noBookmarksHint: "点击顶部“新增书签”按钮添加你的第一个书签",
      },
      bookmarkCard: {
        hot: "热门书签",
        visitCount: "访问次数",
        lastVisited: "最后访问",
        edit: "编辑",
        delete: "删除",
        open: "打开链接",
      },
      bookmarkModal: {
        addTitle: "添加书签",
        title: "标题 *",
        url: "URL *",
        description: "描述",
        descriptionPlaceholder: "可选的描述...",
        category: "分类",
        noCategory: "无分类",
        saveBtn: "保存",
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
      header: {
        searchTitle: "Search bookmarks",
        addTitle: "Add bookmark",
        toolsTitle: "Tools menu",
        searchButton: "Search",
        addButton: "Add bookmark",
        toolsButton: "Tools",
        import: "Import",
        importDesc: "Import exports or backups",
        linkChecker: "Link Checker",
        linkCheckerDesc: "Check bookmark reachability",
        deleted: "Deleted Bookmarks",
        deletedDesc: "Review deleted records",
        notifications: "Notifications",
        notificationsDesc: "View maintenance notices",
        apiTokens: "Sync Tokens",
        apiTokensDesc: "Read token and sync guidance",
        settings: "Settings",
        settingsDesc: "Export, backup, and import",
      },
      search: {
        placeholder: "Search bookmark title, description, or URL...",
        action: "Search",
      },
      filter: {
        categoryLabel: "Category",
        sortLabel: "Sort",
        allCategories: "All categories",
        newest: "Newest first",
        popular: "Most popular",
        mostVisited: "Most visited",
        recentVisited: "Recently visited",
        titleAZ: "Title A-Z",
        titleZA: "Title Z-A",
        recentUpdated: "Recently updated",
        oldest: "Oldest first",
        gridView: "Grid view",
        listView: "List view",
        gridShort: "Grid",
        listShort: "List",
      },
      stats: {
        total: "Total",
        currentPage: "Current page",
      },
      home: {
        logoSubtitle: "Compact bookmark workspace",
        heroBadge: "Home",
        heroTitle: "Search first and find the links you use faster.",
        heroDescription:
          "The home page keeps only search, filters, and the bookmark list. Import, checking, and restore flows move into the tools menu.",
        heroStartSearch: "Start search",
        heroBrowseLibrary: "Browse bookmarks",
        heroMetricSearchLabel: "Search",
        heroMetricSearchValue: "Live filtering",
        heroMetricManageLabel: "Maintenance",
        heroMetricManageValue: "Managed in the tools menu",
        heroMetricMaintainLabel: "Views",
        heroMetricMaintainValue: "Grid and list switch",
        bookmarksKicker: "Bookmarks",
        bookmarksTitle: "Current library",
        bookmarksCopy:
          "The home page is for finding links; deeper maintenance stays on dedicated pages.",
        workspaceLabel: "Workspace",
        controlsHint: "Search first, then narrow with category and sort.",
        statsShortcutLabel: "Suggested path",
        statsShortcutValue: "Search, filter, open",
        loadFailedMessage: "The bookmark list could not be loaded.",
        settingsNote:
          "The home page stays simple, while import, checking, and restore live on tool pages.",
      },
      empty: {
        noBookmarks: "No bookmarks yet",
        noBookmarksHint:
          "Use the Add bookmark button to add your first bookmark.",
      },
      bookmarkCard: {
        hot: "Popular bookmark",
        visitCount: "Visit count",
        lastVisited: "Last visited",
        edit: "Edit",
        delete: "Delete",
        open: "Open link",
      },
      bookmarkModal: {
        addTitle: "Add bookmark",
        title: "Title *",
        url: "URL *",
        description: "Description",
        descriptionPlaceholder: "Optional description...",
        category: "Category",
        noCategory: "No category",
        saveBtn: "Save",
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
      pagination: {
        prev: "Previous",
        next: "Next",
      },
    },
  },

  t(key) {
    const parts = key.split(".");
    const ns = parts[0];
    const k = parts.slice(1).join(".");
    const dict = this.dict[this.lang] || this.dict.zh;
    if (dict[ns] && dict[ns][k] !== undefined) return dict[ns][k];
    if (this.dict.zh[ns] && this.dict.zh[ns][k] !== undefined)
      return this.dict.zh[ns][k];
    return key;
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
