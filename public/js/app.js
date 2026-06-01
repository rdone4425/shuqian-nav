const App = {
  isInitialized: false,
  currentBookmark: null,
  elements: {},

  async init() {
    try {
      if (window.Auth) {
        await Auth.init({ requireAuth: false });
      }

      this.bindElements();
      this.bindEvents();
      await BookmarkManager.init();
      this.openRequestedPanel();
      this.isInitialized = true;
      console.log("应用初始化完成");
    } catch (error) {
      console.error("应用初始化失败", error);
      this.showMessage(
        `${this.t("messages.appInitFailed")}：${error.message}`,
        "error",
      );
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
      quickCreateCategoryBtn: "quickCreateCategoryBtn",
      quickCategoryForm: "quickCategoryForm",
      quickCategoryName: "quickCategoryName",
      quickCategoryColor: "quickCategoryColor",
      confirmQuickCategoryBtn: "confirmQuickCategoryBtn",
      cancelQuickCategoryBtn: "cancelQuickCategoryBtn",
      toolsMenuToggle: "toolsMenuToggle",
      toolsDropdown: "toolsDropdown",
      settingsToggle: "settingsToggle",
      settingsPanel: "settingsPanel",
      settingsClose: "settingsClose",
      exportBtn: "exportBtn",
      fullBackupJSONBtn: "fullBackupJSONBtn",
      fullBackupHTMLBtn: "fullBackupHTMLBtn",
      importBtn: "importBtn",
      changePasswordForm: "changePasswordForm",
      currentPassword: "currentPassword",
      newPassword: "newPassword",
      confirmPassword: "confirmPassword",
      changePasswordBtn: "changePasswordBtn",
      messageContainer: "messageContainer",
      messageText: "messageText",
    };

    this.elements = DOMHelper.getElements(selectors);
  },

  bindEvents() {
    this.elements.searchToggle?.addEventListener("click", () => {
      this.focusSearch();
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

    const siteMenuManaged =
      window.SiteMenu ||
      this.elements.toolsMenuToggle?.dataset.siteMenuBound === "true";

    if (!siteMenuManaged) {
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
    }

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

    this.elements.quickCreateCategoryBtn?.addEventListener("click", () => {
      this.showQuickCategoryForm();
    });

    this.elements.cancelQuickCategoryBtn?.addEventListener("click", () => {
      this.hideQuickCategoryForm();
    });

    this.elements.confirmQuickCategoryBtn?.addEventListener("click", () => {
      this.createCategoryFromModal();
    });

    this.elements.quickCategoryName?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.createCategoryFromModal();
      }
    });

    if (!siteMenuManaged) {
      this.elements.settingsToggle?.addEventListener("click", () => {
        this.toggleSettings();
      });
    }

    document
      .getElementById("settingsInlineToggle")
      ?.addEventListener("click", () => {
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

    this.elements.changePasswordForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.changePassword();
    });

    this.elements.fullBackupJSONBtn?.addEventListener("click", () => {
      this.createFullBackup("json");
    });

    this.elements.fullBackupHTMLBtn?.addEventListener("click", () => {
      this.createFullBackup("html");
    });

    if (!siteMenuManaged) {
      document.getElementById("logoutBtn")?.addEventListener("click", () => {
        window.Auth?.logout?.({ redirect: true });
      });
    }

    document.addEventListener("keydown", (event) => {
      this.handleKeyboardShortcuts(event);
    });
  },

  t(key, params = {}) {
    return window.I18n?.t(key, params) || key;
  },

  requireAdminAction() {
    if (!window.Auth || window.Auth.isAuthenticated) {
      return true;
    }

    this.showMessage("请先登录后台再进行管理操作。", "warning");
    window.Auth.redirectToLogin?.();
    return false;
  },

  focusSearch() {
    this.elements.searchContainer?.classList.remove("hidden");
    document.getElementById("searchInput")?.focus();
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
    if (!this.requireAdminAction()) {
      return;
    }

    this.currentBookmark = bookmark;

    if (bookmark) {
      this.elements.modalTitle.textContent = this.t("bookmarkModal.editTitle");
      this.elements.bookmarkTitle.value = bookmark.title || "";
      this.elements.bookmarkUrl.value = bookmark.url || "";
      this.elements.bookmarkDescription.value = bookmark.description || "";
    } else {
      this.elements.modalTitle.textContent = this.t("bookmarkModal.addTitle");
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
    this.hideQuickCategoryForm();
  },

  async loadCategoryOptions(selectedCategoryId = "") {
    try {
      if (!BookmarkManager.categories.length) {
        await BookmarkManager.loadCategories();
      }

      if (this.elements.bookmarkCategory) {
        const optionsHTML = BookmarkManager.categories
          .map(
            (category) =>
              `<option value="${category.id}">${this.escapeHtml(category.name)}</option>`,
          )
          .join("");

        this.elements.bookmarkCategory.innerHTML = `
          <option value="">${this.t("bookmarkModal.noCategory")}</option>
          ${optionsHTML}
        `;
        this.elements.bookmarkCategory.value = selectedCategoryId || "";
      }
    } catch (error) {
      console.error("加载分类选项失败:", error);
    }
  },

  showQuickCategoryForm() {
    this.elements.quickCategoryForm?.classList.remove("hidden");
    if (this.elements.quickCategoryColor) {
      this.elements.quickCategoryColor.value = "#3B82F6";
    }
    this.elements.quickCategoryName?.focus();
  },

  hideQuickCategoryForm() {
    this.elements.quickCategoryForm?.classList.add("hidden");
    if (this.elements.quickCategoryName) {
      this.elements.quickCategoryName.value = "";
    }
    if (this.elements.quickCategoryColor) {
      this.elements.quickCategoryColor.value = "#3B82F6";
    }
  },

  async createCategoryFromModal() {
    if (!this.requireAdminAction()) {
      return;
    }

    const name = this.elements.quickCategoryName?.value.trim();
    if (!name) {
      this.showMessage("请填写分类名称", "error");
      this.elements.quickCategoryName?.focus();
      return;
    }

    const button = this.elements.confirmQuickCategoryBtn;
    const previousText = button?.textContent;

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "创建中...";
      }

      const response = await BookmarkAPI.createCategory({
        name,
        color: this.elements.quickCategoryColor?.value || "#3B82F6",
        description: "",
      });

      if (!response.success) {
        throw new Error(response.error || "创建分类失败");
      }

      const category = response.data;
      await BookmarkManager.loadCategories();
      BookmarkManager.renderCategoryFilter();
      BookmarkManager.renderCategoryRail();
      await this.loadCategoryOptions(category?.id || "");
      this.hideQuickCategoryForm();
      this.showMessage("分类已创建", "success");
    } catch (error) {
      console.error("创建分类失败:", error);
      this.showMessage(error.message || "创建分类失败", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText || "创建";
      }
    }
  },

  async saveBookmark() {
    if (!this.requireAdminAction()) {
      return;
    }

    try {
      const formData = {
        title: this.elements.bookmarkTitle.value.trim(),
        url: this.elements.bookmarkUrl.value.trim(),
        description: this.elements.bookmarkDescription.value.trim(),
        category_id: this.elements.bookmarkCategory.value || null,
      };

      if (!formData.title || !formData.url) {
        this.showMessage(this.t("messages.titleUrlRequired"), "error");
        return;
      }

      let response;
      this.elements.saveBtn.disabled = true;
      this.elements.saveBtn.textContent = this.t("bookmarkModal.saving");

      if (this.currentBookmark) {
        response = await BookmarkAPI.updateBookmark(
          this.currentBookmark.id,
          formData,
        );
      } else {
        response = await BookmarkAPI.createBookmark(formData);
      }

      if (!response.success) {
        throw new Error(response.error || this.t("messages.saveFailed"));
      }

      this.showMessage(
        this.currentBookmark
          ? this.t("messages.bookmarkUpdated")
          : this.t("messages.bookmarkCreated"),
        "success",
      );
      this.hideBookmarkModal();
      await BookmarkManager.refresh();
    } catch (error) {
      console.error("保存站点错误:", error);
      this.showMessage(
        error.message || this.t("messages.networkError"),
        "error",
      );
    } finally {
      if (this.elements.saveBtn) {
        this.elements.saveBtn.disabled = false;
        this.elements.saveBtn.textContent = this.t("bookmarkModal.saveBtn");
      }
    }
  },

  async editBookmark(bookmarkId) {
    if (!this.requireAdminAction()) {
      return;
    }

    try {
      const response = await BookmarkAPI.getBookmark(bookmarkId);
      if (!response.success) {
        throw new Error(response.error || this.t("messages.getBookmarkFailed"));
      }

      this.showBookmarkModal(response.data);
    } catch (error) {
      console.error("获取站点错误:", error);
      this.showMessage(
        error.message || this.t("messages.networkError"),
        "error",
      );
    }
  },

  async deleteBookmark(bookmarkId) {
    if (!this.requireAdminAction()) {
      return;
    }

    const bookmark = BookmarkManager.bookmarks.find(
      (item) => String(item.id) === String(bookmarkId),
    );
    const bookmarkTitle = bookmark
      ? bookmark.title
      : this.t("bookmarkCard.untitled");

    if (!confirm(this.t("messages.confirmDelete", { title: bookmarkTitle }))) {
      return;
    }

    try {
      const response = await BookmarkAPI.deleteBookmark(bookmarkId);
      if (!response.success) {
        throw new Error(response.error || this.t("messages.deleteFailed"));
      }

      this.showMessage(this.t("messages.bookmarkDeleted"), "success");
      await BookmarkManager.refresh();
    } catch (error) {
      console.error("删除站点错误:", error);
      this.showMessage(
        error.message || this.t("messages.networkError"),
        "error",
      );
    }
  },

  toggleToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    if (!dropdown) {
      return;
    }

    if (dropdown.classList.contains("show")) {
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
      toggle.setAttribute("aria-expanded", "true");
    }
  },

  hideToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;
    if (dropdown && toggle) {
      dropdown.classList.remove("show");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
    }
  },

  toggleSettings() {
    if (!this.requireAdminAction()) {
      return;
    }

    if (!this.elements.settingsPanel) {
      return;
    }

    this.elements.settingsPanel.classList.toggle("hidden");
    this.hideToolsMenu();
  },

  hideSettings() {
    this.elements.settingsPanel?.classList.add("hidden");
  },

  openRequestedPanel() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "bookmark") {
      this.showBookmarkModal();
      if (window.Auth?.isAuthenticated) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      return;
    }

    if (params.get("settings") !== "security") {
      return;
    }

    if (!this.requireAdminAction()) {
      return;
    }

    this.elements.settingsPanel?.classList.remove("hidden");
    this.elements.currentPassword?.focus();
  },

  async exportBookmarks() {
    this.executeExport("html");
  },

  async exportBookmarksJSON() {
    this.executeExport("json");
  },

  async executeExport(format) {
    if (!this.requireAdminAction()) {
      return;
    }

    try {
      this.showMessage(this.t("messages.exportPreparing"), "info");
      const allBookmarks = await this.getAllBookmarksForExport();

      if (!allBookmarks.length) {
        this.showMessage(this.t("messages.exportEmpty"), "warning");
        return;
      }

      if (format === "html") {
        this.exportAsHTML(allBookmarks);
      } else {
        this.exportAsJSON(allBookmarks, BookmarkManager.categories);
      }

      this.showMessage(
        this.t("messages.exportSuccess", { count: allBookmarks.length }),
        "success",
      );
    } catch (error) {
      console.error("导出失败:", error);
      this.showMessage(
        `${this.t("messages.exportFailed")}：${error.message}`,
        "error",
      );
    }
  },

  async getAllBookmarksForExport() {
    const allBookmarks = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const response = await BookmarkAPI.getBookmarks({ page, limit });
      if (!response.success) {
        throw new Error(
          response.error || this.t("messages.loadBookmarksFailed"),
        );
      }

      const bookmarks = response.data.bookmarks || [];
      allBookmarks.push(...bookmarks);

      if (bookmarks.length < limit) {
        break;
      }

      page += 1;
      this.showMessage(
        this.t("messages.exportFetching", { count: allBookmarks.length }),
        "info",
      );
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

    const timestamp = Math.floor(now.getTime() / 1000);
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">书签导航 - ${now.toLocaleDateString()}</H3>
    <DL><p>
`;

    Object.keys(bookmarksByCategory).forEach((categoryName) => {
      html += `        <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${this.escapeHtml(categoryName)}</H3>\n`;
      html += "        <DL><p>\n";

      bookmarksByCategory[categoryName].forEach((bookmark) => {
        html += this.createBookmarkExportLine(bookmark);
      });

      html += "        </DL><p>\n";
    });

    if (uncategorized.length) {
      html += `        <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${this.t("bookmarkCard.uncategorized")}</H3>\n`;
      html += "        <DL><p>\n";
      uncategorized.forEach((bookmark) => {
        html += this.createBookmarkExportLine(bookmark);
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

  createBookmarkExportLine(bookmark) {
    const addDate = Math.floor(new Date(bookmark.created_at).getTime() / 1000);
    const safeAddDate = Number.isFinite(addDate)
      ? addDate
      : Math.floor(Date.now() / 1000);
    let html = `            <DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${safeAddDate}"`;
    if (bookmark.favicon_url) {
      html += ` ICON="${this.escapeHtml(bookmark.favicon_url)}"`;
    }
    html += `>${this.escapeHtml(bookmark.title)}</A>\n`;
    if (bookmark.description) {
      html += `            <DD>${this.escapeHtml(bookmark.description)}\n`;
    }
    return html;
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

  escapeHtml(text = "") {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  importBookmarks() {
    if (!this.requireAdminAction()) {
      return;
    }

    window.location.href = "/import.html";
  },

  async changePassword() {
    if (!this.requireAdminAction()) {
      return;
    }

    const currentPassword = this.elements.currentPassword?.value || "";
    const newPassword = this.elements.newPassword?.value || "";
    const confirmPassword = this.elements.confirmPassword?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.showMessage("请填写完整的密码信息。", "error");
      return;
    }

    if (newPassword.length < 6) {
      this.showMessage("新密码至少需要 6 位。", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showMessage("两次输入的新密码不一致。", "error");
      return;
    }

    const button = this.elements.changePasswordBtn;
    const previousText = button?.textContent || "修改密码";

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "正在修改...";
      }

      const response = await API.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });

      if (!response.success) {
        throw new Error(response.error || "修改密码失败");
      }

      this.elements.changePasswordForm?.reset();
      this.showMessage("密码已修改，请使用新密码重新登录。", "success");
      window.Auth?.logout?.({ redirect: true });
    } catch (error) {
      this.showMessage(`修改密码失败：${error.message}`, "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText;
      }
    }
  },

  handleKeyboardShortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.focusSearch();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      if (!this.requireAdminAction()) {
        return;
      }
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
    if (!this.requireAdminAction()) {
      return;
    }

    try {
      this.showMessage(
        this.t("messages.backupPreparing", { format: format.toUpperCase() }),
        "info",
      );
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
      this.showMessage(
        this.t("messages.backupSuccess", { filename }),
        "success",
      );
    } catch (error) {
      console.error("创建备份失败:", error);
      this.showMessage(
        `${this.t("messages.backupFailed")}：${error.message}`,
        "error",
      );
    }
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await App.init();
});

window.App = App;
