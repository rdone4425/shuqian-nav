const BookmarkManagePage = {
  categories: [],
  bookmarks: [],
  selectedIds: new Set(),
  pagination: { page: 1, totalPages: 1, total: 0 },
  filters: { search: "", category: "" },
  elements: {},

  async init() {
    const authenticated = await AdminUI.requireAuth();
    if (!authenticated) return;

    this.bindElements();
    this.bindEvents();
    await this.loadCategories();
    await this.loadBookmarks();
  },

  bindElements() {
    this.elements = {
      search: document.getElementById("bookmarkSearch"),
      categoryFilter: document.getElementById("bookmarkCategoryFilter"),
      refresh: document.getElementById("refreshBookmarksBtn"),
      selectedCount: document.getElementById("selectedBookmarkCount"),
      bulkMoveCategory: document.getElementById("bulkMoveCategory"),
      bulkMoveBtn: document.getElementById("bulkMoveBtn"),
      bulkDeleteBtn: document.getElementById("bulkDeleteBtn"),
      selectAll: document.getElementById("selectAllBookmarks"),
      tableBody: document.getElementById("bookmarksManageBody"),
      pagination: document.getElementById("bookmarkPagination"),
      deleteModal: document.getElementById("deleteBookmarksModal"),
      deleteSummary: document.getElementById("deleteBookmarksSummary"),
      closeDeleteModal: document.getElementById("closeDeleteBookmarksModal"),
      cancelDelete: document.getElementById("cancelDeleteBookmarksBtn"),
      confirmDelete: document.getElementById("confirmDeleteBookmarksBtn"),
    };
  },

  bindEvents() {
    this.elements.search?.addEventListener(
      "input",
      this.debounce(() => {
        this.filters.search = this.elements.search.value.trim();
        this.pagination.page = 1;
        this.loadBookmarks();
      }, 250),
    );

    this.elements.categoryFilter?.addEventListener("change", () => {
      this.filters.category = this.elements.categoryFilter.value;
      this.pagination.page = 1;
      this.loadBookmarks();
    });

    this.elements.refresh?.addEventListener("click", () =>
      this.loadBookmarks(),
    );
    this.elements.bulkMoveBtn?.addEventListener("click", () =>
      this.bulkMoveSelected(),
    );
    this.elements.bulkDeleteBtn?.addEventListener("click", () =>
      this.openDeleteBookmarksModal(),
    );

    this.elements.closeDeleteModal?.addEventListener("click", () =>
      this.closeDeleteBookmarksModal(),
    );
    this.elements.cancelDelete?.addEventListener("click", () =>
      this.closeDeleteBookmarksModal(),
    );
    this.elements.deleteModal?.addEventListener("click", (event) => {
      if (event.target === this.elements.deleteModal) {
        this.closeDeleteBookmarksModal();
      }
    });
    this.elements.confirmDelete?.addEventListener("click", () =>
      this.confirmDeleteSelected(),
    );

    this.elements.selectAll?.addEventListener("change", () => {
      if (this.elements.selectAll.checked) {
        this.bookmarks.forEach((bookmark) => this.selectedIds.add(bookmark.id));
      } else {
        this.bookmarks.forEach((bookmark) =>
          this.selectedIds.delete(bookmark.id),
        );
      }
      this.renderBookmarks();
      this.updateSelectionState();
    });

    this.elements.tableBody?.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-bookmark-check]");
      if (checkbox) {
        const id = Number(checkbox.dataset.bookmarkCheck);
        if (checkbox.checked) this.selectedIds.add(id);
        else this.selectedIds.delete(id);
        this.updateSelectionState();
        return;
      }

      const select = event.target.closest("[data-move-bookmark]");
      if (select) {
        this.moveSingleBookmark(
          Number(select.dataset.moveBookmark),
          select.value,
        );
      }
    });

    this.elements.pagination?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button) return;
      this.pagination.page = Number(button.dataset.page);
      this.loadBookmarks();
    });
  },

  debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  async loadCategories() {
    const response = await BookmarkAPI.getCategories();
    if (!response.success) {
      throw new Error(response.error || "加载分类失败");
    }
    this.categories = response.data || [];
    this.renderCategoryControls();
  },

  async loadBookmarks() {
    this.elements.tableBody.innerHTML =
      '<tr><td colspan="5" class="management-empty">正在加载书签...</td></tr>';
    try {
      const response = await BookmarkAPI.getBookmarks({
        page: this.pagination.page,
        limit: 30,
        search: this.filters.search,
        category: this.filters.category,
        sortBy: "updated_at",
        sortOrder: "desc",
      });
      if (!response.success) {
        throw new Error(response.error || "加载书签失败");
      }
      this.bookmarks = response.data.bookmarks || [];
      this.pagination = response.data.pagination || this.pagination;
      this.renderBookmarks();
      this.renderPagination();
      this.updateSelectionState();
    } catch (error) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="5" class="management-empty danger-text">${AdminUI.escapeHtml(error.message)}</td></tr>`;
    }
  },

  renderCategoryControls() {
    const options = this.renderCategoryOptions("全部分类", true);
    this.elements.categoryFilter.innerHTML = options;
    this.elements.bulkMoveCategory.innerHTML = this.renderCategoryOptions(
      "移动到未分类",
      true,
    );
  },

  renderCategoryOptions(emptyLabel, includeEmpty) {
    const empty = includeEmpty ? `<option value="">${emptyLabel}</option>` : "";
    return `${empty}${this.categories
      .map(
        (category) =>
          `<option value="${category.id}">${AdminUI.escapeHtml(category.name)}</option>`,
      )
      .join("")}`;
  },

  renderBookmarks() {
    if (!this.bookmarks.length) {
      this.elements.tableBody.innerHTML =
        '<tr><td colspan="5" class="management-empty">没有找到书签</td></tr>';
      return;
    }

    this.elements.tableBody.innerHTML = this.bookmarks
      .map((bookmark) => {
        const categoryName = bookmark.category_name || "未分类";
        const categoryColor = bookmark.category_color || "#A6AFBD";
        return `
          <tr>
            <td>
              <input type="checkbox" data-bookmark-check="${bookmark.id}" ${this.selectedIds.has(bookmark.id) ? "checked" : ""} />
            </td>
            <td>
              <div class="row-title">
                <strong>${AdminUI.escapeHtml(bookmark.title || "未命名书签")}</strong>
                <a class="row-url" href="${AdminUI.escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer">${AdminUI.escapeHtml(bookmark.url)}</a>
              </div>
            </td>
            <td>
              <span class="category-pill">
                <span class="color-swatch" style="background:${AdminUI.escapeHtml(categoryColor)}"></span>
                ${AdminUI.escapeHtml(categoryName)}
              </span>
            </td>
            <td>
              <select class="management-select" data-move-bookmark="${bookmark.id}">
                ${this.renderCategoryOptions("未分类", true)}
              </select>
            </td>
            <td>${AdminUI.escapeHtml(AdminUI.formatDate(bookmark.updated_at || bookmark.created_at))}</td>
          </tr>
        `;
      })
      .join("");

    this.bookmarks.forEach((bookmark) => {
      const select = this.elements.tableBody.querySelector(
        `[data-move-bookmark="${bookmark.id}"]`,
      );
      if (select) select.value = bookmark.category_id || "";
    });
  },

  renderPagination() {
    const { page = 1, totalPages = 1, total = 0 } = this.pagination;
    if (totalPages <= 1) {
      this.elements.pagination.innerHTML = `<span class="selection-note">共 ${total} 条</span>`;
      return;
    }

    this.elements.pagination.innerHTML = `
      <button class="btn btn-secondary" type="button" data-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""}>上一页</button>
      <span class="selection-note">第 ${page} / ${totalPages} 页，共 ${total} 条</span>
      <button class="btn btn-secondary" type="button" data-page="${Math.min(totalPages, page + 1)}" ${page >= totalPages ? "disabled" : ""}>下一页</button>
    `;
  },

  updateSelectionState() {
    const selectedCount = this.selectedIds.size;
    this.elements.selectedCount.textContent = `已选择 ${selectedCount} 条`;
    this.elements.bulkMoveBtn.disabled = selectedCount === 0;
    if (this.elements.bulkDeleteBtn) {
      this.elements.bulkDeleteBtn.disabled = selectedCount === 0;
    }
    if (this.elements.selectAll) {
      this.elements.selectAll.checked =
        this.bookmarks.length > 0 &&
        this.bookmarks.every((bookmark) => this.selectedIds.has(bookmark.id));
    }
  },

  async moveSingleBookmark(id, categoryId) {
    const bookmark = this.bookmarks.find((item) => Number(item.id) === id);
    if (!bookmark) return;

    try {
      const response = await BookmarkAPI.updateBookmark(id, {
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description || "",
        category_id: categoryId || null,
      });
      if (!response.success) {
        throw new Error(response.error || "移动书签失败");
      }
      AdminUI.showToast("书签已移动");
      await this.loadBookmarks();
    } catch (error) {
      AdminUI.showToast(error.message || "移动书签失败", "error");
      this.renderBookmarks();
    }
  },

  async bulkMoveSelected() {
    const ids = [...this.selectedIds];
    if (!ids.length) return;

    try {
      const response = await BookmarkAPI.batchMoveBookmarks(
        ids,
        this.elements.bulkMoveCategory.value || null,
      );
      if (!response.success) {
        throw new Error(response.error || "批量移动失败");
      }
      AdminUI.showToast(
        `已移动 ${response.data?.movedCount || ids.length} 条书签`,
      );
      this.selectedIds.clear();
      await this.loadBookmarks();
    } catch (error) {
      AdminUI.showToast(error.message || "批量移动失败", "error");
    }
  },

  openDeleteBookmarksModal() {
    const selectedCount = this.selectedIds.size;
    if (!selectedCount) return;

    if (this.elements.deleteSummary) {
      this.elements.deleteSummary.textContent = `将删除 ${selectedCount} 条书签。这个操作不会清空全部数据，只处理当前选中的书签。`;
    }

    this.elements.deleteModal?.classList.remove("hidden");
    this.elements.confirmDelete?.focus();
  },

  closeDeleteBookmarksModal() {
    this.elements.deleteModal?.classList.add("hidden");
  },

  async confirmDeleteSelected() {
    const ids = [...this.selectedIds];
    if (!ids.length) {
      this.closeDeleteBookmarksModal();
      return;
    }

    const button = this.elements.confirmDelete;
    const previousText = button?.textContent;

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "删除中...";
      }

      const response = await BookmarkAPI.batchDeleteBookmarks(ids);
      if (!response.success) {
        throw new Error(response.error || "批量删除失败");
      }

      AdminUI.showToast(
        `已删除 ${response.data?.deletedCount || ids.length} 条书签`,
      );
      this.selectedIds.clear();
      this.closeDeleteBookmarksModal();
      await this.loadBookmarks();
    } catch (error) {
      AdminUI.showToast(error.message || "批量删除失败", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText || "确认删除";
      }
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  BookmarkManagePage.init();
});

window.BookmarkManagePage = BookmarkManagePage;
