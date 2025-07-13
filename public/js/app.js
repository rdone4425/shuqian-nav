// 主应用逻辑
// 协调各个模块，处理用户交互和应用状态

const App = {
  // 应用状态
  isInitialized: false,
  currentBookmark: null,

  // UI元素
  elements: {},

  // 初始化应用
  async init() {
    try {
      // 检查认证状态
      if (!Auth.checkAuthenticated()) {
        Auth.redirectToLogin();
        return;
      }

      // 绑定DOM元素
      this.bindElements();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化书签管理器
      await BookmarkManager.init();
      
      // 检查URL参数，处理特殊动作
      this.handleUrlParams();
      
      // 标记为已初始化
      this.isInitialized = true;
      
      console.log('应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      this.showMessage('应用初始化失败: ' + error.message, 'error');
    }
  },

  // 绑定DOM元素
  bindElements() {
    const selectors = {
      // 搜索相关
      searchToggle: 'searchToggle',
      searchContainer: 'searchContainer', 
      searchBtn: 'searchBtn',
      clearSearchBtn: 'clearSearchBtn',

      // 书签操作
      addBookmarkBtn: 'addBookmarkBtn',
      bookmarkModal: 'bookmarkModal',
      bookmarkForm: 'bookmarkForm',
      modalTitle: 'modalTitle',
      closeModalBtn: 'closeModalBtn',
      cancelBtn: 'cancelBtn',
      saveBtn: 'saveBtn',

      // 表单字段
      bookmarkTitle: 'bookmarkTitle',
      bookmarkUrl: 'bookmarkUrl',
      bookmarkDescription: 'bookmarkDescription',
      bookmarkCategory: 'bookmarkCategory',

      // 工具菜单
      toolsMenuToggle: 'toolsMenuToggle',
      toolsDropdown: 'toolsDropdown',

      // 设置面板
      settingsToggle: 'settingsToggle',
      settingsPanel: 'settingsPanel',
      settingsClose: 'settingsClose',
      logoutBtn: 'logoutBtn',
      exportBtn: 'exportBtn',
      importBtn: 'importBtn',

      // 视图控制
      gridViewBtn: 'gridViewBtn',
      listViewBtn: 'listViewBtn',

      // 消息提示
      messageContainer: 'messageContainer',
      messageText: 'messageText',

      // 修改密码相关
      changePasswordBtn: 'changePasswordBtn',
      changePasswordModal: 'changePasswordModal'
    };
    
    this.elements = DOMHelper.getElements(selectors);
  },

  // 处理URL参数
  handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'change-password') {
      // 延迟一下确保DOM元素已经绑定
      setTimeout(() => {
        this.showChangePasswordModal();
        // 清除URL参数，避免刷新后重复打开
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 100);
    }
  },

  // 绑定事件
  bindEvents() {
    // 搜索切换
    this.elements.searchToggle?.addEventListener('click', () => {
      this.toggleSearch();
    });

    // 清除搜索
    this.elements.clearSearchBtn?.addEventListener('click', () => {
      this.clearSearch();
    });

    // 添加书签
    this.elements.addBookmarkBtn?.addEventListener('click', () => {
      this.showBookmarkModal();
    });

    // 工具菜单切换
    this.elements.toolsMenuToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleToolsMenu();
    });

    // 点击外部关闭工具菜单
    document.addEventListener('click', (e) => {
      if (!this.elements.toolsMenuToggle?.contains(e.target) &&
          !this.elements.toolsDropdown?.contains(e.target)) {
        this.hideToolsMenu();
      }
    });

    // 模态框控制
    this.elements.closeModalBtn?.addEventListener('click', () => {
      this.hideBookmarkModal();
    });

    this.elements.cancelBtn?.addEventListener('click', () => {
      this.hideBookmarkModal();
    });

    // 点击模态框外部关闭
    this.elements.bookmarkModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.bookmarkModal) {
        this.hideBookmarkModal();
      }
    });

    // 书签表单提交
    this.elements.bookmarkForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveBookmark();
    });

    // 设置面板
    this.elements.settingsToggle?.addEventListener('click', () => {
      this.toggleSettings();
    });

    this.elements.settingsClose?.addEventListener('click', () => {
      this.hideSettings();
    });

    // 登出
    this.elements.logoutBtn?.addEventListener('click', () => {
      this.logout();
    });

    // 导出/导入
    this.elements.exportBtn?.addEventListener('click', () => {
      this.exportBookmarks();
    });

    // 添加JSON导出按钮事件
    document.getElementById('exportJSONBtn')?.addEventListener('click', () => {
      this.exportBookmarksJSON();
    });

    this.elements.importBtn?.addEventListener('click', () => {
      this.importBookmarks();
    });

    // 视图切换
    this.elements.gridViewBtn?.addEventListener('click', () => {
      this.setViewMode('grid');
    });

    this.elements.listViewBtn?.addEventListener('click', () => {
      this.setViewMode('list');
    });

    // 修改密码
    this.elements.changePasswordBtn?.addEventListener('click', () => {
      this.showChangePasswordModal();
    });

    this.elements.closePasswordModal?.addEventListener('click', () => {
      this.hideChangePasswordModal();
    });

    this.elements.cancelPasswordChange?.addEventListener('click', () => {
      this.hideChangePasswordModal();
    });

    // 点击模态框外部关闭
    this.elements.changePasswordModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.changePasswordModal) {
        this.hideChangePasswordModal();
      }
    });

    // 修改密码表单提交
    this.elements.changePasswordForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.changePassword();
    });

    // 数据库管理
    this.elements.clearSampleDataBtn?.addEventListener('click', () => {
      this.clearSampleData();
    });

    this.elements.resetDatabaseBtn?.addEventListener('click', () => {
      this.resetDatabase();
    });

    // 完整备份
    this.elements.fullBackupJSONBtn?.addEventListener('click', () => {
      this.createFullBackup('json');
    });

    this.elements.fullBackupHTMLBtn?.addEventListener('click', () => {
      this.createFullBackup('html');
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // 认证状态变化监听
    Auth.addEventListener('authChange', (data) => {
      if (!data.authenticated) {
        Auth.redirectToLogin();
      }
    });
  },

  // 切换搜索栏
  toggleSearch() {
    if (this.elements.searchContainer) {
      this.elements.searchContainer.classList.toggle('hidden');
      
      if (!this.elements.searchContainer.classList.contains('hidden')) {
        // 聚焦到搜索输入框
        const searchInput = document.getElementById('searchInput');
        searchInput?.focus();
      }
    }
  },

  // 清除搜索
  clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
  },

  // 显示书签模态框
  showBookmarkModal(bookmark = null) {
    this.currentBookmark = bookmark;
    
    if (bookmark) {
      // 编辑模式
      this.elements.modalTitle.textContent = '编辑书签';
      this.elements.bookmarkTitle.value = bookmark.title || '';
      this.elements.bookmarkUrl.value = bookmark.url || '';
      this.elements.bookmarkDescription.value = bookmark.description || '';
      this.elements.bookmarkCategory.value = bookmark.category_id || '';
    } else {
      // 添加模式
      this.elements.modalTitle.textContent = '添加书签';
      this.elements.bookmarkForm.reset();
    }

    // 加载分类选项
    this.loadCategoryOptions();
    
    this.elements.bookmarkModal?.classList.remove('hidden');
    this.elements.bookmarkTitle?.focus();
  },

  // 隐藏书签模态框
  hideBookmarkModal() {
    this.elements.bookmarkModal?.classList.add('hidden');
    this.currentBookmark = null;
    this.elements.bookmarkForm?.reset();
  },

  // 加载分类选项
  async loadCategoryOptions() {
    try {
      const response = await BookmarkAPI.getCategories();
      if (response.success && this.elements.bookmarkCategory) {
        const optionsHTML = response.data.map(category => 
          `<option value="${category.id}">${category.name}</option>`
        ).join('');
        
        this.elements.bookmarkCategory.innerHTML = `
          <option value="">无分类</option>
          ${optionsHTML}
        `;
      }
    } catch (error) {
      console.error('加载分类选项失败:', error);
    }
  },

  // 保存书签
  async saveBookmark() {
    try {
      const formData = {
        title: this.elements.bookmarkTitle.value.trim(),
        url: this.elements.bookmarkUrl.value.trim(),
        description: this.elements.bookmarkDescription.value.trim(),
        category_id: this.elements.bookmarkCategory.value || null
      };

      // 验证必填字段
      if (!formData.title || !formData.url) {
        this.showMessage('标题和URL是必填字段', 'error');
        return;
      }

      // 验证URL格式和协议安全性
      try {
        const url = new URL(formData.url);
        
        // 允许的协议白名单
        const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:'];
        
        if (!allowedProtocols.includes(url.protocol)) {
          this.showMessage(`不支持的协议: ${url.protocol}。只允许 HTTP, HTTPS, FTP, FTPS`, 'error');
          return;
        }
        
        // 检查是否是危险的协议
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
        if (dangerousProtocols.some(protocol => formData.url.toLowerCase().startsWith(protocol))) {
          this.showMessage('检测到危险的URL协议，已拒绝', 'error');
          return;
        }
        
        // 检查URL长度
        if (formData.url.length > 2048) {
          this.showMessage('URL长度超过限制（最大2048字符）', 'error');
          return;
        }
        
        // 检查域名是否合法（排除内网地址，除非是本地开发）
        const hostname = url.hostname.toLowerCase();
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isLocalDev) {
          const privateRanges = [
            /^127\./,           // 127.0.0.0/8
            /^10\./,            // 10.0.0.0/8
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
            /^192\.168\./,      // 192.168.0.0/16
            /^localhost$/,      // localhost
            /^0\./              // 0.0.0.0/8
          ];
          
          if (privateRanges.some(range => range.test(hostname))) {
            this.showMessage('不允许访问内网地址', 'error');
            return;
          }
        }
        
      } catch (urlError) {
        this.showMessage('请输入有效的URL格式', 'error');
        return;
      }

      this.elements.saveBtn.disabled = true;
      this.elements.saveBtn.textContent = '保存中...';

      let response;
      if (this.currentBookmark) {
        // 更新书签
        response = await BookmarkAPI.updateBookmark(this.currentBookmark.id, formData);
      } else {
        // 创建书签
        response = await BookmarkAPI.createBookmark(formData);
      }

      if (response.success) {
        this.showMessage(
          this.currentBookmark ? '书签更新成功' : '书签创建成功', 
          'success'
        );
        this.hideBookmarkModal();
        await BookmarkManager.refresh();
      } else {
        this.showMessage(response.error || '保存失败', 'error');
      }
    } catch (error) {
      console.error('保存书签错误:', error);
      this.showMessage('网络连接异常，请稍后重试', 'error');
    } finally {
      this.elements.saveBtn.disabled = false;
      this.elements.saveBtn.textContent = '保存';
    }
  },

  // 编辑书签
  async editBookmark(bookmarkId) {
    try {
      const response = await BookmarkAPI.getBookmark(bookmarkId);
      if (response.success) {
        this.showBookmarkModal(response.data);
      } else {
        this.showMessage('获取书签信息失败', 'error');
      }
    } catch (error) {
      console.error('获取书签错误:', error);
      this.showMessage('网络连接异常', 'error');
    }
  },

  // 删除书签
  async deleteBookmark(bookmarkId) {
    const bookmark = BookmarkManager.bookmarks.find(b => b.id == bookmarkId);
    const bookmarkTitle = bookmark ? bookmark.title : '该书签';
    
    if (!confirm(`确定要删除书签"${bookmarkTitle}"吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await BookmarkAPI.deleteBookmark(bookmarkId);
      if (response.success) {
        this.showMessage('书签删除成功', 'success');
        await BookmarkManager.refresh();
      } else {
        this.showMessage(response.error || '删除失败', 'error');
      }
    } catch (error) {
      console.error('删除书签错误:', error);
      this.showMessage('网络连接异常，请稍后重试', 'error');
    }
  },

  // 切换工具菜单
  toggleToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;

    if (dropdown && toggle) {
      const isVisible = dropdown.classList.contains('show');

      if (isVisible) {
        this.hideToolsMenu();
      } else {
        this.showToolsMenu();
      }
    }
  },

  // 显示工具菜单
  showToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;

    if (dropdown && toggle) {
      dropdown.classList.add('show');
      toggle.classList.add('active');
    }
  },

  // 隐藏工具菜单
  hideToolsMenu() {
    const dropdown = this.elements.toolsDropdown;
    const toggle = this.elements.toolsMenuToggle;

    if (dropdown && toggle) {
      dropdown.classList.remove('show');
      toggle.classList.remove('active');
    }
  },

  // 切换设置面板
  toggleSettings() {
    this.elements.settingsPanel?.classList.toggle('hidden');
    // 关闭工具菜单
    this.hideToolsMenu();
  },

  // 隐藏设置面板
  hideSettings() {
    this.elements.settingsPanel?.classList.add('hidden');
  },

  // 登出
  async logout() {
    if (confirm('确定要退出登录吗？')) {
      const result = await Auth.logout();
      if (result.success) {
        this.showMessage('已成功退出登录', 'success');
        setTimeout(() => {
          Auth.redirectToLogin();
        }, 1000);
      } else {
        this.showMessage('退出登录失败', 'error');
      }
    }
  },

  // 导出书签
  async exportBookmarks() {
    // 直接导出HTML格式（最通用的格式）
    this.executeExport('html');
  },

  // 导出为JSON格式
  async exportBookmarksJSON() {
    this.executeExport('json');
  },

  // 执行导出
  async executeExport(format) {
    try {
      this.showMessage('正在导出书签...', 'info');

      // 获取所有书签 - 分批获取以确保完整性
      const allBookmarks = await this.getAllBookmarksForExport();

      if (allBookmarks.length === 0) {
        this.showMessage('没有书签可以导出', 'warning');
        return;
      }

      if (format === 'html') {
        this.exportAsHTML(allBookmarks, BookmarkManager.categories);
      } else {
        this.exportAsJSON(allBookmarks, BookmarkManager.categories);
      }

      this.showMessage(`成功导出 ${allBookmarks.length} 个书签`, 'success');
    } catch (error) {
      console.error('导出失败:', error);
      this.showMessage('导出失败: ' + error.message, 'error');
    }
  },

  // 获取所有书签（分批获取，确保完整性）
  async getAllBookmarksForExport() {
    const allBookmarks = [];
    let page = 1;
    const limit = 1000; // 每批1000个

    while (true) {
      const response = await BookmarkAPI.getBookmarks({
        page,
        limit,
        // 不进行搜索和分类过滤，获取所有数据
      });

      if (!response.success) {
        throw new Error(response.error || '获取书签失败');
      }

      const bookmarks = response.data.bookmarks || [];
      allBookmarks.push(...bookmarks);

      // 如果返回的书签数量少于limit，说明已经是最后一页
      if (bookmarks.length < limit) {
        break;
      }

      page++;

      // 显示进度
      this.showMessage(`正在获取书签... 已获取 ${allBookmarks.length} 个`, 'info');
    }

    return allBookmarks;
  },

  // 导出为HTML格式
  exportAsHTML(bookmarks, categories) {
    const now = new Date();
    const timestamp = now.toISOString();

    // 按分类组织书签
    const bookmarksByCategory = {};
    const uncategorized = [];

    bookmarks.forEach(bookmark => {
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

    // 添加分类书签
    Object.keys(bookmarksByCategory).forEach(categoryName => {
      html += `        <DT><H3 ADD_DATE="${Math.floor(now.getTime() / 1000)}" LAST_MODIFIED="${Math.floor(now.getTime() / 1000)}">${this.escapeHtml(categoryName)}</H3>\n`;
      html += `        <DL><p>\n`;

      bookmarksByCategory[categoryName].forEach(bookmark => {
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

      html += `        </DL><p>\n`;
    });

    // 添加未分类书签
    if (uncategorized.length > 0) {
      html += `        <DT><H3 ADD_DATE="${Math.floor(now.getTime() / 1000)}" LAST_MODIFIED="${Math.floor(now.getTime() / 1000)}">未分类</H3>\n`;
      html += `        <DL><p>\n`;

      uncategorized.forEach(bookmark => {
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

      html += `        </DL><p>\n`;
    }

    html += `    </DL><p>
</DL><p>`;

    this.downloadFile(html, `bookmarks-${new Date().toISOString().split('T')[0]}.html`, 'text/html');
  },

  // 导出为JSON格式
  exportAsJSON(bookmarks, categories) {
    const exportData = {
      bookmarks: bookmarks,
      categories: categories,
      exportTime: new Date().toISOString(),
      version: '1.0.0',
      totalBookmarks: bookmarks.length,
      totalCategories: categories.length
    };

    this.downloadFile(
      JSON.stringify(exportData, null, 2),
      `bookmarks-${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
  },

  // 下载文件
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 导入书签
  importBookmarks() {
    // 跳转到专门的导入页面
    window.location.href = '/import.html';
  },

  // 显示导入对话框
  showImportDialog() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content import-modal">
        <div class="modal-header">
          <h3>导入书签</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="import-step" id="step1">
            <h4>选择导入文件</h4>
            <div class="file-drop-zone" id="fileDropZone">
              <div class="drop-zone-content">
                <i class="icon">📁</i>
                <p>拖拽文件到此处或点击选择</p>
                <p class="file-hint">支持 JSON 格式的书签文件</p>
                <button class="btn btn-primary" id="selectFileBtn">选择文件</button>
              </div>
            </div>
            <input type="file" id="fileInput" accept=".json" style="display: none;">
          </div>

          <div class="import-step" id="step2" style="display: none;">
            <h4>导入预览</h4>
            <div class="import-preview">
              <div class="preview-stats">
                <span id="previewCount">0</span> 个书签，
                <span id="previewCategories">0</span> 个分类
              </div>
              <div class="import-options">
                <label class="checkbox-label">
                  <input type="checkbox" id="clearExistingCheck">
                  <span class="checkmark"></span>
                  清除现有书签（谨慎操作）
                </label>
                <p class="option-hint">勾选此项将删除所有现有书签，只保留导入的书签</p>
              </div>
            </div>
          </div>

          <div class="import-step" id="step3" style="display: none;">
            <h4>导入进度</h4>
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <div class="progress-text" id="progressText">准备导入...</div>
            </div>
          </div>

          <div class="import-step" id="step4" style="display: none;">
            <h4>导入结果</h4>
            <div class="import-result" id="importResult"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelBtn">取消</button>
          <button class="btn btn-primary" id="previewBtn" style="display: none;">预览</button>
          <button class="btn btn-primary" id="importBtn" style="display: none;">开始导入</button>
          <button class="btn btn-primary" id="finishBtn" style="display: none;">完成</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.initImportDialog(modal);
  },

  // 初始化导入对话框
  initImportDialog(modal) {
    const fileInput = modal.querySelector('#fileInput');
    const fileDropZone = modal.querySelector('#fileDropZone');
    const selectFileBtn = modal.querySelector('#selectFileBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const previewBtn = modal.querySelector('#previewBtn');
    const importBtn = modal.querySelector('#importBtn');
    const finishBtn = modal.querySelector('#finishBtn');

    let importData = null;

    // 文件选择
    selectFileBtn.addEventListener('click', () => fileInput.click());

    // 文件拖拽
    fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropZone.classList.add('drag-over');
    });

    fileDropZone.addEventListener('dragleave', () => {
      fileDropZone.classList.remove('drag-over');
    });

    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleImportFile(files[0], modal);
      }
    });

    // 文件输入变化
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImportFile(e.target.files[0], modal);
      }
    });

    // 按钮事件
    cancelBtn.addEventListener('click', () => modal.remove());

    previewBtn.addEventListener('click', () => {
      this.showImportPreview(importData, modal);
    });

    importBtn.addEventListener('click', () => {
      this.executeImport(importData, modal);
    });

    finishBtn.addEventListener('click', () => {
      modal.remove();
      // 刷新页面
      window.location.reload();
    });

    // 存储导入数据的引用
    modal.importData = null;
  },

  // 处理导入文件
  async handleImportFile(file, modal) {
    try {
      if (!file.name.endsWith('.json')) {
        this.showMessage('请选择 JSON 格式的文件', 'error');
        return;
      }

      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        this.showMessage('无效的书签文件格式', 'error');
        return;
      }

      modal.importData = data;

      // 显示预览信息
      const previewCount = modal.querySelector('#previewCount');
      const previewCategories = modal.querySelector('#previewCategories');

      previewCount.textContent = data.bookmarks.length;

      const categories = new Set();
      data.bookmarks.forEach(bookmark => {
        if (bookmark.category_name || bookmark.category) {
          categories.add(bookmark.category_name || bookmark.category);
        }
      });
      previewCategories.textContent = categories.size;

      // 切换到预览步骤
      this.showImportStep(modal, 2);
      modal.querySelector('#previewBtn').style.display = 'inline-block';

    } catch (error) {
      console.error('文件解析失败:', error);
      this.showMessage('文件解析失败: ' + error.message, 'error');
    }
  },

  // 显示导入步骤
  showImportStep(modal, step) {
    // 隐藏所有步骤
    modal.querySelectorAll('.import-step').forEach(el => el.style.display = 'none');

    // 显示指定步骤
    modal.querySelector(`#step${step}`).style.display = 'block';

    // 更新按钮状态
    const previewBtn = modal.querySelector('#previewBtn');
    const importBtn = modal.querySelector('#importBtn');
    const finishBtn = modal.querySelector('#finishBtn');

    previewBtn.style.display = step === 2 ? 'inline-block' : 'none';
    importBtn.style.display = step === 2 ? 'inline-block' : 'none';
    finishBtn.style.display = step === 4 ? 'inline-block' : 'none';
  },

  // 显示导入预览
  showImportPreview(data, modal) {
    // 这里可以添加更详细的预览逻辑
    this.showMessage('预览功能开发中...', 'info');
  },

  // 执行导入
  async executeImport(data, modal) {
    if (!data) {
      this.showMessage('没有可导入的数据', 'error');
      return;
    }

    try {
      // 切换到进度步骤
      this.showImportStep(modal, 3);

      const clearExisting = modal.querySelector('#clearExistingCheck').checked;
      const progressFill = modal.querySelector('#progressFill');
      const progressText = modal.querySelector('#progressText');

      // 更新进度
      progressText.textContent = '正在导入书签...';
      progressFill.style.width = '20%';

      const response = await API.post('/api/bookmarks/import', {
        bookmarks: data.bookmarks,
        categories: data.categories || [],
        clearExisting: clearExisting
      });

      progressFill.style.width = '100%';

      if (response.success) {
        const { imported, skipped, errors, total, errorDetails } = response.data;

        // 切换到结果步骤
        this.showImportStep(modal, 4);

        const resultDiv = modal.querySelector('#importResult');
        resultDiv.innerHTML = `
          <div class="import-success">
            <div class="result-icon">✅</div>
            <h4>导入完成！</h4>
            <div class="result-stats">
              <div class="stat-item">
                <span class="stat-number">${total}</span>
                <span class="stat-label">总计</span>
              </div>
              <div class="stat-item success">
                <span class="stat-number">${imported}</span>
                <span class="stat-label">成功</span>
              </div>
              ${skipped > 0 ? `
                <div class="stat-item warning">
                  <span class="stat-number">${skipped}</span>
                  <span class="stat-label">跳过</span>
                </div>
              ` : ''}
              ${errors > 0 ? `
                <div class="stat-item error">
                  <span class="stat-number">${errors}</span>
                  <span class="stat-label">失败</span>
                </div>
              ` : ''}
            </div>
            ${errors > 0 && errorDetails ? `
              <div class="error-details">
                <h5>错误详情：</h5>
                <ul>
                  ${errorDetails.slice(0, 5).map(error => `<li>${error}</li>`).join('')}
                  ${errorDetails.length > 5 ? `<li>... 还有 ${errorDetails.length - 5} 个错误</li>` : ''}
                </ul>
              </div>
            ` : ''}
          </div>
        `;

      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('导入失败:', error);

      // 显示错误结果
      this.showImportStep(modal, 4);
      const resultDiv = modal.querySelector('#importResult');
      resultDiv.innerHTML = `
        <div class="import-error">
          <div class="result-icon">❌</div>
          <h4>导入失败</h4>
          <p class="error-message">${error.message}</p>
        </div>
      `;
    }
  },

  // 设置视图模式
  setViewMode(mode) {
    Storage.viewMode.set(mode);
    
    // 更新按钮状态
    this.elements.gridViewBtn?.classList.toggle('active', mode === 'grid');
    this.elements.listViewBtn?.classList.toggle('active', mode === 'list');
    
    // 更新网格样式
    const bookmarksGrid = document.getElementById('bookmarksGrid');
    if (bookmarksGrid) {
      bookmarksGrid.className = mode === 'list' ? 'bookmarks-list' : 'bookmarks-grid';
    }
  },

  // 键盘快捷键
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K: 打开搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.toggleSearch();
    }

    // Ctrl/Cmd + N: 添加新书签
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.showBookmarkModal();
    }

    // Escape: 关闭模态框和菜单
    if (e.key === 'Escape') {
      if (!this.elements.changePasswordModal?.classList.contains('hidden')) {
        this.hideChangePasswordModal();
      }
      else if (!this.elements.bookmarkModal?.classList.contains('hidden')) {
        this.hideBookmarkModal();
      }
      else if (!this.elements.settingsPanel?.classList.contains('hidden')) {
        this.hideSettings();
      }
      else if (this.elements.toolsDropdown?.classList.contains('show')) {
        this.hideToolsMenu();
      }
    }
  },

  // 显示修改密码模态框
  showChangePasswordModal() {
    this.elements.changePasswordModal?.classList.remove('hidden');
    // 聚焦到当前密码输入框
    setTimeout(() => {
      document.getElementById('currentPassword')?.focus();
    }, 100);
  },

  // 隐藏修改密码模态框
  hideChangePasswordModal() {
    this.elements.changePasswordModal?.classList.add('hidden');
    // 清空表单
    this.elements.changePasswordForm?.reset();
  },

  // 修改密码
  async changePassword() {
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.showMessage('请填写所有字段', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showMessage('新密码和确认密码不匹配', 'error');
      return;
    }

    if (newPassword.length < 6) {
      this.showMessage('新密码长度至少为6位', 'error');
      return;
    }

    try {
      const response = await AuthAPI.changePassword(currentPassword, newPassword, confirmPassword);

      if (response.success) {
        this.showMessage('密码修改成功！请重新登录。', 'success');
        this.hideChangePasswordModal();

        // 延迟后自动登出
        setTimeout(() => {
          AuthAPI.logout();
        }, 2000);
      } else {
        this.showMessage('修改失败：' + (response.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      this.showMessage('修改失败：网络错误', 'error');
    }
  },

  // 显示消息
  showMessage(text, type = 'info') {
    if (!this.elements.messageContainer || !this.elements.messageText) return;

    this.elements.messageText.textContent = text;
    this.elements.messageText.className = `message-text ${type}`;
    this.elements.messageContainer.classList.remove('hidden');

    // 自动隐藏
    const timeout = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      this.elements.messageContainer?.classList.add('hidden');
    }, timeout);
  },

  // 清除示例数据
  async clearSampleData() {
    if (!confirm('确定要清除所有示例数据吗？\n\n这将删除所有预设的书签和分类，但保留您添加的数据。\n此操作不可撤销！')) {
      return;
    }

    try {
      this.showMessage('正在清除示例数据...', 'info');

      const response = await SystemAPI.clearSampleData();

      if (response.success) {
        this.showMessage('示例数据已清除！', 'success');
        // 刷新页面数据
        await BookmarkManager.refresh();
      } else {
        this.showMessage('清除失败: ' + (response.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('清除示例数据失败:', error);
      this.showMessage('清除失败: ' + error.message, 'error');
    }
  },

  // 重置数据库
  async resetDatabase() {
    if (!confirm('⚠️ 危险操作！\n\n确定要重置整个数据库吗？\n\n这将删除所有数据（包括您的书签），并重新创建空白数据库。\n此操作不可撤销！')) {
      return;
    }

    // 二次确认
    const confirmText = prompt('请输入 "RESET" 来确认重置数据库:');
    if (confirmText !== 'RESET') {
      this.showMessage('操作已取消', 'info');
      return;
    }

    try {
      this.showMessage('正在重置数据库...', 'info');

      const response = await SystemAPI.resetDatabase();

      if (response.success) {
        this.showMessage('数据库已重置！页面将在3秒后刷新...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        this.showMessage('重置失败: ' + (response.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('重置数据库失败:', error);
      this.showMessage('重置失败: ' + error.message, 'error');
    }
  },

  // 创建完整备份
  async createFullBackup(format) {
    try {
      this.showMessage(`正在创建${format.toUpperCase()}格式的完整备份...`, 'info');

      const response = await SystemAPI.createBackup(format);

      if (response.ok) {
        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `bookmarks-backup-${new Date().toISOString().split('T')[0]}.${format}`;

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        // 下载文件
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage(`✅ 完整备份已下载: ${filename}`, 'success');
      } else {
        const errorData = await response.json();
        this.showMessage('备份失败: ' + (errorData.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('创建备份失败:', error);
      this.showMessage('备份失败: ' + error.message, 'error');
    }
  }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
  // 等待认证模块初始化完成
  await new Promise(resolve => {
    if (Auth.isAuthenticated !== undefined) {
      resolve();
    } else {
      setTimeout(resolve, 100);
    }
  });
  
  await App.init();
});

// 导出到全局作用域
window.App = App;
