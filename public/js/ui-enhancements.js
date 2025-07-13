// 视图切换和UI增强功能
class ViewManager {
  constructor() {
    this.currentView = 'grid'; // 'grid' 或 'list'
    this.bookmarksGrid = null;
    this.init();
  }

  init() {
    this.bookmarksGrid = document.getElementById('bookmarksGrid');
    this.bindViewControls();
    this.enhanceUI();
  }

  bindViewControls() {
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');

    gridViewBtn?.addEventListener('click', () => {
      this.switchView('grid');
    });

    listViewBtn?.addEventListener('click', () => {
      this.switchView('list');
    });
  }

  switchView(viewType) {
    this.currentView = viewType;
    
    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    if (viewType === 'grid') {
      document.getElementById('gridViewBtn')?.classList.add('active');
      this.bookmarksGrid?.classList.remove('list-view');
    } else {
      document.getElementById('listViewBtn')?.classList.add('active');
      this.bookmarksGrid?.classList.add('list-view');
    }

    // 保存用户偏好
    localStorage.setItem('bookmark_view_preference', viewType);
  }

  enhanceUI() {
    // 恢复用户视图偏好
    const savedView = localStorage.getItem('bookmark_view_preference') || 'grid';
    this.switchView(savedView);

    // 添加快捷键支持
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            this.switchView('grid');
            break;
          case '2':
            e.preventDefault();
            this.switchView('list');
            break;
        }
      }
    });

    // 添加书签卡片动画
    this.addCardAnimations();
  }

  addCardAnimations() {
    // 使用 Intersection Observer 实现卡片进入动画
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, index * 100);
        }
      });
    }, {
      threshold: 0.1
    });

    // 监听新添加的书签卡片
    const observeBookmarkCards = () => {
      document.querySelectorAll('.bookmark-card').forEach(card => {
        if (!card.hasAttribute('data-observed')) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          observer.observe(card);
          card.setAttribute('data-observed', 'true');
        }
      });
    };

    // 初始观察
    observeBookmarkCards();

    // 监听DOM变化，观察新添加的卡片
    const mutationObserver = new MutationObserver(() => {
      observeBookmarkCards();
    });

    mutationObserver.observe(this.bookmarksGrid || document.body, {
      childList: true,
      subtree: true
    });
  }

  // 添加书签卡片特殊状态
  markAsNew(bookmarkId) {
    const card = document.querySelector(`[data-id="${bookmarkId}"]`);
    if (card) {
      card.classList.add('new');
      // 3秒后移除NEW标识
      setTimeout(() => {
        card.classList.remove('new');
      }, 3000);
    }
  }

  markAsFeatured(bookmarkId) {
    const card = document.querySelector(`[data-id="${bookmarkId}"]`);
    if (card) {
      card.classList.add('featured');
    }
  }

  // 平滑滚动到书签
  scrollToBookmark(bookmarkId) {
    const card = document.querySelector(`[data-id="${bookmarkId}"]`);
    if (card) {
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      // 高亮效果
      card.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.5)';
      setTimeout(() => {
        card.style.boxShadow = '';
      }, 2000);
    }
  }
}

// 增强书签统计显示
class StatsEnhancer {
  constructor() {
    this.updateInterval = null;
  }

  startRealTimeUpdates() {
    // 每30秒更新一次统计
    this.updateInterval = setInterval(() => {
      this.updateBookmarkStats();
    }, 30000);
  }

  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async updateBookmarkStats() {
    try {
      // 获取最新统计数据
      const response = await fetch('/api/analytics?type=summary');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.displayStats(data.data);
        }
      }
    } catch (error) {
      console.log('统计更新失败:', error);
    }
  }

  displayStats(stats) {
    // 更新页面统计信息
    if (stats.summary) {
      const totalElement = document.getElementById('totalCount');
      if (totalElement) {
        totalElement.textContent = stats.summary.totalBookmarks || 0;
      }
    }

    // 显示热门书签提示
    if (stats.popularBookmarks && stats.popularBookmarks.length > 0) {
      stats.popularBookmarks.slice(0, 3).forEach(bookmark => {
        const card = document.querySelector(`[data-id="${bookmark.bookmarkId}"]`);
        if (card && bookmark.recentVisits > 5) {
          viewManager.markAsFeatured(bookmark.bookmarkId);
        }
      });
    }
  }
}

// 工具提示增强
class TooltipManager {
  constructor() {
    this.init();
  }

  init() {
    this.createTooltipContainer();
    this.bindTooltipEvents();
  }

  createTooltipContainer() {
    if (!document.getElementById('tooltip')) {
      const tooltip = document.createElement('div');
      tooltip.id = 'tooltip';
      tooltip.className = 'tooltip-container';
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.2s;
        max-width: 200px;
        word-wrap: break-word;
      `;
      document.body.appendChild(tooltip);
    }
  }

  bindTooltipEvents() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[title], [data-tooltip]');
      if (target) {
        const text = target.getAttribute('title') || target.getAttribute('data-tooltip');
        if (text) {
          this.showTooltip(e, text);
          // 清除原生title避免重复显示
          if (target.hasAttribute('title')) {
            target.setAttribute('data-original-title', target.getAttribute('title'));
            target.removeAttribute('title');
          }
        }
      }
    });

    document.addEventListener('mousemove', (e) => {
      this.updateTooltipPosition(e);
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-original-title], [data-tooltip]');
      if (target) {
        this.hideTooltip();
        // 恢复原生title
        if (target.hasAttribute('data-original-title')) {
          target.setAttribute('title', target.getAttribute('data-original-title'));
          target.removeAttribute('data-original-title');
        }
      }
    });
  }

  showTooltip(e, text) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = text;
    tooltip.style.opacity = '1';
    this.updateTooltipPosition(e);
  }

  hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.opacity = '0';
  }

  updateTooltipPosition(e) {
    const tooltip = document.getElementById('tooltip');
    const rect = tooltip.getBoundingClientRect();
    const x = e.clientX + 10;
    const y = e.clientY - rect.height - 10;

    tooltip.style.left = Math.min(x, window.innerWidth - rect.width - 10) + 'px';
    tooltip.style.top = Math.max(y, 10) + 'px';
  }
}

// 全局实例
let viewManager;
let statsEnhancer;
let tooltipManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  viewManager = new ViewManager();
  statsEnhancer = new StatsEnhancer();
  tooltipManager = new TooltipManager();

  // 启动实时统计更新
  statsEnhancer.startRealTimeUpdates();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (statsEnhancer) {
    statsEnhancer.stopRealTimeUpdates();
  }
});

// 导出到全局
window.viewManager = viewManager;
window.statsEnhancer = statsEnhancer;