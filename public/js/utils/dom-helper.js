/**
 * DOM操作助手 - 减少重复的DOM查询和操作
 */

class DOMHelper {
  // 缓存DOM元素引用
  static elementCache = new Map();
  
  /**
   * 批量获取DOM元素并缓存
   */
  static getElements(selectors) {
    const elements = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      // 先检查缓存
      if (this.elementCache.has(selector)) {
        elements[key] = this.elementCache.get(selector);
      } else {
        const element = document.getElementById(selector) || 
                       document.querySelector(selector);
        elements[key] = element;
        if (element) {
          this.elementCache.set(selector, element);
        }
      }
    }
    
    return elements;
  }

  /**
   * 快速获取单个元素
   */
  static get(selector) {
    if (this.elementCache.has(selector)) {
      return this.elementCache.get(selector);
    }
    
    const element = document.getElementById(selector) || 
                   document.querySelector(selector);
    if (element) {
      this.elementCache.set(selector, element);
    }
    
    return element;
  }

  /**
   * 批量设置元素显示/隐藏
   */
  static setDisplay(elements, display = 'block') {
    const elementsList = Array.isArray(elements) ? elements : [elements];
    
    elementsList.forEach(element => {
      if (typeof element === 'string') {
        element = this.get(element);
      }
      if (element) {
        element.style.display = display;
      }
    });
  }

  /**
   * 批量隐藏元素
   */
  static hide(...elements) {
    this.setDisplay(elements, 'none');
  }

  /**
   * 批量显示元素
   */
  static show(...elements) {
    this.setDisplay(elements, 'block');
  }

  /**
   * 切换元素显示状态
   */
  static toggle(element) {
    if (typeof element === 'string') {
      element = this.get(element);
    }
    if (element) {
      const isHidden = element.style.display === 'none' || 
                      getComputedStyle(element).display === 'none';
      element.style.display = isHidden ? 'block' : 'none';
    }
  }

  /**
   * 批量添加事件监听器
   */
  static addEventListeners(eventMap) {
    for (const [selector, events] of Object.entries(eventMap)) {
      const element = this.get(selector);
      if (element) {
        for (const [eventType, handler] of Object.entries(events)) {
          element.addEventListener(eventType, handler);
        }
      }
    }
  }

  /**
   * 设置元素内容
   */
  static setContent(selector, content, type = 'text') {
    const element = this.get(selector);
    if (element) {
      if (type === 'html') {
        element.innerHTML = content;
      } else {
        element.textContent = content;
      }
    }
  }

  /**
   * 批量设置属性
   */
  static setAttributes(selector, attributes) {
    const element = this.get(selector);
    if (element) {
      for (const [attr, value] of Object.entries(attributes)) {
        element.setAttribute(attr, value);
      }
    }
  }

  /**
   * 添加CSS类
   */
  static addClass(selector, className) {
    const element = this.get(selector);
    if (element) {
      element.classList.add(className);
    }
  }

  /**
   * 移除CSS类
   */
  static removeClass(selector, className) {
    const element = this.get(selector);
    if (element) {
      element.classList.remove(className);
    }
  }

  /**
   * 切换CSS类
   */
  static toggleClass(selector, className) {
    const element = this.get(selector);
    if (element) {
      element.classList.toggle(className);
    }
  }

  /**
   * 清空缓存
   */
  static clearCache() {
    this.elementCache.clear();
  }

  /**
   * 创建分页控件的通用方法
   */
  static createPagination(container, currentPage, totalPages, onPageChange) {
    const element = this.get(container);
    if (!element || totalPages <= 1) {
      if (element) element.innerHTML = '';
      return;
    }

    // 创建分页HTML
    let html = '<div class="pagination">';
    
    // 上一页按钮
    const prevDisabled = currentPage <= 1 ? 'disabled' : '';
    html += `<button class="pagination-btn ${prevDisabled}" 
             onclick="(${onPageChange})(${Math.max(1, currentPage - 1)})">上一页</button>`;

    // 页码按钮
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      html += `<button class="pagination-btn" onclick="(${onPageChange})(1)">1</button>`;
      if (startPage > 2) {
        html += '<span class="pagination-ellipsis">...</span>';
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? 'active' : '';
      html += `<button class="pagination-btn ${activeClass}" 
               onclick="(${onPageChange})(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += '<span class="pagination-ellipsis">...</span>';
      }
      html += `<button class="pagination-btn" onclick="(${onPageChange})(${totalPages})">${totalPages}</button>`;
    }

    // 下一页按钮
    const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
    html += `<button class="pagination-btn ${nextDisabled}" 
             onclick="(${onPageChange})(${Math.min(totalPages, currentPage + 1)})">下一页</button>`;

    html += '</div>';
    element.innerHTML = html;
  }

  /**
   * 通用状态切换方法
   */
  static setState(stateName, options = {}) {
    const {
      container = 'content',
      message = '',
      showRetry = false,
      onRetry = null
    } = options;

    // 隐藏所有状态
    this.hide('loadingState', 'errorState', 'emptyState', 'content');

    switch (stateName) {
      case 'loading':
        this.show('loadingState');
        break;
      case 'error':
        this.show('errorState');
        if (message) {
          this.setContent('errorMessage', message);
        }
        if (showRetry && onRetry) {
          const retryBtn = this.get('retryBtn');
          if (retryBtn) {
            retryBtn.onclick = onRetry;
            this.show('retryBtn');
          }
        }
        break;
      case 'empty':
        this.show('emptyState');
        if (message) {
          this.setContent('emptyMessage', message);
        }
        break;
      case 'content':
        this.show(container);
        break;
    }
  }
}

// 全局暴露
window.DOMHelper = DOMHelper;