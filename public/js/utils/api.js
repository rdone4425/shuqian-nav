// API请求工具模块
// 提供统一的API请求接口，包含认证、错误处理和重试机制

const API = {
  // 基础配置
  config: {
    baseURL: window.location.origin,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  },

  // 请求拦截器
  interceptors: {
    request: [],
    response: []
  },

  // 添加请求拦截器
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  },

  // 添加响应拦截器
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  },

  // 获取认证头
  getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  // 基础请求方法
  async request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;
    
    // 默认选项
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.getAuthHeaders()
      },
      timeout: this.config.timeout
    };

    // 合并选项
    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    // 应用请求拦截器
    for (const interceptor of this.interceptors.request) {
      await interceptor(finalOptions);
    }

    let lastError;
    
    // 重试机制
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
        
        const response = await fetch(fullUrl, {
          ...finalOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        // 应用响应拦截器
        for (const interceptor of this.interceptors.response) {
          await interceptor(response);
        }

        // 检查响应状态
        if (!response.ok) {
          const errorData = await this.parseResponse(response);
          throw new APIError(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
          );
        }

        return await this.parseResponse(response);

      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试或者是不可重试的错误，直接抛出
        if (attempt === this.config.retryAttempts || !this.shouldRetry(error)) {
          break;
        }
        
        // 等待后重试
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError;
  },

  // 解析响应
  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  },

  // 判断是否应该重试
  shouldRetry(error) {
    // 网络错误或超时错误可以重试
    if (error.name === 'AbortError' || error.name === 'TypeError') {
      return true;
    }
    
    // 5xx服务器错误可以重试
    if (error instanceof APIError && error.status >= 500) {
      return true;
    }
    
    return false;
  },

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // GET请求
  async get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    return await this.request(fullUrl, {
      method: 'GET'
    });
  },

  // POST请求
  async post(url, data = {}) {
    return await this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // PUT请求
  async put(url, data = {}) {
    return await this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // DELETE请求
  async delete(url) {
    return await this.request(url, {
      method: 'DELETE'
    });
  },

  // 上传文件
  async upload(url, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    for (const [key, value] of Object.entries(additionalData)) {
      formData.append(key, value);
    }

    return await this.request(url, {
      method: 'POST',
      body: formData,
      headers: {
        // 不设置Content-Type，让浏览器自动设置
        ...this.getAuthHeaders()
      }
    });
  },

  // 健康检查
  async healthCheck() {
    try {
      const response = await this.get('/api/health');
      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
};

// 自定义API错误类
class APIError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

// 书签相关API
const BookmarkAPI = {
  // 获取书签列表
  async getBookmarks(params = {}) {
    return await API.get('/api/bookmarks', params);
  },

  // 获取单个书签
  async getBookmark(id) {
    return await API.get(`/api/bookmarks/${id}`);
  },

  // 创建书签
  async createBookmark(data) {
    return await API.post('/api/bookmarks', data);
  },

  // 更新书签
  async updateBookmark(id, data) {
    return await API.put(`/api/bookmarks/${id}`, data);
  },

  // 删除书签
  async deleteBookmark(id, options = {}) {
    const deleteData = {
      reason: options.reason || 'manual_delete',
      checkStatus: options.checkStatus || null,
      statusCode: options.statusCode || null,
      statusText: options.statusText || null,
      errorMessage: options.errorMessage || null,
      keepStatus: options.keepStatus || null
    };

    return await API.request(`/api/bookmarks/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deleteData)
    });
  },

  // 获取分类列表
  async getCategories() {
    return await API.get('/api/bookmarks/categories');
  },

  // 创建分类
  async createCategory(data) {
    return await API.post('/api/bookmarks/categories', data);
  },

  // 记录书签访问
  async recordVisit(id) {
    return await API.post(`/api/bookmarks/${id}/visit`, {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer
    });
  },

  async getAIWikiSnapshot() {
    return await API.get('/api/wiki');
  },

  async generateAIWiki() {
    return await API.post('/api/wiki');
  }
};

// 认证相关API
const AuthAPI = {
  // 获取存储的令牌
  getToken() {
    return localStorage.getItem('auth_token');
  },

  // 保存令牌
  setToken(token) {
    localStorage.setItem('auth_token', token);
  },

  // 移除令牌
  removeToken() {
    localStorage.removeItem('auth_token');
  },

  // 检查是否已登录
  isLoggedIn() {
    return !!this.getToken();
  },

  // 登录
  async login(password) {
    const response = await API.post('/api/auth/login', { password });
    if (response.success) {
      // 兼容不同的响应格式
      const token = response.data?.token || response.token;
      if (token) {
        this.setToken(token);
      }
    }
    return response;
  },

  // 验证令牌
  async verifyToken() {
    return await API.post('/api/auth/verify');
  },

  // 退出登录
  logout() {
    this.removeToken();
    window.location.href = '/login.html';
  },

  // 修改密码
  async changePassword(currentPassword, newPassword, confirmPassword) {
    return await API.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword
    });
  }
};

// 添加默认的响应拦截器来处理认证错误
API.addResponseInterceptor(async (response) => {
  if (response.status === 401) {
    // 清除无效的令牌
    localStorage.removeItem('auth_token');

    // 如果不在登录页面，跳转到登录页面
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/login.html';
    }
  }
});

// 系统初始化API
const SystemAPI = {
  // 检查数据库初始化状态（不需要认证）
  // 清除示例数据
  async clearSampleData() {
    return await API.post('/api/system/clear-sample-data');
  },

  // 重置数据库
  async resetDatabase() {
    return await API.post('/api/system/reset-database');
  },

  // 完整备份（不受数量限制）
  async createBackup(format = 'json') {
    const response = await fetch('/api/system/backup?format=' + format, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Accept': format === 'json' ? 'application/json' : 'text/html'
      }
    });

    if (!response.ok) {
      throw new Error(`备份失败: ${response.status} ${response.statusText}`);
    }

    return response;
  },

  async getConfig() {
    return await API.get('/api/system/config');
  },

  async updateConfig(key, value) {
    return await API.post('/api/system/config', {
      config_key: key,
      config_value: value
    });
  }
};

// 应用启动时自动检查初始化
// 导出到全局作用域
window.API = API;
window.APIError = APIError;
window.BookmarkAPI = BookmarkAPI;
window.AuthAPI = AuthAPI;
window.SystemAPI = SystemAPI;
