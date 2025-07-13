// 本地存储工具模块
// 提供统一的本地存储接口，支持JWT令牌和用户偏好设置

const Storage = {
  // 存储键名常量
  KEYS: {
    AUTH_TOKEN: 'bookmark_auth_token',
    USER_PREFERENCES: 'bookmark_user_preferences',
    LAST_SEARCH: 'bookmark_last_search',
    VIEW_MODE: 'bookmark_view_mode',
    SORT_PREFERENCE: 'bookmark_sort_preference'
  },

  // 获取存储项
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      
      // 尝试解析JSON，如果失败则返回原始字符串
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    } catch (error) {
      console.warn('获取存储项失败:', error);
      return defaultValue;
    }
  },

  // 设置存储项
  set(key, value) {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error('设置存储项失败:', error);
      return false;
    }
  },

  // 删除存储项
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('删除存储项失败:', error);
      return false;
    }
  },

  // 清空所有存储
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('清空存储失败:', error);
      return false;
    }
  },

  // 检查存储项是否存在
  has(key) {
    return localStorage.getItem(key) !== null;
  },

  // 获取所有键名
  keys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('获取存储键名失败:', error);
      return [];
    }
  },

  // 获取存储大小（近似值）
  getSize() {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return total;
    } catch (error) {
      console.error('计算存储大小失败:', error);
      return 0;
    }
  },

  // 认证令牌相关方法
  auth: {
    // 获取认证令牌
    getToken() {
      return Storage.get(Storage.KEYS.AUTH_TOKEN);
    },

    // 设置认证令牌
    setToken(token) {
      return Storage.set(Storage.KEYS.AUTH_TOKEN, token);
    },

    // 删除认证令牌
    removeToken() {
      return Storage.remove(Storage.KEYS.AUTH_TOKEN);
    },

    // 检查是否有有效令牌
    hasToken() {
      const token = Storage.auth.getToken();
      return token && token.length > 0;
    }
  },

  // 用户偏好设置
  preferences: {
    // 获取所有偏好设置
    getAll() {
      return Storage.get(Storage.KEYS.USER_PREFERENCES, {
        viewMode: 'grid',
        sortBy: 'created_at',
        sortOrder: 'desc',
        itemsPerPage: 20,
        showDescriptions: true,
        autoRefresh: false
      });
    },

    // 设置偏好
    set(key, value) {
      const preferences = Storage.preferences.getAll();
      preferences[key] = value;
      return Storage.set(Storage.KEYS.USER_PREFERENCES, preferences);
    },

    // 获取单个偏好
    get(key, defaultValue = null) {
      const preferences = Storage.preferences.getAll();
      return preferences[key] !== undefined ? preferences[key] : defaultValue;
    },

    // 重置偏好设置
    reset() {
      return Storage.remove(Storage.KEYS.USER_PREFERENCES);
    }
  },

  // 搜索历史
  search: {
    // 获取最后搜索
    getLast() {
      return Storage.get(Storage.KEYS.LAST_SEARCH, {
        query: '',
        category: '',
        timestamp: null
      });
    },

    // 保存搜索
    save(query, category = '') {
      return Storage.set(Storage.KEYS.LAST_SEARCH, {
        query,
        category,
        timestamp: Date.now()
      });
    },

    // 清除搜索历史
    clear() {
      return Storage.remove(Storage.KEYS.LAST_SEARCH);
    }
  },

  // 视图模式
  viewMode: {
    // 获取视图模式
    get() {
      return Storage.get(Storage.KEYS.VIEW_MODE, 'grid');
    },

    // 设置视图模式
    set(mode) {
      return Storage.set(Storage.KEYS.VIEW_MODE, mode);
    }
  },

  // 排序偏好
  sort: {
    // 获取排序偏好
    get() {
      return Storage.get(Storage.KEYS.SORT_PREFERENCE, {
        sortBy: 'created_at',
        sortOrder: 'desc'
      });
    },

    // 设置排序偏好
    set(sortBy, sortOrder) {
      return Storage.set(Storage.KEYS.SORT_PREFERENCE, {
        sortBy,
        sortOrder
      });
    }
  },

  // 数据导出
  export() {
    try {
      const data = {};
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key) && key.startsWith('bookmark_')) {
          data[key] = localStorage[key];
        }
      }
      return {
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('导出数据失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 数据导入
  import(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('无效的导入数据格式');
      }

      let importedCount = 0;
      for (let key in data.data || data) {
        if (key.startsWith('bookmark_')) {
          localStorage.setItem(key, data.data ? data.data[key] : data[key]);
          importedCount++;
        }
      }

      return {
        success: true,
        importedCount: importedCount,
        message: `成功导入 ${importedCount} 项设置`
      };
    } catch (error) {
      console.error('导入数据失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// 导出到全局作用域
window.Storage = Storage;
