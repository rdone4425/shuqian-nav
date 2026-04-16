// 主应用逻辑
// 协调各个模块，处理用户交互和应用状态

const App = {
  isInitialized: false,
  currentBookmark: null,
  elements: {},

  async init() {
    try {
      this.bindElements();
      this.bindEvents();
      await BookmarkManager.init();
      this.isInitialized = true;
      console.log("应用初始化完成");
    } catch (error) {
      console.error("应用初始化失败:", error);
      this.showMessage(`应用初始化失败: ${error.message}`, "error");
    }
  },

  bindElements() {
    const selectors = {
      searchToggle: "searchToggle",
      searchContainer: "searchContainer",
      searchBtn: "searchBtn",
      clearSearchBtn: "clearSearchBtn",
      addBookmarkBtn: "addBookmarkBtn",
      bookmarkModal: "bookmarkModal",
      bookmarkForm: "bookmarkForm",
      modalTitle: "modalTitle",
      closeModalBtn: "closeModalBtn",
      cancelBtn: "cancelBtn",
      saveBtn: "saveBtn",
      bookmarkTitle: "bookmarkTitle",
      bookmarkUrl: "bookmarkUrl",
      bookmarkDescription: "bookmarkDescription",
      bookmarkCategory: "bookmarkCategory",
      toolsMenuToggle: "toolsMenuToggle",
      toolsDropdown: "toolsDropdown",
      settingsToggle: "settingsToggle",
      settingsPanel: "settingsPanel",
      settingsClose: "settingsClose",
      exportBtn: "exportBtn",
      fullBackupJSONBtn: "fullBackupJSONBtn",
      fullBackupHTMLBtn: "fullBackupHTMLBtn",
      importBtn: "importBtn",
      messageContainer: "messageContainer",
      messageText: "messageText",
    };

    this.elements = DOMHelper.getElements(selectors);
  },

  bindEvents() {
    this.elements.searchToggle?.addEventListener("click", () => {
      this.toggleSearch();
    });

    this.elements.clearSearchBtn?.addEventListener("click", () => {
      this.clearSearch();
    });

    this.elements.searchBtn?.addEventListener("click", () => {
      this.runSearch();
    });

    this.elements.addBookmarkBtn?.addEventListener("click", () => {
      this.showBookmarkModal();
    });

    this.elements.toolsMenuToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggleToolsMenu();
    });

    document.addEventListener("click", (event) => {
      if (
        !this.elements.toolsMenuToggle?.contains(event.target) &&
        !this.elements.toolsDropdown?.contains(event.target)
      ) {
        this.hideToolsMenu();
      }
    });

    this.elements.closeModalBtn?.addEventListener("click", () => {
      this.hideBookmarkModal();
    });

    this.elements.cancelBtn?.addEventListener("click", () => {
      this.hideBookmarkModal();
    });

    this.elements.bookmarkModal?.addEventListener("click", (event) => {
      if (event.target === this.elements.bookmarkModal) {
        this.hideBookmarkModal();
      }
    });

    this.elements.bookmarkForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveBookmark();
    });

    this.elements.settingsToggle?.addEventListener("click", () => {
      this.toggleSettings();
    });

    this.elements.settingsClose?.addEventListener("click", () => {
      this.hideSettings();
    });

    this.elements.exportBtn?.addEventListener("click", () => {
      this.exportBookmarks();
    });

    document.getElementById("exportJSONBtn")?.addEventListener("click", () => {
      this.exportBookmarksJSON();
    });

    this.elements.importBtn?.addEventListener("click", () => {
      this.importBookmarks();
    });

    this.elements.fullBackupJSONBtn?.addEventListener("click", () => {
      this.createFullBackup("json");
    });

    this.elements.fullBackupHTMLBtn?.addEventListener("click", () => {
      this.createFullBackup("html");
    });

    document.addEventListener("keydown", (event) => {
      this.handleKeyboardShortcuts(event);
    });
  },

  toggleSearch() {
    if (!this.elements.searchContainer) {
      return;
    }

    this.elements.searchContainer.classList.toggle("hidden");
    if (!this.elements.searchContainer.classList.contains("hidden")) {
      document.getElementById("searchInput")?.focus();
    }
  },

  clearSearch() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.focus();
    }
  },

  runSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) {
      return;
    }

    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
  },

  showBookmarkModal(bookmark = null) {
    this.currentBookmark = bookmark;

    if (bookmark) {
      this.elements.modalTitle.textContent = "编辑书签";
      this.elements.bookmarkTitle.value = bookmark.title || "";
      this.elements.bookmarkUrl.value = bookmark.url || "";
      this.elements.bookmarkDescription.value = bookmark.description || "";
    } else {
      this.elements.modalTitle.textContent = "添加书签";
      this.elements.bookmarkForm.reset();
    }

    this.loadCategoryOptions(bookmark?.category_id || "");
    this.elements.bookmarkModal?.classList.remove("hidden");
    this.elements.bookmarkTitle?.focus();
  },

  hideBookmarkModal() {
    this.elements.bookmarkModal?.classList.add("hidden");
    this.currentBookmark = null;
    this.elements.bookmarkForm?.reset();
  },

  async loadCategoryOptions(selectedCategoryId = "") {
    try {
      const response = await BookmarkAPI.getCategories();
      if (response.success && this.elements.bookmarkCategory) {
        const optionsHTML = response.data
          .map((category) => `<option value="${category.id}">${category.name}</option>`)
          .join("");

        this.elements.bookmarkCategory.innerHTML = `
          <option value="">无分类</option>
          ${optionsHTML}
        `;
        this.elements.bookmarkCategory.value = selectedCategoryId || "";
      }
    } catch (error) {
      console.error("加载分类选项失败:", error);
    }
  },

  async saveBookmark() {
    try {
      const formData = {
        title: this.elements.bookmarkTitle.value.trim(),
        url: this.elements.bookmarkUrl.value.trim(),
        description: this.elements.bookmarkDescription.value.trim(),
        category_id: this.elements.bookmarkCategory.value || null,
      };

      if (!formData.title || !formData.url) {
        this.showMessage("标题和 URL 是必填字段", "error");
        return;
      }

      let response;
      this.elements.saveBtn.disabled = true;
      this.elements.saveBtn.textContent = "保存中...";

      if (this.currentBookmark) {
        response = await BookmarkAPI.updateBookmark(this.currentBookmark.id, formData);
      } else {
        response = await BookmarkAPI.createBookmark(formData);
      }

      if (!response.success) {
        throw new Error(response.error || "保存失败");
      }

      this.showMessage(this.currentBookmark ? "书签更新成功" : "书签创建成功", "success");
      this.hideBookmarkModal();
      await BookmarkManager.refresh();
    } catch (error) {
      console.error("保存书签错误:", error);
      this.showMessage(error.message || "网络连接异常，请稍后重试", "error");
    } finally {
      if (this.elements.saveBtn) {
        this.elements.saveBtn.disabled = false;
        this.elements.saveBtn.textContent = "保存";
      }
    }
  },

  async editBookmark(bookmarkId) {
    try {
      const response = await BookmarkAPI.getBookmark(bookmarkId);
      if (!response.success) {
        throw new Error(response.error || "获取书签信息失败");
      }

      this.showBookmarkModal(response.data);
    } catch (error) {
      console.error("获取书签错误:", error);
      this.showMessage(error.message || "网络连接异常", "error");
    }
  },

  async deleteBookmark(bookmarkId) {
    const bookmark = BookmarkManager.bookmarks.find((item) => item.id == bookmarkId);
    const bookmarkTitle = bookmark ? bookmark.title : "该书签";

    if (!confirm(`确定要删除书签“${bookmarkTitle}”吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await BookmarkAPI.deleteBookmark(bookmarkId);
      if (!response.success) {
        throw new Error(response.error || "删除失败");
      }

      this.showMessage("书签删除成功", "success");
      await BookmarkManager.refresh();
    } catch (error) {
      console.error("删除书签错误:", error);
      this.showMessage(error.message || "网络连接异常，请稍后重试", "error");
    }
  },

  toggleToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;
    if (!dropdown || !toggle) {
      return;
    }

    const isVisible = dropdown.classList.contains("show");
    if (isVisible) {
      this.hideToolsMenu();
    } else {
      this.showToolsMenu();
    }
  },

  showToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;
    if (dropdown && toggle) {
      dropdown.classList.add("show");
      toggle.classList.add("active");
    }
  },

  hideToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;
    if (dropdown && toggle) {
      dropdown.classList.remove("show");
      toggle.classList.remove("active");
    }
  },

  toggleSettings() {
    if (!this.elements.settingsPanel) {
      return;
    }

    this.elements.settingsPanel.classList.toggle("hidden");
    this.hideToolsMenu();
  },

  hideSettings() {
    this.elements.settingsPanel?.classList.add("hidden");
  },

  async exportBookmarks() {
    this.executeExport("html");
  },

  async exportBookmarksJSON() {
    this.executeExport("json");
  },

  async executeExport(format) {
    try {
      this.showMessage("正在导出书签...", "info");
      const allBookmarks = await this.getAllBookmarksForExport();

      if (!allBookmarks.length) {
        this.showMessage("没有书签可以导出", "warning");
        return;
      }

      if (format === "html") {
        this.exportAsHTML(allBookmarks, BookmarkManager.categories);
      } else {
        this.exportAsJSON(allBookmarks, BookmarkManager.categories);
      }

      this.showMessage(`成功导出 ${allBookmarks.length} 个书签`, "success");
    } catch (error) {
      console.error("导出失败:", error);
      this.showMessage(`导出失败: ${error.message}`, "error");
    }
  },

  async getAllBookmarksForExport() {
    const allBookmarks = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const response = await BookmarkAPI.getBookmarks({ page, limit });
      if (!response.success) {
        throw new Error(response.error || "获取书签失败");
      }

      const bookmarks = response.data.bookmarks || [];
      allBookmarks.push(...bookmarks);

      if (bookmarks.length < limit) {
        break;
      }

      page += 1;
      this.showMessage(`正在获取书签... 已获取 ${allBookmarks.length} 个`, "info");
    }

    return allBookmarks;
  },

  exportAsHTML(bookmarks) {
    const now = new Date();
    const bookmarksByCategory = {};
    const uncategorized = [];

    bookmarks.forEach((bookmark) => {
      if (bookmark.category_name) {
        if (!bookmarksByCategory[bookmark.category_name]) {
          bookmarksByCategory[bookmark.category_name] = [];
        }
        bookmarksByCategory[bookmark.category_name].push(bookmark);
      } else {
        uncategorized.push(bookmark);
      }
    });

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${Math.floor(now.getTime() / 1000)}" LAST_MODIFIED="${Math.floor(now.getTime() / 1000)}">书签导航 - 导出于 ${now.toLocaleDateString()}</H3>
    <DL><p>
`;

    Object.keys(bookmarksByCategory).forEach((categoryName) => {
      html += `        <DT><H3 ADD_DATE="${Math.floor(now.getTime() / 1000)}" LAST_MODIFIED="${Math.floor(now.getTime() / 1000)}">${this.escapeHtml(categoryName)}</H3>\n`;
      html += "        <DL><p>\n";

      bookmarksByCategory[categoryName].forEach((bookmark) => {
        const addDate = Math.floor(new Date(bookmark.created_at).getTime() / 1000);
        html += `            <DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${addDate}"`;
        if (bookmark.favicon_url) {
          html += ` ICON="${this.escapeHtml(bookmark.favicon_url)}"`;
        }
        html += `>${this.escapeHtml(bookmark.title)}</A>\n`;
        if (bookmark.description) {
          html += `            <DD>${this.escapeHtml(bookmark.description)}\n`;
        }
      });

      html += "        </DL><p>\n";
    });

    if (uncategorized.length) {
      html += `        <DT><H3 ADD_DATE="${Math.floor(now.getTime() / 1000)}" LAST_MODIFIED="${Math.floor(now.getTime() / 1000)}">未分类</H3>\n`;
      html += "        <DL><p>\n";

      uncategorized.forEach((bookmark) => {
        const addDate = Math.floor(new Date(bookmark.created_at).getTime() / 1000);
        html += `            <DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${addDate}"`;
        if (bookmark.favicon_url) {
          html += ` ICON="${this.escapeHtml(bookmark.favicon_url)}"`;
        }
        html += `>${this.escapeHtml(bookmark.title)}</A>\n`;
        if (bookmark.description) {
          html += `            <DD>${this.escapeHtml(bookmark.description)}\n`;
        }
      });

      html += "        </DL><p>\n";
    }

    html += "    </DL><p>\n</DL><p>";

    this.downloadFile(
      html,
      `bookmarks-${new Date().toISOString().split("T")[0]}.html`,
      "text/html",
    );
  },

  exportAsJSON(bookmarks, categories) {
    const exportData = {
      bookmarks,
      categories,
      exportTime: new Date().toISOString(),
      version: "1.0.0",
      totalBookmarks: bookmarks.length,
      totalCategories: categories.length,
    };

    this.downloadFile(
      JSON.stringify(exportData, null, 2),
      `bookmarks-${new Date().toISOString().split("T")[0]}.json`,
      "application/json",
    );
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  importBookmarks() {
    window.location.href = "/import.html";
  },

  handleKeyboardShortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "k") {
      event.preventDefault();
      this.toggleSearch();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "n") {
      event.preventDefault();
      this.showBookmarkModal();
    }

    if (event.key === "Escape") {
      if (!this.elements.bookmarkModal?.classList.contains("hidden")) {
        this.hideBookmarkModal();
      } else if (!this.elements.settingsPanel?.classList.contains("hidden")) {
        this.hideSettings();
      } else if (this.elements.toolsDropdown?.classList.contains("show")) {
        this.hideToolsMenu();
      }
    }
  },

  showMessage(text, type = "info") {
    if (!this.elements.messageContainer || !this.elements.messageText) {
      return;
    }

    this.elements.messageText.textContent = text;
    this.elements.messageText.className = `message-text ${type}`;
    this.elements.messageContainer.classList.remove("hidden");

    const timeout = type === "error" ? 5000 : 3000;
    setTimeout(() => {
      this.elements.messageContainer?.classList.add("hidden");
    }, timeout);
  },

  async createFullBackup(format) {
    try {
      this.showMessage(`正在创建 ${format.toUpperCase()} 格式的完整备份...`, "info");
      const response = await SystemAPI.createBackup(format);
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `bookmarks-backup-${new Date().toISOString().split("T")[0]}.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.showMessage(`完整备份已下载: ${filename}`, "success");
    } catch (error) {
      console.error("创建备份失败:", error);
      this.showMessage(`备份失败: ${error.message}`, "error");
    }
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await App.init();
});

window.App = App;