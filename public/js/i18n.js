// i18n - Internationalization (Chinese primary, English fallback)
// Default language: Chinese
const I18n = {
  lang: localStorage.getItem("lang") || "zh",

  dict: {
    zh: {
      common: {
        appName: "书签导航",
        appNameFull: "书签导航",
        version: "v1.0.0",
        cloudflare: "Cloudflare Pages + Functions + D1",
        healthCheck: "健康检查",
        loading: "加载中...",
        retry: "重试",
        cancel: "取消",
        save: "保存",
        delete: "删除",
        confirm: "确认",
        close: "关闭",
        backToTop: "返回顶部",
        search: "搜索",
        noResults: "没有匹配的书签",
        loadFailed: "加载失败",
      },
      login: {
        title: "登录 - 书签导航",
        subtitle: "请输入管理员密码以继续",
        hintFirst: "首次登录：使用",
        hintAfter: "，登录后请立即修改密码",
        password: "密码",
        passwordPlaceholder: "输入密码",
        loginBtn: "登录",
        loginLoading: "正在登录...",
        verifying: "验证中...",
        errorEmpty: "请输入密码",
        errorWrong: "密码错误",
        errorNetwork: "网络错误，请重试",
        successDefault: "登录成功。请尽快修改默认密码。",
        success: "登录成功，正在跳转...",
      },
      header: {
        searchTitle: "搜索书签",
        addTitle: "添加书签",
        toolsTitle: "工具菜单",
        apiTokens: "API 令牌",
        apiTokensDesc: "管理访问令牌",
        linkChecker: "链接检查",
        linkCheckerDesc: "检查书签可访问性",
        deleted: "已删除书签",
        deletedDesc: "查看已删除书签",
        notifications: "通知",
        notificationsDesc: "查看最近通知",
        aiSettings: "AI 设置",
        aiSettingsDesc: "管理 AI 端点和模型",
        changePassword: "修改密码",
        changePasswordDesc: "更新管理员密码",
        settings: "设置",
        settingsDesc: "打开设置面板",
      },
      search: {
        placeholder: "搜索书签标题、描述或 URL...",
        palettePlaceholder: "搜索书签、分类或命令...",
        paletteTitle: "命令面板",
        liveHint: "实时筛选、命令面板和快速导航",
      },
      filter: {
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
      },
      stats: {
        total: "总计",
        currentPage: "当前页",
      },
      wiki: {
        sections: "分类",
        pinned: "置顶",
        knowledgeBase: "书签知识库",
        browseTitle: "像维基一样浏览你的收藏",
        bookmarkCount: "个书签 | 实时搜索 | 分类导航",
        aiStatus: "AI 视图：未生成",
        aiReady: "AI 视图：已就绪",
        aiGenerating: "AI 视图：生成中...",
        generateAi: "生成 AI 视图",
        useLocal: "使用本地视图",
        openPalette: "打开命令面板",
      },
      empty: {
        noBookmarks: "还没有书签",
        noBookmarksHint: "点击顶部 + 按钮添加你的第一个书签",
      },
      bookmarkModal: {
        addTitle: "添加书签",
        editTitle: "编辑书签",
        title: "标题 *",
        url: "URL *",
        urlPlaceholder: "https://...",
        description: "描述",
        descriptionPlaceholder: "可选的描述...",
        category: "分类",
        noCategory: "无分类",
        saveBtn: "保存",
        cancelBtn: "取消",
      },
      password: {
        title: "修改密码",
        current: "当前密码",
        newPwd: "新密码",
        confirmPwd: "确认新密码",
        minLength: "至少 6 个字符",
        updateBtn: "更新密码",
        cancelBtn: "取消",
      },
      settings: {
        title: "设置",
        account: "账户",
        logout: "退出登录",
        logoutConfirm: "确定要退出登录吗？",
        data: "数据",
        exportHtml: "导出 HTML",
        exportJson: "导出 JSON",
        backupJson: "完整备份 (JSON)",
        backupHtml: "完整备份 (HTML)",
        import: "导入书签",
        ai: "AI",
        aiInfo: "更新维基视图使用的 AI 端点和模型",
        aiEndpoint: "AI 端点 URL",
        aiEndpointPlaceholder: "https://api.openai.com/v1/chat/completions",
        aiEndpointHint: "留空则使用 AI_API_ENDPOINT",
        aiModel: "默认模型",
        aiModelPlaceholder: "gpt-4o-mini",
        aiModelHint: "留空则使用 AI_MODEL",
        saveAiConfig: "保存 AI 配置",
      },
      pagination: {
        prev: "上一页",
        next: "下一页",
      },
      token: {
        title: "API 令牌管理",
        subtitle: "创建和管理访问令牌以进行 API 认证",
        name: "令牌名称",
        namePlaceholder: "例如：Chrome 同步 worker",
        note: "备注",
        notePlaceholder: "可选的备注，说明令牌的用途",
        create: "创建令牌",
        revoke: "撤销",
        revokeConfirm: "确定要撤销此令牌吗？此操作不可撤销。",
        noTokens: "还没有令牌",
        noTokensHint: "点击上方按钮创建第一个令牌",
        tokenCreated: "新令牌已创建，请立即复制保存。关闭后将无法再次查看。",
        copied: "已复制到剪贴板",
        copyFailed: "复制失败，请手动复制",
      },
      linkChecker: {
        title: "链接检查器",
        subtitle: "检查所有书签的可访问性",
        statusAll: "全部",
        statusChecking: "正在检查...",
        statusDone: "检查完成",
        statusError: "检查出错",
        checkBtn: "开始检查",
        stopBtn: "停止",
        url: "URL",
        status: "状态",
        code: "状态码",
        lastCheck: "上次检查",
        never: "从未",
        noBookmarks: "没有书签可检查",
        filterAll: "全部",
        filterOk: "正常",
        filterBroken: "失效",
        filterUnknown: "未知",
        keep: "保留",
        unkeep: "取消保留",
        del: "删除",
        deleteConfirm: "确定要删除书签",
        deleteConfirmEnd: "吗？此操作不可撤销。",
      },
      notifications: {
        title: "通知",
        subtitle: "查看最近的通知和提醒",
        noNotifications: "暂无通知",
        noNotificationsHint: "有新通知时会在这里显示",
        clearAll: "清除全部",
        markRead: "标为已读",
      },
      deleted: {
        title: "已删除书签",
        subtitle: "查看和管理已删除的书签",
        searchPlaceholder: "搜索标题或 URL",
        restore: "恢复",
        restoreConfirm: "确定要恢复此书签吗？",
        noDeleted: "没有已删除的书签",
        noDeletedHint: "删除的书签会显示在这里，可以恢复",
      },
      aiSettings: {
        title: "AI 设置",
        subtitle: "配置 AI 端点和模型设置",
        endpoint: "AI 端点",
        endpointPlaceholder: "https://api.openai.com/v1/chat/completions",
        model: "模型",
        modelPlaceholder: "gpt-4o-mini",
        save: "保存设置",
        saved: "设置已保存",
        reset: "重置",
      },
    },
    en: {
      common: {
        appName: "Bookmark Navigator",
        appNameFull: "Bookmark Navigator",
        version: "v1.0.0",
        cloudflare: "Cloudflare Pages + Functions + D1",
        healthCheck: "Health Check",
        loading: "Loading...",
        retry: "Retry",
        cancel: "Cancel",
        save: "Save",
        delete: "Delete",
        confirm: "Confirm",
        close: "Close",
        backToTop: "Back to top",
        search: "Search",
        noResults: "No bookmarks matched the current filter.",
        loadFailed: "The bookmark list could not be loaded.",
      },
      login: {
        title: "Login - Bookmark Navigator",
        subtitle: "Enter the admin password to continue.",
        hintFirst: "First login: use",
        hintAfter: ", then change it immediately after sign-in.",
        password: "Password",
        passwordPlaceholder: "Enter password",
        loginBtn: "Login",
        loginLoading: "Logging in...",
        verifying: "Verifying...",
        errorEmpty: "Please enter a password.",
        errorWrong: "Password is incorrect.",
        errorNetwork: "Network error. Please try again.",
        successDefault: "Login successful. Change the default password as soon as possible.",
        success: "Login successful. Redirecting...",
      },
      header: {
        searchTitle: "Search bookmarks",
        addTitle: "Add bookmark",
        toolsTitle: "Tools menu",
        apiTokens: "API Tokens",
        apiTokensDesc: "Manage access tokens",
        linkChecker: "Link Checker",
        linkCheckerDesc: "Check bookmark reachability",
        deleted: "Deleted",
        deletedDesc: "Review deleted bookmarks",
        notifications: "Notifications",
        notificationsDesc: "View recent notices",
        aiSettings: "AI Settings",
        aiSettingsDesc: "Manage AI endpoint and model",
        changePassword: "Change Password",
        changePasswordDesc: "Update the admin password",
        settings: "Settings",
        settingsDesc: "Open the settings panel",
      },
      search: {
        placeholder: "Search bookmark title, description, or URL...",
        palettePlaceholder: "Search bookmarks, categories, or commands...",
        paletteTitle: "Command Palette",
        liveHint: "Live filtering, command palette, and quick navigation.",
      },
      filter: {
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
      },
      stats: {
        total: "Total:",
        currentPage: "Current page:",
      },
      wiki: {
        sections: "Sections",
        pinned: "Pinned",
        knowledgeBase: "Bookmark knowledge base",
        browseTitle: "Browse your collection like a wiki",
        bookmarkCount: " bookmarks | instant search | category sections and table of contents",
        aiStatus: "AI view: not generated yet",
        aiReady: "AI view: ready",
        aiGenerating: "AI view: generating...",
        generateAi: "Generate AI view",
        useLocal: "Use local view",
        openPalette: "Open command palette",
      },
      empty: {
        noBookmarks: "No bookmarks yet",
        noBookmarksHint: "Use the plus button in the header to add your first bookmark.",
      },
      bookmarkModal: {
        addTitle: "Add bookmark",
        editTitle: "Edit bookmark",
        title: "Title *",
        url: "URL *",
        urlPlaceholder: "https://...",
        description: "Description",
        descriptionPlaceholder: "Optional description...",
        category: "Category",
        noCategory: "No category",
        saveBtn: "Save",
        cancelBtn: "Cancel",
      },
      password: {
        title: "Change password",
        current: "Current password",
        newPwd: "New password",
        confirmPwd: "Confirm new password",
        minLength: "Use at least 6 characters.",
        updateBtn: "Update password",
        cancelBtn: "Cancel",
      },
      settings: {
        title: "Settings",
        account: "Account",
        logout: "Log out",
        logoutConfirm: "确定要退出登录吗？",
        data: "Data",
        exportHtml: "Export HTML",
        exportJson: "Export JSON",
        backupJson: "Full backup (JSON)",
        backupHtml: "Full backup (HTML)",
        import: "Import bookmarks",
        ai: "AI",
        aiInfo: "Update the AI endpoint and model used by the wiki view.",
        aiEndpoint: "AI endpoint URL",
        aiEndpointPlaceholder: "https://api.openai.com/v1/chat/completions",
        aiEndpointHint: "Leave empty to use AI_API_ENDPOINT.",
        aiModel: "Default model",
        aiModelPlaceholder: "gpt-4o-mini",
        aiModelHint: "Leave empty to use AI_MODEL.",
        saveAiConfig: "Save AI config",
      },
      pagination: {
        prev: "Previous",
        next: "Next",
      },
      token: {
        title: "API Tokens",
        subtitle: "Create and manage access tokens for API authentication",
        name: "Token name",
        namePlaceholder: "Example: Chrome sync worker",
        note: "Note",
        notePlaceholder: "Optional note about where this token is used",
        create: "Create token",
        revoke: "Revoke",
        revokeConfirm: "确定要撤销此令牌吗？此操作不可撤销。",
        noTokens: "No tokens yet",
        noTokensHint: "Click the button above to create your first token.",
        tokenCreated: "New token created. Copy it now — you won't see it again.",
        copied: "Copied to clipboard",
        copyFailed: "Copy failed, please copy manually",
      },
      linkChecker: {
        title: "Link Checker",
        subtitle: "Check the reachability of all bookmarks",
        statusAll: "All",
        statusChecking: "Checking...",
        statusDone: "Done",
        statusError: "Error",
        checkBtn: "Start check",
        stopBtn: "Stop",
        url: "URL",
        status: "Status",
        code: "Code",
        lastCheck: "Last check",
        never: "Never",
        noBookmarks: "No bookmarks to check",
        filterAll: "All",
        filterOk: "OK",
        filterBroken: "Broken",
        filterUnknown: "Unknown",
        keep: "Keep",
        unkeep: "Unkeep",
        del: "Delete",
        deleteConfirm: "确定要删除书签",
        deleteConfirmEnd: "吗？此操作不可撤销",
      },
      notifications: {
        title: "Notifications",
        subtitle: "View recent notices and reminders",
        noNotifications: "No notifications",
        noNotificationsHint: "New notifications will appear here",
        clearAll: "Clear all",
        markRead: "Mark as read",
      },
      deleted: {
        title: "Deleted Bookmarks",
        subtitle: "View and manage deleted bookmarks",
        searchPlaceholder: "Search title or URL",
        restore: "Restore",
        restoreConfirm: "确定要恢复此书签吗？",
        noDeleted: "No deleted bookmarks",
        noDeletedHint: "Deleted bookmarks appear here and can be restored",
      },
      aiSettings: {
        title: "AI Settings",
        subtitle: "Configure AI endpoint and model settings",
        endpoint: "AI endpoint",
        endpointPlaceholder: "https://api.openai.com/v1/chat/completions",
        model: "Model",
        modelPlaceholder: "gpt-4o-mini",
        save: "Save settings",
        saved: "Settings saved",
        reset: "Reset",
      },
    },
  },

  t(key) {
    const parts = key.split(".");
    const ns = parts[0];
    const k = parts.slice(1).join(".");
    const dict = this.dict[this.lang] || this.dict.zh;
    if (dict[ns] && dict[ns][k] !== undefined) return dict[ns][k];
    if (this.dict.zh[ns] && this.dict.zh[ns][k] !== undefined) return this.dict.zh[ns][k];
    return key;
  },

  setLang(lang) {
    this.lang = lang;
    localStorage.setItem("lang", lang);
    this.apply();
    this.updateToggle();
  },

  toggle() {
    this.setLang(this.lang === "zh" ? "en" : "zh");
  },

  apply() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const text = this.t(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      const text = this.t(key);
      if (text && text !== key) el.placeholder = text;
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      const text = this.t(key);
      if (text && text !== key) el.title = text;
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      const text = this.t(key);
      if (text && text !== key) el.title = text;
    });
    // html content
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      const text = this.t(key);
      if (text && text !== key) el.innerHTML = text;
    });
    document.title = this.t("login.title") || document.title;
  },

  updateToggle() {
    const btn = document.getElementById("langToggle");
    if (btn) {
      btn.textContent = this.lang === "zh" ? "EN" : "中";
      btn.title = this.lang === "zh" ? "Switch to English" : "切换到中文";
    }
  },

  init() {
    // Add toggle button to header if not exists
    if (!document.getElementById("langToggle")) {
      const headerActions = document.querySelector(".header-actions");
      if (headerActions) {
        const btn = document.createElement("button");
        btn.id = "langToggle";
        btn.className = "action-btn-icon";
        btn.setAttribute("title", this.lang === "zh" ? "Switch to English" : "切换到中文");
        btn.style.cssText = "font-size:12px;font-weight:600;letter-spacing:0.5px;";
        btn.textContent = this.lang === "zh" ? "EN" : "中";
        btn.onclick = () => this.toggle();
        headerActions.insertBefore(btn, headerActions.firstChild);
      }
    }
    this.apply();
  },
};
