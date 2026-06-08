const CategoryManagerPage = {
  categories: [],
  filters: { search: "" },
  elements: {},
  pendingDeleteCategory: null,

  async init() {
    const authenticated = await AdminUI.requireAuth();
    if (!authenticated) return;

    this.bindElements();
    this.bindEvents();
    await this.loadCategories();
  },

  bindElements() {
    this.elements = {
      form: document.getElementById("categoryForm"),
      id: document.getElementById("categoryId"),
      name: document.getElementById("categoryName"),
      color: document.getElementById("categoryColor"),
      parent: document.getElementById("categoryParent"),
      description: document.getElementById("categoryDescription"),
      save: document.getElementById("saveCategoryBtn"),
      reset: document.getElementById("resetCategoryBtn"),
      search: document.getElementById("categorySearch"),
      totalCount: document.getElementById("categoryTotalCount"),
      bookmarkTotal: document.getElementById("categoryBookmarkTotal"),
      visibleCount: document.getElementById("categoryVisibleCount"),
      tableBody: document.getElementById("categoriesTableBody"),
      deleteModal: document.getElementById("deleteCategoryModal"),
      deleteSummary: document.getElementById("deleteCategorySummary"),
      deleteTarget: document.getElementById("deleteCategoryTarget"),
      closeDeleteModal: document.getElementById("closeDeleteCategoryModal"),
      cancelDelete: document.getElementById("cancelDeleteCategoryBtn"),
      confirmDelete: document.getElementById("confirmDeleteCategoryBtn"),
    };
  },

  bindEvents() {
    this.elements.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveCategory();
    });

    this.elements.reset?.addEventListener("click", () => this.resetForm());

    this.elements.search?.addEventListener("input", () => {
      this.filters.search = this.elements.search.value.trim().toLowerCase();
      this.renderCategories();
    });

    this.elements.tableBody?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-id]");
      if (editButton) {
        this.startEdit(editButton.dataset.editId);
        return;
      }

      const deleteButton = event.target.closest("[data-delete-id]");
      if (deleteButton) {
        this.openDeleteCategoryModal(deleteButton.dataset.deleteId);
      }
    });

    this.elements.closeDeleteModal?.addEventListener("click", () =>
      this.closeDeleteCategoryModal(),
    );
    this.elements.cancelDelete?.addEventListener("click", () =>
      this.closeDeleteCategoryModal(),
    );
    this.elements.deleteModal?.addEventListener("click", (event) => {
      if (event.target === this.elements.deleteModal) {
        this.closeDeleteCategoryModal();
      }
    });
    this.elements.confirmDelete?.addEventListener("click", () =>
      this.confirmDeleteCategory(),
    );
  },

  async loadCategories() {
    this.elements.tableBody.innerHTML =
      '<tr><td colspan="6" class="management-empty">正在加载分类...</td></tr>';

    try {
      const response = await BookmarkAPI.getCategories();
      if (!response.success) {
        throw new Error(response.error || "加载分类失败");
      }
      this.categories = response.data || [];
      this.updateSummary(this.categories.length);
      this.renderParentOptions();
      this.renderCategories();
    } catch (error) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="6" class="management-empty danger-text">${AdminUI.escapeHtml(error.message)}</td></tr>`;
    }
  },

  renderCategories() {
    if (!this.categories.length) {
      this.elements.tableBody.innerHTML =
        '<tr><td colspan="6" class="management-empty">还没有分类</td></tr>';
      this.updateSummary(0);
      return;
    }

    const visibleCategories = this.getVisibleCategories();
    this.updateSummary(visibleCategories.length);

    if (!visibleCategories.length) {
      this.elements.tableBody.innerHTML =
        '<tr><td colspan="6" class="management-empty">没有匹配的分类</td></tr>';
      return;
    }

    this.elements.tableBody.innerHTML = visibleCategories
      .map((category) => {
        const color = AdminUI.escapeHtml(category.color || "#3B82F6");
        const count = Number(category.bookmark_count || 0);
        const isChild = Boolean(category.parent_id);
        const parentName = category.parent_name || "一级分类";
        const displayName = category.display_name || category.name;
        return `
          <tr>
            <td>
              <span class="category-pill">
                <span class="color-swatch" style="background:${color}"></span>
                ${isChild ? "└ " : ""}${AdminUI.escapeHtml(displayName)}
              </span>
            </td>
            <td class="muted-text">${AdminUI.escapeHtml(parentName)}</td>
            <td class="muted-text">${AdminUI.escapeHtml(category.description || "-")}</td>
            <td>${count}</td>
            <td>${AdminUI.escapeHtml(AdminUI.formatDate(category.updated_at || category.created_at))}</td>
            <td>
              <div class="inline-actions">
                <button class="btn btn-secondary" type="button" data-edit-id="${category.id}">编辑</button>
                <button class="btn btn-danger" type="button" data-delete-id="${category.id}">删除</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  },

  getVisibleCategories() {
    const query = this.filters.search;
    if (!query) return this.categories;

    return this.categories.filter((category) => {
      const text = `${category.name || ""} ${category.display_name || ""} ${category.parent_name || ""} ${category.description || ""}`;
      return text.toLowerCase().includes(query);
    });
  },

  renderParentOptions(currentId = this.elements.id?.value || "") {
    if (!this.elements.parent) return;

    const childParentIds = new Set(
      this.categories
        .filter((category) => category.parent_id)
        .map((category) => String(category.parent_id)),
    );
    const currentHasChildren =
      currentId && childParentIds.has(String(currentId));
    const rootCategories = this.categories.filter(
      (category) =>
        !category.parent_id &&
        String(category.id) !== String(currentId) &&
        !currentHasChildren,
    );
    const options = rootCategories
      .map(
        (category) =>
          `<option value="${AdminUI.escapeHtml(String(category.id))}">${AdminUI.escapeHtml(category.name)}</option>`,
      )
      .join("");

    this.elements.parent.innerHTML = `<option value="">一级分类</option>${options}`;
  },

  updateSummary(visibleCount = this.getVisibleCategories().length) {
    const total = this.categories.length;
    const bookmarkTotal = this.categories.reduce(
      (sum, category) => sum + Number(category.bookmark_count || 0),
      0,
    );

    if (this.elements.totalCount) {
      this.elements.totalCount.textContent = String(total);
    }
    if (this.elements.bookmarkTotal) {
      this.elements.bookmarkTotal.textContent = String(bookmarkTotal);
    }
    if (this.elements.visibleCount) {
      this.elements.visibleCount.textContent = String(visibleCount);
    }
  },

  startEdit(id) {
    const category = this.categories.find(
      (item) => String(item.id) === String(id),
    );
    if (!category) return;

    this.elements.id.value = category.id;
    this.elements.name.value = category.name || "";
    this.elements.color.value = category.color || "#3B82F6";
    this.renderParentOptions(category.id);
    if (this.elements.parent) {
      this.elements.parent.value = category.parent_id || "";
    }
    this.elements.description.value = category.description || "";
    if (this.elements.save) {
      this.elements.save.textContent = "保存修改";
    }
    this.elements.name.focus();
  },

  resetForm() {
    this.elements.form.reset();
    this.elements.id.value = "";
    this.elements.color.value = "#3B82F6";
    this.renderParentOptions();
    if (this.elements.parent) {
      this.elements.parent.value = "";
    }
    if (this.elements.save) {
      this.elements.save.textContent = "创建分类";
    }
  },

  focusCreateForm() {
    this.resetForm();
    this.elements.form?.scrollIntoView({ behavior: "smooth", block: "center" });
    this.elements.name?.focus();
  },

  getFormData() {
    return {
      name: this.elements.name.value.trim(),
      color: this.elements.color.value || "#3B82F6",
      parent_id: this.elements.parent?.value || null,
      description: this.elements.description.value.trim(),
    };
  },

  async saveCategory() {
    const data = this.getFormData();
    if (!data.name) {
      AdminUI.showToast("请填写分类名称", "error");
      return;
    }

    try {
      const id = this.elements.id.value;
      const response = id
        ? await BookmarkAPI.updateCategory(id, data)
        : await BookmarkAPI.createCategory(data);
      if (!response.success) {
        throw new Error(response.error || "保存分类失败");
      }
      AdminUI.showToast(id ? "分类已更新" : "分类已创建");
      this.resetForm();
      await this.loadCategories();
    } catch (error) {
      AdminUI.showToast(error.message || "保存分类失败", "error");
    }
  },

  openDeleteCategoryModal(id) {
    const category = this.categories.find(
      (item) => String(item.id) === String(id),
    );
    if (!category) return;

    this.pendingDeleteCategory = category;
    const alternatives = this.categories.filter(
      (item) => String(item.id) !== String(id),
    );
    const count = Number(category.bookmark_count || 0);

    if (this.elements.deleteSummary) {
      this.elements.deleteSummary.textContent = `分类“${category.name}”下有 ${count} 条书签。删除分类前，请选择这些书签要迁移到哪里。`;
    }

    if (this.elements.deleteTarget) {
      const options = [
        '<option value="">未分类</option>',
        ...alternatives.map(
          (item) =>
            `<option value="${AdminUI.escapeHtml(String(item.id))}">${AdminUI.escapeHtml(item.name)}</option>`,
        ),
      ];
      this.elements.deleteTarget.innerHTML = options.join("");
    }

    this.elements.deleteModal?.classList.remove("hidden");
    this.elements.deleteTarget?.focus();
  },

  closeDeleteCategoryModal() {
    this.pendingDeleteCategory = null;
    this.elements.deleteModal?.classList.add("hidden");
    if (this.elements.deleteTarget) {
      this.elements.deleteTarget.innerHTML = "";
    }
  },

  async confirmDeleteCategory() {
    const category = this.pendingDeleteCategory;
    if (!category) return;

    const button = this.elements.confirmDelete;
    const previousText = button?.textContent;
    const moveToCategoryId = this.elements.deleteTarget?.value || null;
    const targetLabel =
      this.elements.deleteTarget?.selectedOptions?.[0]?.textContent?.trim() ||
      "未分类";
    const count = Number(category.bookmark_count || 0);

    this.elements.deleteModal?.classList.add("hidden");
    const confirmed = await AdminUI.confirm({
      title: "删除分类",
      message: `确定删除分类「${category.name}」吗？`,
      hint: `该分类下的 ${count} 条书签会先迁移到「${targetLabel}」。删除分类后，分类本身无法恢复。`,
      confirmText: "删除分类",
      variant: "danger",
    });
    if (!confirmed) {
      this.elements.deleteModal?.classList.remove("hidden");
      this.elements.deleteTarget?.focus();
      return;
    }

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "删除中...";
      }

      const response = await BookmarkAPI.deleteCategory(category.id, {
        moveToCategoryId,
      });
      if (!response.success) {
        throw new Error(response.error || "删除分类失败");
      }
      AdminUI.showToast("分类已删除，书签已迁移");
      this.closeDeleteCategoryModal();
      this.resetForm();
      await this.loadCategories();
    } catch (error) {
      AdminUI.showToast(error.message || "删除分类失败", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText || "继续确认";
      }
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  CategoryManagerPage.init();
  const params = new URLSearchParams(window.location.search);
  if (params.get("create") === "1") {
    setTimeout(() => CategoryManagerPage.focusCreateForm(), 250);
  }
});

window.CategoryManagerPage = CategoryManagerPage;
