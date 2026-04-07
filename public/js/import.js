// 导入页面管理器
const ImportManager = {
  currentStep: 1,
  totalSteps: 4,
  importData: null,
  fileData: null,

  // 初始化
  async init() {
    // 检查认证
    if (!Auth.checkAuthenticated()) {
      Auth.redirectToLogin();
      return;
    }

    this.bindEvents();
    this.updateStepDisplay();
  },

  // 绑定事件
  bindEvents() {
    // 文件选择
    const fileInput = document.getElementById("fileInput");
    const selectFileBtn = document.getElementById("selectFileBtn");
    const fileDropZone = document.getElementById("fileDropZone");

    selectFileBtn?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", (e) =>
      this.handleFileSelect(e.target.files[0]),
    );

    // 文件拖拽
    fileDropZone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropZone.classList.add("drag-over");
    });

    fileDropZone?.addEventListener("dragleave", () => {
      fileDropZone.classList.remove("drag-over");
    });

    fileDropZone?.addEventListener("drop", (e) => {
      e.preventDefault();
      fileDropZone.classList.remove("drag-over");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // 导航按钮
    document
      .getElementById("prevBtn")
      ?.addEventListener("click", () => this.previousStep());
    document
      .getElementById("nextBtn")
      ?.addEventListener("click", () => this.nextStep());
    document
      .getElementById("importBtn")
      ?.addEventListener("click", () => this.executeImport());
    document
      .getElementById("finishBtn")
      ?.addEventListener("click", () => this.finish());

    // 帮助按钮
    document
      .getElementById("helpToggle")
      ?.addEventListener("click", () => this.toggleHelp());
  },

  // 处理文件选择
  async handleFileSelect(file) {
    if (!file) return;

    try {
      // 验证文件类型
      const fileName = file.name.toLowerCase();
      const isHTML = fileName.endsWith(".html") || fileName.endsWith(".htm");
      const isJSON = fileName.endsWith(".json");

      if (!isHTML && !isJSON) {
        this.showMessage("请选择 HTML 或 JSON 格式的文件", "error");
        return;
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.showMessage("文件大小不能超过 10MB", "error");
        return;
      }

      // 读取文件内容
      const text = await file.text();
      let data;

      if (isHTML) {
        data = this.parseHTMLBookmarks(text);
      } else {
        data = JSON.parse(text);
      }

      // 验证文件格式
      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        this.showMessage("无效的书签文件格式：缺少 bookmarks 数组", "error");
        return;
      }

      if (data.bookmarks.length === 0) {
        this.showMessage("文件中没有书签数据", "error");
        return;
      }

      // 保存数据
      this.fileData = file;
      this.importData = data;

      // 更新预览
      this.updatePreview();

      // 启用下一步按钮
      document.getElementById("nextBtn").disabled = false;

      this.showMessage(
        `成功读取文件：${data.bookmarks.length} 个书签`,
        "success",
      );
    } catch (error) {
      console.error("文件解析失败:", error);
      this.showMessage("文件解析失败：" + error.message, "error");
    }
  },

  // 解析HTML书签文件
  parseHTMLBookmarks(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const bookmarks = [];
    const categories = [];
    const categoryMap = new Map();

    // 递归解析书签
    const parseBookmarkNode = (node, currentCategory = null) => {
      const children = node.children;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.tagName === "DT") {
          const nextSibling = children[i + 1];

          // 检查是否是文件夹（H3标签）
          const h3 = child.querySelector("H3");
          if (h3) {
            const categoryName = h3.textContent.trim();

            // 创建分类
            if (!categoryMap.has(categoryName)) {
              const category = {
                name: categoryName,
                color: this.generateCategoryColor(categories.length),
                description: `从HTML导入的分类`,
              };
              categories.push(category);
              categoryMap.set(categoryName, category);
            }

            // 解析子节点
            if (nextSibling && nextSibling.tagName === "DL") {
              parseBookmarkNode(nextSibling, categoryName);
              i++; // 跳过已处理的DL节点
            }
          } else {
            // 检查是否是书签链接
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

              // 检查是否有描述（DD标签）
              if (nextSibling && nextSibling.tagName === "DD") {
                bookmark.description = nextSibling.textContent.trim();
                i++; // 跳过已处理的DD节点
              }

              bookmarks.push(bookmark);
            }
          }
        } else if (child.tagName === "DL") {
          // 直接解析DL节点
          parseBookmarkNode(child, currentCategory);
        }
      }
    };

    // 开始解析
    const dlElements = doc.querySelectorAll("DL");
    dlElements.forEach((dl) => parseBookmarkNode(dl));

    return {
      bookmarks: bookmarks,
      categories: categories,
      importTime: new Date().toISOString(),
      version: "1.0.0",
      source: "html",
    };
  },

  // 生成分类颜色
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

  // 更新预览
  updatePreview() {
    if (!this.importData) return;

    const { bookmarks, categories = [] } = this.importData;

    // 更新统计信息
    document.getElementById("previewBookmarkCount").textContent =
      bookmarks.length;
    document.getElementById("previewCategoryCount").textContent =
      categories.length;
    document.getElementById("previewFileSize").textContent =
      this.formatFileSize(this.fileData.size);

    // 生成预览列表
    const previewList = document.getElementById("previewList");
    if (previewList) {
      const previewItems = bookmarks
        .slice(0, 10)
        .map(
          (bookmark) => `
        <div class="preview-item">
          <div class="item-icon">🔗</div>
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
        (bookmarks.length > 10
          ? `<div class="preview-more">... 还有 ${bookmarks.length - 10} 个书签</div>`
          : "");
    }
  },

  // 上一步
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepDisplay();
    }
  },

  // 下一步
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateStepDisplay();
    }
  },

  // 更新步骤显示
  updateStepDisplay() {
    console.log("更新步骤显示:", this.currentStep);

    // 更新步骤指示器
    document.querySelectorAll(".step").forEach((step, index) => {
      const stepNumber = index + 1;
      step.classList.remove("active", "completed");

      if (stepNumber === this.currentStep) {
        step.classList.add("active");
      } else if (stepNumber < this.currentStep) {
        step.classList.add("completed");
      }
    });

    // 更新步骤内容
    document.querySelectorAll(".import-step").forEach((step, index) => {
      const stepNumber = index + 1;
      const shouldBeActive = stepNumber === this.currentStep;
      step.classList.toggle("active", shouldBeActive);
      console.log(`步骤 ${stepNumber}: ${shouldBeActive ? "显示" : "隐藏"}`);
    });

    // 更新按钮状态
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const importBtn = document.getElementById("importBtn");
    const finishBtn = document.getElementById("finishBtn");

    if (prevBtn)
      prevBtn.style.display = this.currentStep > 1 ? "inline-flex" : "none";
    if (nextBtn)
      nextBtn.style.display = this.currentStep < 3 ? "inline-flex" : "none";
    if (importBtn)
      importBtn.style.display = this.currentStep === 3 ? "inline-flex" : "none";
    if (finishBtn)
      finishBtn.style.display = this.currentStep === 4 ? "inline-flex" : "none";

    // 第一步需要选择文件才能继续
    if (this.currentStep === 1) {
      if (nextBtn) nextBtn.disabled = !this.importData;
    } else {
      if (nextBtn) nextBtn.disabled = false;
    }
  },

  // 执行导入
  async executeImport() {
    if (!this.importData) {
      this.showMessage("没有可导入的数据", "error");
      return;
    }

    try {
      // 切换到进度步骤
      this.currentStep = 4;
      this.updateStepDisplay();

      // 获取导入设置
      const importMode =
        document.querySelector('input[name="importMode"]:checked')?.value ||
        "merge";
      const clearExisting = importMode === "replace";

      // 更新进度
      const progressFill = document.getElementById("progressFill");
      const progressText = document.getElementById("progressText");

      progressText.textContent = "正在导入书签...";
      progressFill.style.width = "20%";

      // 调用导入API
      const response = await API.post("/api/bookmarks/import", {
        bookmarks: this.importData.bookmarks,
        categories: this.importData.categories || [],
        clearExisting: clearExisting,
      });

      progressFill.style.width = "100%";
      progressText.textContent = "导入完成！";

      if (response.success) {
        this.showImportResult(response.data);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("导入失败:", error);
      this.showImportError(error.message);
    }
  },

  // 显示导入结果
  showImportResult(data) {
    const { imported, skipped, errors, total, errorDetails } = data;
    const resultDiv = document.getElementById("importResult");

    if (resultDiv) {
      resultDiv.className = "import-result";
      resultDiv.innerHTML = `
        <div class="result-success">
          <div class="result-icon">✅</div>
          <h3>导入完成！</h3>
          <div class="result-stats">
            <div class="stat-item">
              <div class="stat-number">${total}</div>
              <div class="stat-label">总计</div>
            </div>
            <div class="stat-item success">
              <div class="stat-number">${imported}</div>
              <div class="stat-label">成功</div>
            </div>
            ${
              skipped > 0
                ? `
              <div class="stat-item warning">
                <div class="stat-number">${skipped}</div>
                <div class="stat-label">跳过</div>
              </div>
            `
                : ""
            }
            ${
              errors > 0
                ? `
              <div class="stat-item error">
                <div class="stat-number">${errors}</div>
                <div class="stat-label">失败</div>
              </div>
            `
                : ""
            }
          </div>
          ${
            errors > 0 && errorDetails
              ? `
            <div class="error-details">
              <h4>错误详情：</h4>
              <ul>
                ${errorDetails
                  .slice(0, 5)
                  .map((error) => `<li>${this.escapeHtml(error)}</li>`)
                  .join("")}
                ${errorDetails.length > 5 ? `<li>... 还有 ${errorDetails.length - 5} 个错误</li>` : ""}
              </ul>
            </div>
          `
              : ""
          }
        </div>
      `;
    }
  },

  // 显示导入错误
  showImportError(message) {
    const resultDiv = document.getElementById("importResult");

    if (resultDiv) {
      resultDiv.className = "import-result";
      resultDiv.innerHTML = `
        <div class="result-error">
          <div class="result-icon">❌</div>
          <h3>导入失败</h3>
          <p class="error-message">${this.escapeHtml(message)}</p>
        </div>
      `;
    }
  },

  // 完成导入
  finish() {
    window.location.href = "/";
  },

  // 切换帮助显示
  toggleHelp() {
    const helpSection = document.getElementById("helpSection");
    const helpToggle = document.getElementById("helpToggle");

    if (helpSection) {
      const isHidden = helpSection.classList.contains("hidden");

      if (isHidden) {
        helpSection.classList.remove("hidden");
        helpToggle.innerHTML = '<span class="btn-icon">❌</span>关闭帮助';
      } else {
        helpSection.classList.add("hidden");
        helpToggle.innerHTML = '<span class="btn-icon">❓</span>帮助';
      }
    }
  },

  // 显示消息
  showMessage(text, type = "info") {
    // 简单的消息显示，可以后续改进
    if (type === "error") {
      alert("错误: " + text);
    } else if (type === "success") {
      console.log("成功: " + text);
    } else {
      console.log("信息: " + text);
    }
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
  // 初始化工具菜单功能
  const toolsMenuToggle = document.getElementById("toolsMenuToggle");
  const toolsDropdown = document.getElementById("toolsDropdown");

  if (toolsMenuToggle && toolsDropdown) {
    // 切换下拉菜单
    toolsMenuToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toolsDropdown.classList.toggle("show");
      toolsMenuToggle.classList.toggle("active");
    });

    // 点击其他地方关闭菜单
    document.addEventListener("click", (e) => {
      if (
        !toolsMenuToggle.contains(e.target) &&
        !toolsDropdown.contains(e.target)
      ) {
        toolsDropdown.classList.remove("show");
        toolsMenuToggle.classList.remove("active");
      }
    });

    // 修改密码按钮事件
    const changePasswordBtn = document.getElementById("changePasswordBtn");
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener("click", () => {
        // 重定向到首页并触发密码修改模态框
        window.location.href = "/?action=change-password";
      });
    }
  }

  // 初始化导入管理器
  await ImportManager.init();
});
