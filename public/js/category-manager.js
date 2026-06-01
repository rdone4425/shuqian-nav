const CategoryManagerPage = {
  categories: [],
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
      description: document.getElementById("categoryDescription"),
      save: document.getElementById("saveCategoryBtn"),
      reset: document.getElementById("resetCategoryBtn"),
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
      '<tr><td colspan="5" class="management-empty">正在加载分类...</td></tr>';

    try {
      const response = await BookmarkAPI.getCategories();
      if (!response.success) {
        throw new Error(response.error || "加载分类失败");
      }
      this.categories = response.data || [];
      this.renderCategories();
    } catch (error) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="5" class="management-empty danger-text">${AdminUI.escapeHtml(error.message)}</td></tr>`;
    }
  },

  renderCategories() {
    if (!this.categories.length) {
      this.elements.tableBody.innerHTML =
        '<tr><td colspan="5" class="management-empty">还没有分类</td></tr>';
      return;
    }

    this.elements.tableBody.innerHTML = this.categories
      .map((category) => {
        const color = AdminUI.escapeHtml(category.color || "#3B82F6");
        const count = Number(category.bookmark_count || 0);
        return `
          <tr>
            <td>
              <span class="category-pill">
                <span class="color-swatch" style="background:${color}"></span>
                ${AdminUI.escapeHtml(category.name)}
              </span>
            </td>
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

  startEdit(id) {
    const category = this.categories.find(
      (item) => String(item.id) === String(id),
    );
    if (!category) return;

    this.elements.id.value = category.id;
    this.elements.name.value = category.name || "";
    this.elements.color.value = category.color || "#3B82F6";
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
        button.textContent = previousText || "确认删除";
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
