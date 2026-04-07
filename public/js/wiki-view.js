// Wiki style knowledge base view enhanced with optional AI snapshot
const WikiView = {
  initialized: false,
  bookmarks: [],
  categories: [],
  filteredBookmarks: [],
  query: '',
  mode: 'local', // 'local' | 'ai'
  aiSnapshot: null,
  aiLoading: false,
  palette: {
    open: false,
    results: [],
    activeIndex: 0
  },
  elements: {},

  init() {
    if (this.initialized) return;
    this.elements = {
      layout: document.getElementById('wikiLayout'),
      searchInput: document.getElementById('wikiSearchInput'),
      toc: document.getElementById('wikiToc'),
      content: document.getElementById('wikiContent'),
      summaryCount: document.getElementById('wikiSummaryCount'),
      categoryCount: document.getElementById('wikiCategoryCount'),
      pinned: document.getElementById('wikiPinned'),
      emptyState: document.getElementById('wikiEmptyState'),
      openPaletteBtn: document.getElementById('openCommandPalette'),
      heroPaletteBtn: document.getElementById('openQuickSearch'),
      palette: document.getElementById('commandPalette'),
      paletteInput: document.getElementById('paletteInput'),
      paletteResults: document.getElementById('paletteResults'),
      paletteClose: document.getElementById('commandCloseBtn'),
      scrollTopBtn: document.getElementById('scrollTopBtn'),
      generateBtn: document.getElementById('generateAiWikiBtn'),
      toggleModeBtn: document.getElementById('toggleWikiModeBtn'),
      aiStatus: document.getElementById('wikiAiStatus')
    };

    if (!this.elements.layout) return;

    this.bindEvents();
    this.initialized = true;
    this.fetchAiSnapshot(); // 尝试加载已有的 AI 结果
  },

  bindEvents() {
    this.elements.searchInput?.addEventListener('input', this.debounce((e) => {
      this.applyFilter(e.target.value.trim());
    }, 200));

    const openPalette = () => this.togglePalette(true);
    this.elements.openPaletteBtn?.addEventListener('click', openPalette);
    this.elements.heroPaletteBtn?.addEventListener('click', openPalette);
    this.elements.paletteClose?.addEventListener('click', () => this.togglePalette(false));

    this.elements.scrollTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    this.elements.generateBtn?.addEventListener('click', () => this.triggerAiGeneration());
    this.elements.toggleModeBtn?.addEventListener('click', () => this.toggleMode());

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.togglePalette(true);
      } else if (event.key === 'Escape' && this.palette.open) {
        this.togglePalette(false);
      } else if (this.palette.open && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        event.preventDefault();
        this.handlePaletteKeys(event.key);
      }
    });

    this.elements.paletteInput?.addEventListener('input', this.debounce((e) => {
      this.renderPaletteResults(e.target.value.trim());
    }, 100));

    this.elements.paletteResults?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-id]');
      if (!item) return;
      this.navigateFromPalette(item.dataset);
    });

    this.elements.toc?.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const target = document.getElementById(e.target.dataset.target);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  },

  async fetchAiSnapshot() {
    try {
      const response = await BookmarkAPI.getAIWikiSnapshot();
      if (response.success && response.data?.snapshot) {
        this.aiSnapshot = response.data.snapshot;
        this.setMode('ai');
        this.updateAiStatus(`AI 视图：${this.formatTimestamp(this.aiSnapshot.generated_at)} 生成`, 'success');
      } else {
        this.updateAiStatus('AI 视图：尚未生成', 'muted');
      }
    } catch (error) {
      console.warn('获取 AI wiki 失败:', error);
      this.updateAiStatus('AI 视图：未启用', 'warning');
    }
  },

  async triggerAiGeneration() {
    if (this.aiLoading) return;
    this.aiLoading = true;
    this.setMode('ai');
    this.updateAiStatus('AI 视图：正在生成...', 'warning');
    this.elements.generateBtn?.classList.add('loading');
    this.elements.generateBtn && (this.elements.generateBtn.disabled = true);
    if (window.App?.showMessage) {
      App.showMessage('正在调用 AI 自动整理，请稍候...', 'info');
    }

    try {
      const response = await BookmarkAPI.generateAIWiki();
      if (!response.success) {
        throw new Error(response.error || '未知错误');
      }
      this.aiSnapshot = response.data;
      this.setMode('ai');
      this.updateAiStatus(`AI 视图：${this.formatTimestamp(this.aiSnapshot.generated_at)} 生成`, 'success');
      if (window.App?.showMessage) {
        App.showMessage('AI Wiki 生成完成！', 'success');
      }
      this.renderContent();
      this.renderTOC();
    } catch (error) {
      console.error('AI 生成失败:', error);
      this.updateAiStatus('AI 视图：生成失败，请重试', 'error');
      this.setMode('local');
      if (window.App?.showMessage) {
        App.showMessage('AI 生成失败：' + error.message, 'error');
      }
    } finally {
      this.aiLoading = false;
      if (this.elements.generateBtn) {
        this.elements.generateBtn.disabled = false;
        this.elements.generateBtn.classList.remove('loading');
      }
    }
  },

  update({ bookmarks, categories, summary } = {}) {
    if (bookmarks) this.bookmarks = bookmarks;
    if (categories) this.categories = categories;

    if (!this.initialized) {
      this.init();
    }
    if (!this.initialized) return;

    this.applyFilter(this.query);
    this.updateSummary(summary);
  },

  setMode(mode) {
    if (mode === 'ai' && !this.aiSnapshot) {
      mode = 'local';
    }
    this.mode = mode;
    if (this.elements.toggleModeBtn) {
      this.elements.toggleModeBtn.textContent = mode === 'ai' ? '查看本地视图' : '查看 AI 视图';
    }
    this.renderContent();
    this.renderTOC();
    this.renderPinned();
  },

  toggleMode() {
    if (this.mode === 'ai') {
      this.setMode('local');
    } else if (this.aiSnapshot) {
      this.setMode('ai');
    } else {
      this.updateAiStatus('AI 视图：暂无数据，先运行 AI 自动整理', 'warning');
      if (window.App?.showMessage) {
        App.showMessage('请先点击 “AI 自动整理” 生成最新的 Wiki。', 'info');
      }
    }
  },

  applyFilter(query = '') {
    this.query = query;
    const normalized = query.toLowerCase();
    this.filteredBookmarks = normalized
      ? this.bookmarks.filter((bookmark) => {
          return (
            (bookmark.title || '').toLowerCase().includes(normalized) ||
            (bookmark.description || '').toLowerCase().includes(normalized) ||
            (bookmark.url || '').toLowerCase().includes(normalized) ||
            (bookmark.category_name || '').toLowerCase().includes(normalized)
          );
        })
      : [...this.bookmarks];

    if (this.mode === 'local') {
      this.toggleEmptyState(this.filteredBookmarks.length === 0 && !this.aiSnapshot, query);
    } else {
      const sections = this.getFilteredAiSections();
      this.toggleEmptyState(!sections.length, query);
    }

    this.renderContent();
    this.renderTOC();
    this.renderPinned();
  },

  getFilteredAiSections() {
    if (!this.aiSnapshot?.sections?.length) return [];
    if (!this.query) return this.aiSnapshot.sections;
    const normalized = this.query.toLowerCase();

    return this.aiSnapshot.sections
      .map((section) => {
        const bookmarks = (section.bookmarks || []).filter((bookmark) => {
          return (
            (bookmark.title || '').toLowerCase().includes(normalized) ||
            (bookmark.summary || '').toLowerCase().includes(normalized) ||
            (bookmark.url || '').toLowerCase().includes(normalized)
          );
        });
        return { ...section, bookmarks };
      })
      .filter((section) => section.bookmarks.length);
  },

  updateSummary(summary = {}) {
    if (this.elements.summaryCount) {
      if (typeof summary.total === 'number') {
        this.elements.summaryCount.textContent = summary.total;
      } else if (this.mode === 'ai' && this.aiSnapshot?.stats?.unique) {
        this.elements.summaryCount.textContent = this.aiSnapshot.stats.unique;
      } else {
        this.elements.summaryCount.textContent = this.bookmarks.length;
      }
    }

    if (this.elements.categoryCount) {
      if (this.mode === 'ai' && this.aiSnapshot?.sections) {
        this.elements.categoryCount.textContent = this.aiSnapshot.sections.length;
      } else {
        const categories = this.categories.filter((c) => c && c.name);
        this.elements.categoryCount.textContent = categories.length || '-';
      }
    }
  },

  renderContent() {
    if (!this.elements.content) return;
    if (this.mode === 'ai' && this.aiSnapshot) {
      this.renderAiSections();
    } else {
      this.renderLocalSections();
    }
  },

  renderAiSections() {
    const sections = this.getFilteredAiSections();
    if (!sections.length) {
      this.elements.content.innerHTML = '<div class="wiki-empty">AI Wiki 还没有数据或被过滤掉了</div>';
      return;
    }

    const html = sections
      .map((section, idx) => {
        const bookmarks = (section.bookmarks || [])
          .map((bookmark) => this.renderAiBookmarkCard(bookmark, idx))
          .join('');

        return `
          <section class="wiki-section" id="ai-section-${idx}">
            <div class="wiki-section-header">
              <div>
                <h3>
                  <span class="category-dot" style="background:#22d3ee"></span>
                  ${this.escapeHtml(section.title || `AI 分组 ${idx + 1}`)}
                </h3>
                ${section.description ? `<p class="wiki-section-description">${this.escapeHtml(section.description)}</p>` : ''}
                ${section.tags?.length ? `<p class="wiki-section-description">标签：${section.tags.map((tag) => `<span class="wiki-tag">${this.escapeHtml(tag)}</span>`).join('')}</p>` : ''}
              </div>
              <span class="section-meta">${section.bookmarks?.length || 0}</span>
            </div>
            <div class="wiki-bookmark-list">
              ${bookmarks}
            </div>
          </section>
        `;
      })
      .join('');

    this.elements.content.innerHTML = html;
    this.bindBookmarkActions();
  },

  renderAiBookmarkCard(bookmark, idx) {
    return `
      <article class="wiki-bookmark" data-id="${bookmark.url}">
        <header>
          <div>
            <h4 class="wiki-bookmark-title">
              <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(bookmark.title || bookmark.url)}</a>
            </h4>
            <div class="wiki-bookmark-url">${this.escapeHtml(bookmark.url || '')}</div>
          </div>
          <div class="wiki-bookmark-actions">
            <button class="wiki-bookmark-action" data-action="open" data-id="${bookmark.url}" title="打开">
              打开
            </button>
          </div>
        </header>
        ${bookmark.summary ? `<p class="wiki-bookmark-description">${this.escapeHtml(bookmark.summary)}</p>` : ''}
        <div class="wiki-bookmark-meta">
          <span>原分类：${this.escapeHtml(bookmark.category || '未知')}</span>
          ${bookmark.duplicates?.length ? `<span>可能重复：${bookmark.duplicates.length} 条</span>` : ''}
        </div>
      </article>
    `;
  },

  renderLocalSections() {
    const groups = this.groupByCategory(this.filteredBookmarks);
    if (!groups.length) {
      this.elements.content.innerHTML = '<div class="wiki-empty">暂无本地书签或被过滤掉了</div>';
      return;
    }
    this.elements.content.innerHTML = groups.map((group) => this.renderSection(group)).join('');
    this.bindBookmarkActions();
  },

  groupByCategory(bookmarks) {
    const map = new Map();

    this.categories.forEach((category) => {
      map.set(category.id || 'uncategorized', {
        id: `wiki-category-${category.id || 'uncategorized'}`,
        title: category.name || '未分类',
        description: category.description || '',
        color: category.color || '#3b82f6',
        bookmarks: []
      });
    });

    const fallbackId = 'uncategorized';
    if (!map.has(fallbackId)) {
      map.set(fallbackId, {
        id: `wiki-category-${fallbackId}`,
        title: '未分类',
        description: '没有归入任何分组的收藏',
        color: '#94a3b8',
        bookmarks: []
      });
    }

    bookmarks.forEach((bookmark) => {
      const key = bookmark.category_id || 'uncategorized';
      const group = map.get(key) || map.get(fallbackId);
      group.bookmarks.push(bookmark);
    });

    return Array.from(map.values()).filter((group) => group.bookmarks.length);
  },

  renderSection({ id, title, description, color, bookmarks }) {
    const items = bookmarks.map((bookmark) => this.renderBookmarkCard(bookmark)).join('');
    return `
      <section class="wiki-section" id="${id}">
        <div class="wiki-section-header">
          <div>
            <h3>
              <span class="category-dot" style="background:${color}"></span>
              ${this.escapeHtml(title)}
            </h3>
            ${description ? `<p class="wiki-section-description">${this.escapeHtml(description)}</p>` : ''}
          </div>
          <span class="section-meta">${bookmarks.length}</span>
        </div>
        <div class="wiki-bookmark-list">
          ${items}
        </div>
      </section>
    `;
  },

  renderBookmarkCard(bookmark) {
    const highlight = (text) => this.highlight(text, this.query);
    const desc = bookmark.description ? `<p class="wiki-bookmark-description">${highlight(bookmark.description)}</p>` : '';
    const visitCount = bookmark.visit_count ? `访问 ${bookmark.visit_count}` : '尚未访问';
    const lastVisited = bookmark.last_visited ? `最近访问：${this.formatRelativeTime(bookmark.last_visited)}` : '暂无访问记录';

    return `
      <article class="wiki-bookmark" data-id="${bookmark.id}">
        <header>
          <div>
            <h4 class="wiki-bookmark-title">
              <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer">${highlight(bookmark.title || '')}</a>
            </h4>
            <div class="wiki-bookmark-url">${highlight(bookmark.url || '')}</div>
          </div>
          <div class="wiki-bookmark-actions">
            <button class="wiki-bookmark-action" data-action="open" data-id="${bookmark.id}" title="打开">
              打开
            </button>
            <button class="wiki-bookmark-action" data-action="edit" data-id="${bookmark.id}" title="编辑">
              编辑
            </button>
          </div>
        </header>
        ${desc}
        <div class="wiki-bookmark-meta">
          <span>${visitCount}</span>
          <span>${lastVisited}</span>
        </div>
      </article>
    `;
  },

  renderTOC() {
    if (!this.elements.toc) return;
    let entries = [];
    if (this.mode === 'ai' && this.aiSnapshot) {
      entries = this.getFilteredAiSections().map((section, idx) => ({
        id: `ai-section-${idx}`,
        title: section.title || `AI 分组 ${idx + 1}`,
        count: section.bookmarks?.length || 0
      }));
    } else {
      entries = this.groupByCategory(this.filteredBookmarks).map((group) => ({
        id: group.id,
        title: group.title,
        count: group.bookmarks.length
      }));
    }

    if (!entries.length) {
      this.elements.toc.innerHTML = '<p class="sidebar-hint">没有匹配的分组</p>';
      return;
    }

    this.elements.toc.innerHTML = entries
      .map(
        (entry) => `
          <button data-target="${entry.id}">
            ${this.escapeHtml(entry.title)}
            <span>${entry.count}</span>
          </button>
        `
      )
      .join('');
  },

  renderPinned() {
    if (!this.elements.pinned) return;
    const source =
      this.mode === 'ai' && this.aiSnapshot
        ? this.aiSnapshot.sections?.flatMap((section) => section.bookmarks || []) || []
        : this.bookmarks;

    if (!source.length) {
      this.elements.pinned.innerHTML = '<p class="sidebar-hint">暂无内容</p>';
      return;
    }

    const sorted = [...source].sort((a, b) => {
      const scoreA = SimpleSorter.calculatePopularity?.(a) || 0;
      const scoreB = SimpleSorter.calculatePopularity?.(b) || 0;
      return scoreB - scoreA;
    });

    const pinned = sorted.slice(0, 5);
    this.elements.pinned.innerHTML = pinned
      .map(
        (bookmark) => `
          <div class="wiki-pinned-card">
            <h4>${this.escapeHtml(bookmark.title || '')}</h4>
            <p>${this.escapeHtml(bookmark.summary || bookmark.description || bookmark.url || '')}</p>
          </div>
        `
      )
      .join('');
  },

  bindBookmarkActions() {
    const container = this.elements.content;
    if (!container) return;

    container.querySelectorAll('.wiki-bookmark-action').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'open') {
          this.openBookmark(id);
        } else if (action === 'edit' && window.App?.editBookmark) {
          window.App.editBookmark(id);
        }
      });
    });

    container.querySelectorAll('.wiki-bookmark a').forEach((link) => {
      link.addEventListener('click', () => {
        const card = link.closest('.wiki-bookmark');
        const id = card?.dataset.id;
        if (id && this.mode === 'local' && window.BookmarkManager?.recordVisit) {
          window.BookmarkManager.recordVisit(id);
        }
      });
    });
  },

  renderPaletteResults(query = '') {
    if (!this.elements.paletteResults) return;
    const normalized = query.toLowerCase();
    const source =
      this.mode === 'ai' && this.aiSnapshot
        ? this.aiSnapshot.sections?.flatMap((section) => section.bookmarks || []) || []
        : this.bookmarks;

    const bookmarkMatches = source
      .filter((bookmark) => {
        if (!normalized) return true;
        return (
          (bookmark.title || '').toLowerCase().includes(normalized) ||
          (bookmark.url || '').toLowerCase().includes(normalized)
        );
      })
      .slice(0, 8)
      .map((bookmark) => ({
        type: 'bookmark',
        id: bookmark.id || bookmark.url,
        title: bookmark.title || bookmark.url,
        description: bookmark.url
      }));

    const categoryMatches =
      this.mode === 'ai' && this.aiSnapshot
        ? []
        : this.categories
            .filter((category) => {
              if (!normalized) return false;
              return (category.name || '').toLowerCase().includes(normalized);
            })
            .slice(0, 4)
            .map((category) => ({
              type: 'category',
              id: category.id || 'uncategorized',
              title: `跳转到：${category.name}`,
              description: category.description || ''
            }));

    this.palette.results = [...categoryMatches, ...bookmarkMatches];
    this.palette.activeIndex = 0;

    if (!this.palette.results.length) {
      this.elements.paletteResults.innerHTML = '<div class="command-item"><p>没有匹配的结果</p></div>';
      return;
    }

    this.elements.paletteResults.innerHTML = this.palette.results
      .map(
        (item, index) => `
          <div class="command-item ${index === 0 ? 'active' : ''}" data-id="${item.id}" data-type="${item.type}">
            <div>
              <h5>${this.escapeHtml(item.title || '')}</h5>
              ${item.description ? `<p>${this.escapeHtml(item.description)}</p>` : ''}
            </div>
            <span>${item.type === 'bookmark' ? '书签' : '目录'}</span>
          </div>
        `
      )
      .join('');
  },

  togglePalette(shouldOpen) {
    if (!this.elements.palette) return;
    this.palette.open = shouldOpen;
    this.elements.palette.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
      this.elements.paletteInput.value = '';
      this.elements.paletteInput.focus();
      this.renderPaletteResults('');
    } else {
      this.elements.paletteInput.blur();
    }
  },

  handlePaletteKeys(key) {
    if (!this.palette.results.length) return;
    const maxIndex = this.palette.results.length - 1;

    if (key === 'ArrowDown') {
      this.palette.activeIndex = Math.min(maxIndex, this.palette.activeIndex + 1);
    } else if (key === 'ArrowUp') {
      this.palette.activeIndex = Math.max(0, this.palette.activeIndex - 1);
    } else if (key === 'Enter') {
      const item = this.palette.results[this.palette.activeIndex];
      if (item) {
        this.navigateFromPalette({ id: item.id, type: item.type });
      }
      return;
    }

    this.highlightActivePaletteItem();
  },

  highlightActivePaletteItem() {
    this.elements.paletteResults
      ?.querySelectorAll('.command-item')
      .forEach((node, index) => node.classList.toggle('active', index === this.palette.activeIndex));
  },

  navigateFromPalette({ id, type }) {
    if (type === 'bookmark') {
      this.openBookmark(id);
      this.togglePalette(false);
    } else if (type === 'category') {
      const section = document.getElementById(`wiki-category-${id}`) || document.getElementById(`wiki-category-uncategorized`);
      section?.scrollIntoView({ behavior: 'smooth' });
      this.togglePalette(false);
    }
  },

  openBookmark(id) {
    const bookmark =
      this.bookmarks.find((item) => String(item.id) === String(id)) ||
      this.aiSnapshot?.sections?.flatMap((section) => section.bookmarks || []).find((item) => item.url === id);
    if (bookmark?.url) {
      window.open(bookmark.url, '_blank', 'noopener');
    }
  },

  toggleEmptyState(isEmpty, query) {
    if (!this.elements.emptyState) return;
    this.elements.emptyState.classList.toggle('hidden', !isEmpty);
    if (isEmpty && query) {
      this.elements.emptyState.innerHTML = `<p>没有找到与 <strong>${this.escapeHtml(query)}</strong> 匹配的书签</p>`;
    } else if (isEmpty) {
      this.elements.emptyState.innerHTML = '<p>暂无数据</p>';
    }
  },

  updateAiStatus(text, tone) {
    if (!this.elements.aiStatus) return;
    this.elements.aiStatus.textContent = text;
    this.elements.aiStatus.dataset.tone = tone || 'muted';
  },

  formatRelativeTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';

    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    return date.toLocaleDateString();
  },

  formatTimestamp(value) {
    if (!value) return '未知时间';
    try {
      const date = new Date(value);
      return date.toLocaleString();
    } catch {
      return value;
    }
  },

  highlight(text, query) {
    if (!text) return '';
    if (!query) return this.escapeHtml(text);
    const safe = this.escapeHtml(text);
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return safe.replace(regex, '<mark>$1</mark>');
  },

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  debounce(fn, wait = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }
};

window.WikiView = WikiView;
