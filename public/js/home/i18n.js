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
        toolsTitle: "打开工具菜单",
        searchButton: "搜索",
        toolsButton: "菜单",
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
        heroKicker: "个人工作台",
        heroTitle: "把每天打开的网站，整理成一个清爽的入口。",
        heroCopy:
          "搜索、分类、排序和访问统计都在第一屏完成；适合放工作资料、学习资源和常用工具。",
        bookmarksKicker: "导航目录",
        bookmarksTitle: "常用站点",
        bookmarksCopy: "所有站点按当前筛选条件展示，点击网址直接访问。",
        loadFailedMessage: "站点目录加载失败。",
      },
      empty: {
        noBookmarks: "还没有站点",
        noBookmarksHint: "登录后台后，可以在书签管理里添加第一个导航链接。",
      },
      bookmarkCard: {
        hot: "常用站点",
        visitCount: "访问",
        lastVisited: "最近访问",
        open: "打开链接",
        uncategorized: "未分类",
        untitled: "未命名站点",
        justNow: "刚刚",
        minutesAgo: "分钟前",
        hoursAgo: "小时前",
        daysAgo: "天前",
        weeksAgo: "周前",
      },
      messages: {
        appInitFailed: "应用初始化失败",
        loadCategoriesFailed: "加载分类失败",
        loadBookmarksFailed: "加载书签失败",
        networkError: "网络连接异常，请稍后重试",
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
        toolsTitle: "Open tools menu",
        searchButton: "Search",
        toolsButton: "Menu",
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
        heroKicker: "Personal workspace",
        heroTitle: "Keep the sites you open every day in one clean entry.",
        heroCopy:
          "Search, categories, sorting, and visit stats stay in the first screen for a faster daily workflow.",
        bookmarksKicker: "Directory",
        bookmarksTitle: "Common sites",
        bookmarksCopy:
          "Sites are shown with the current filters. Open the URL directly.",
        loadFailedMessage: "The site directory could not be loaded.",
      },
      empty: {
        noBookmarks: "No sites yet",
        noBookmarksHint:
          "Log in to the admin area to add the first navigation link.",
      },
      bookmarkCard: {
        hot: "Common site",
        visitCount: "Visits",
        lastVisited: "Last visited",
        open: "Open link",
        uncategorized: "Uncategorized",
        untitled: "Untitled site",
        justNow: "Just now",
        minutesAgo: "m ago",
        hoursAgo: "h ago",
        daysAgo: "d ago",
        weeksAgo: "w ago",
      },
      messages: {
        appInitFailed: "App initialization failed",
        loadCategoriesFailed: "Failed to load categories",
        loadBookmarksFailed: "Failed to load bookmarks",
        networkError: "Network connection failed. Please try again later.",
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
