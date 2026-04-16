const ImportManager = {
  currentStep: 1,
  totalSteps: 4,
  importData: null,
  fileData: null,

  async init() {
    this.bindEvents();
    this.updateStepDisplay();
  },

  bindEvents() {
    const fileInput = document.getElementById("fileInput");
    const selectFileBtn = document.getElementById("selectFileBtn");
    const fileDropZone = document.getElementById("fileDropZone");

    selectFileBtn?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", (event) => {
      this.handleFileSelect(event.target.files[0]);
    });

    fileDropZone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      fileDropZone.classList.add("drag-over");
    });

    fileDropZone?.addEventListener("dragleave", () => {
      fileDropZone.classList.remove("drag-over");
    });

    fileDropZone?.addEventListener("drop", (event) => {
      event.preventDefault();
      fileDropZone.classList.remove("drag-over");
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    document.getElementById("prevBtn")?.addEventListener("click", () => this.previousStep());
    document.getElementById("nextBtn")?.addEventListener("click", () => this.nextStep());
    document.getElementById("importBtn")?.addEventListener("click", () => this.executeImport());
    document.getElementById("finishBtn")?.addEventListener("click", () => this.finish());
  },

  async handleFileSelect(file) {
    if (!file) {
      return;
    }

    try {
      const fileName = file.name.toLowerCase();
      const isHTML = fileName.endsWith(".html") || fileName.endsWith(".htm");
      const isJSON = fileName.endsWith(".json");

      if (!isHTML && !isJSON) {
        this.showMessage("请选择 HTML 或 JSON 格式的文件", "error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        this.showMessage("文件大小不能超过 10MB", "error");
        return;
      }

      const text = await file.text();
      const data = isHTML ? this.parseHTMLBookmarks(text) : JSON.parse(text);

      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        this.showMessage("无效的书签文件格式：缺少 bookmarks 数组", "error");
        return;
      }

      if (!data.bookmarks.length) {
        this.showMessage("文件中没有书签数据", "error");
        return;
      }

      this.fileData = file;
      this.importData = data;
      this.updatePreview();
      document.getElementById("nextBtn").disabled = false;
      this.showMessage(`成功读取文件，发现 ${data.bookmarks.length} 个书签`, "success");
    } catch (error) {
      console.error("文件解析失败:", error);
      this.showMessage(`文件解析失败: ${error.message}`, "error");
    }
  },

  parseHTMLBookmarks(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const bookmarks = [];
    const categories = [];
    const categoryMap = new Map();

    const parseBookmarkNode = (node, currentCategory = null) => {
      const children = node.children;

      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];

        if (child.tagName === "DT") {
          const nextSibling = children[index + 1];
          const heading = child.querySelector("H3");

          if (heading) {
            const categoryName = heading.textContent.trim();
            if (!categoryMap.has(categoryName)) {
              const category = {
                name: categoryName,
                color: this.generateCategoryColor(categories.length),
                description: "从 HTML 导入的分类",
              };
              categories.push(category);
              categoryMap.set(categoryName, category);
            }

            if (nextSibling && nextSibling.tagName === "DL") {
              parseBookmarkNode(nextSibling, categoryName);
              index += 1;
            }
          } else {
            const link = child.querySelector("A");
            if (link && link.href) {
              const bookmark = {
                title: link.textContent.trim() || link.href,
                url: link.href,
                description: "",
                category_name: currentCategory,
                favicon_url: link.getAttribute("ICON") || null,
                created_at: new Date().toISOString(),
              };

              if (nextSibling && nextSibling.tagName === "DD") {
                bookmark.description = nextSibling.textContent.trim();
                index += 1;
              }

              bookmarks.push(bookmark);
            }
          }
        } else if (child.tagName === "DL") {
          parseBookmarkNode(child, currentCategory);
        }
      }
    };

    doc.querySelectorAll("DL").forEach((dl) => parseBookmarkNode(dl));

    return {
      bookmarks,
      categories,
      importTime: new Date().toISOString(),
      version: "1.0.0",
      source: "html",
    };
  },

  generateCategoryColor(index) {
    const colors = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#06B6D4",
      "#84CC16",
      "#F97316",
      "#EC4899",
      "#6366F1",
    ];

    return colors[index % colors.length];
  },

  updatePreview() {
    if (!this.importData) {
      return;
    }

    const { bookmarks, categories = [] } = this.importData;
    document.getElementById("previewBookmarkCount").textContent = bookmarks.length;
    document.getElementById("previewCategoryCount").textContent = categories.length;
    document.getElementById("previewFileSize").textContent = this.formatFileSize(this.fileData.size);

    const previewList = document.getElementById("previewList");
    if (!previewList) {
      return;
    }

    const previewItems = bookmarks
      .slice(0, 10)
      .map(
        (bookmark) => `
          <div class="preview-item">
            <div class="item-icon">BM</div>
            <div class="item-content">
              <div class="item-title">${this.escapeHtml(bookmark.title)}</div>
              <div class="item-url">${this.escapeHtml(bookmark.url)}</div>
              ${bookmark.category_name ? `<div class="item-category">${this.escapeHtml(bookmark.category_name)}</div>` : ""}
            </div>
          </div>
        `,
      )
      .join("");

    previewList.innerHTML =
      previewItems +
      (bookmarks.length > 10 ? `<div class="preview-more">... 还有 ${bookmarks.length - 10} 个书签</div>` : "");
  },

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep -= 1;
      this.updateStepDisplay();
    }
  },

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep += 1;
      this.updateStepDisplay();
    }
  },

  updateStepDisplay() {
    document.querySelectorAll(".step").forEach((step, index) => {
      const stepNumber = index + 1;
      step.classList.remove("active", "completed");

      if (stepNumber === this.currentStep) {
        step.classList.add("active");
      } else if (stepNumber < this.currentStep) {
        step.classList.add("completed");
      }
    });

    document.querySelectorAll(".import-step").forEach((step, index) => {
      step.classList.toggle("active", index + 1 === this.currentStep);
    });

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const importBtn = document.getElementById("importBtn");
    const finishBtn = document.getElementById("finishBtn");

    if (prevBtn) prevBtn.style.display = this.currentStep > 1 ? "inline-flex" : "none";
    if (nextBtn) nextBtn.style.display = this.currentStep < 3 ? "inline-flex" : "none";
    if (importBtn) importBtn.style.display = this.currentStep === 3 ? "inline-flex" : "none";
    if (finishBtn) finishBtn.style.display = this.currentStep === 4 ? "inline-flex" : "none";

    if (this.currentStep === 1 && nextBtn) {
      nextBtn.disabled = !this.importData;
    }
  },

  async executeImport() {
    if (!this.importData) {
      this.showMessage("没有可导入的数据", "error");
      return;
    }

    try {
      this.currentStep = 4;
      this.updateStepDisplay();

      const importMode = document.querySelector('input[name="importMode"]:checked')?.value || "merge";
      const clearExisting = importMode === "replace";
      const progressFill = document.getElementById("progressFill");
      const progressText = document.getElementById("progressText");

      progressText.textContent = "正在导入书签...";
      progressFill.style.width = "20%";

      const response = await API.post("/api/bookmarks/import", {
        bookmarks: this.importData.bookmarks,
        categories: this.importData.categories || [],
        clearExisting,
      });

      progressFill.style.width = "100%";
      progressText.textContent = "导入完成";

      if (!response.success) {
        throw new Error(response.error || "导入失败");
      }

      this.showImportResult(response.data);
    } catch (error) {
      console.error("导入失败:", error);
      this.showImportError(error.message);
    }
  },

  showImportResult(data) {
    const { imported, skipped, errors, total, errorDetails } = data;
    const resultDiv = document.getElementById("importResult");

    if (!resultDiv) {
      return;
    }

    resultDiv.className = "import-result";
    resultDiv.innerHTML = `
      <div class="result-success">
        <div class="result-icon">OK</div>
        <h3>导入完成</h3>
        <div class="result-stats">
          <div class="stat-item"><div class="stat-number">${total}</div><div class="stat-label">总计</div></div>
          <div class="stat-item success"><div class="stat-number">${imported}</div><div class="stat-label">成功</div></div>
          ${skipped > 0 ? `<div class="stat-item warning"><div class="stat-number">${skipped}</div><div class="stat-label">跳过</div></div>` : ""}
          ${errors > 0 ? `<div class="stat-item error"><div class="stat-number">${errors}</div><div class="stat-label">失败</div></div>` : ""}
        </div>
        ${
          errors > 0 && errorDetails
            ? `<div class="error-details"><h4>错误详情</h4><ul>${errorDetails
                .slice(0, 5)
                .map((error) => `<li>${this.escapeHtml(error)}</li>`)
                .join("")}${errorDetails.length > 5 ? `<li>... 还有 ${errorDetails.length - 5} 个错误</li>` : ""}</ul></div>`
            : ""
        }
      </div>
    `;
  },

  showImportError(message) {
    const resultDiv = document.getElementById("importResult");
    if (!resultDiv) {
      return;
    }

    resultDiv.className = "import-result";
    resultDiv.innerHTML = `
      <div class="result-error">
        <div class="result-icon">ERR</div>
        <h3>导入失败</h3>
        <p class="error-message">${this.escapeHtml(message)}</p>
      </div>
    `;
  },

  finish() {
    window.location.href = "/";
  },

  showMessage(text, type = "info") {
    if (type === "error") {
      alert(`错误: ${text}`);
      return;
    }

    console.log(`${type}: ${text}`);
  },

  formatFileSize(bytes) {
    if (bytes === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / 1024 ** index).toFixed(2))} ${units[index]}`;
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  const toolsMenuToggle = document.getElementById("toolsMenuToggle");
  const toolsDropdown = document.getElementById("toolsDropdown");

  if (toolsMenuToggle && toolsDropdown) {
    toolsMenuToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toolsDropdown.classList.toggle("show");
      toolsMenuToggle.classList.toggle("active");
    });

    document.addEventListener("click", (event) => {
      if (!toolsMenuToggle.contains(event.target) && !toolsDropdown.contains(event.target)) {
        toolsDropdown.classList.remove("show");
        toolsMenuToggle.classList.remove("active");
      }
    });
  }

  await ImportManager.init();
});