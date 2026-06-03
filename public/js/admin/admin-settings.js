const AdminSettingsPage = {
  elements: {},

  async init() {
    const authenticated = await AdminUI.requireAuth();
    if (!authenticated) return;

    this.bindElements();
    this.bindEvents();
  },

  bindElements() {
    this.elements = {
      exportHtml: document.getElementById("exportHtmlBtn"),
      exportJson: document.getElementById("exportJsonBtn"),
      backupJson: document.getElementById("backupJsonBtn"),
      backupHtml: document.getElementById("backupHtmlBtn"),
      dataStatus: document.getElementById("dataActionStatus"),
      passwordForm: document.getElementById("changePasswordForm"),
      currentPassword: document.getElementById("currentPassword"),
      newPassword: document.getElementById("newPassword"),
      confirmPassword: document.getElementById("confirmPassword"),
      changePassword: document.getElementById("changePasswordBtn"),
      passwordStatus: document.getElementById("passwordStatus"),
    };
  },

  bindEvents() {
    this.elements.exportHtml?.addEventListener("click", () =>
      this.exportBookmarks("html"),
    );
    this.elements.exportJson?.addEventListener("click", () =>
      this.exportBookmarks("json"),
    );
    this.elements.backupJson?.addEventListener("click", () =>
      this.createFullBackup("json"),
    );
    this.elements.backupHtml?.addEventListener("click", () =>
      this.createFullBackup("html"),
    );
    this.elements.passwordForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.changePassword();
    });
  },

  setDataStatus(message, type = "info") {
    if (this.elements.dataStatus) {
      this.elements.dataStatus.textContent = message;
      this.elements.dataStatus.dataset.status = type;
    }
    AdminUI.showToast(message, type === "error" ? "error" : "success");
  },

  setPasswordStatus(message, type = "info") {
    if (this.elements.passwordStatus) {
      this.elements.passwordStatus.textContent = message;
      this.elements.passwordStatus.dataset.status = type;
    }
  },

  async exportBookmarks(format) {
    try {
      this.setDataStatus("正在准备导出...", "info");
      const [bookmarks, categories] = await Promise.all([
        this.getAllBookmarksForExport(),
        BookmarkAPI.getCategories(),
      ]);

      if (!bookmarks.length) {
        this.setDataStatus("没有书签可以导出。", "error");
        return;
      }

      if (format === "html") {
        this.exportAsHTML(bookmarks);
      } else {
        this.exportAsJSON(bookmarks, categories.data || []);
      }

      this.setDataStatus(`已导出 ${bookmarks.length} 条书签。`, "success");
    } catch (error) {
      console.error("Export failed:", error);
      this.setDataStatus(`导出失败：${error.message}`, "error");
    }
  },

  async getAllBookmarksForExport() {
    const allBookmarks = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const response = await BookmarkAPI.getBookmarks({ page, limit });
      if (!response.success) {
        throw new Error(response.error || "加载书签失败");
      }

      const bookmarks = response.data.bookmarks || [];
      allBookmarks.push(...bookmarks);

      if (bookmarks.length < limit) {
        break;
      }

      page += 1;
      this.setDataStatus(`正在读取书签，已获取 ${allBookmarks.length} 条...`);
    }

    return allBookmarks;
  },

  exportAsHTML(bookmarks) {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const bookmarksByCategory = {};
    const uncategorized = [];

    bookmarks.forEach((bookmark) => {
      if (bookmark.category_name) {
        bookmarksByCategory[bookmark.category_name] ||= [];
        bookmarksByCategory[bookmark.category_name].push(bookmark);
      } else {
        uncategorized.push(bookmark);
      }
    });

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
      html += `        <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">未分类</H3>\n`;
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
    this.downloadFile(
      JSON.stringify(
        {
          bookmarks,
          categories,
          exportTime: new Date().toISOString(),
          version: "1.0.0",
          totalBookmarks: bookmarks.length,
          totalCategories: categories.length,
        },
        null,
        2,
      ),
      `bookmarks-${new Date().toISOString().split("T")[0]}.json`,
      "application/json",
    );
  },

  async createFullBackup(format) {
    try {
      this.setDataStatus(`正在创建 ${format.toUpperCase()} 完整备份...`);
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
      this.downloadBlob(blob, filename);
      this.setDataStatus(`完整备份已下载：${filename}`, "success");
    } catch (error) {
      console.error("Backup failed:", error);
      this.setDataStatus(`备份失败：${error.message}`, "error");
    }
  },

  async changePassword() {
    const currentPassword = this.elements.currentPassword?.value || "";
    const newPassword = this.elements.newPassword?.value || "";
    const confirmPassword = this.elements.confirmPassword?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.setPasswordStatus("请填写完整的密码信息。", "error");
      return;
    }

    if (newPassword.length < 6) {
      this.setPasswordStatus("新密码至少需要 6 位。", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      this.setPasswordStatus("两次输入的新密码不一致。", "error");
      return;
    }

    const button = this.elements.changePassword;
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

      this.elements.passwordForm?.reset();
      this.setPasswordStatus("密码已修改，请使用新密码重新登录。", "success");
      AdminUI.showToast("密码已修改，请重新登录。", "success");
      window.Auth?.logout?.({ redirect: true });
    } catch (error) {
      this.setPasswordStatus(`修改密码失败：${error.message}`, "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText;
      }
    }
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  escapeHtml(value = "") {
    return AdminUI.escapeHtml(value);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  AdminSettingsPage.init();
});

window.AdminSettingsPage = AdminSettingsPage;
