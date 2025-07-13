// 认证管理模块
// 处理用户登录、令牌验证和权限管理

const Auth = {
  // 认证状态
  isAuthenticated: false,
  currentUser: null,
  lastVerificationTime: null,
  verificationFailureCount: 0,
  
  // 事件监听器
  listeners: {
    login: [],
    logout: [],
    authChange: []
  },

  // 初始化认证模块
  async init() {
    try {
      // 检查本地存储的令牌
      const token = AuthAPI.getToken();
      if (token) {
        // 验证令牌有效性
        const isValid = await this.verifyToken();
        if (isValid) {
          this.isAuthenticated = true;
          this.currentUser = { role: 'admin' };
          this.lastVerificationTime = Date.now();
          this.verificationFailureCount = 0;
          this.triggerEvent('authChange', { authenticated: true });
        } else {
          // 令牌无效，清除本地存储
          AuthAPI.removeToken();
          this.isAuthenticated = false;
          this.currentUser = null;
          this.lastVerificationTime = null;
        }
      }
      
      return this.isAuthenticated;
    } catch (error) {
      console.error('认证初始化失败:', error);
      this.verificationFailureCount = (this.verificationFailureCount || 0) + 1;
      return false;
    }
  },

  // 登录
  async login(password) {
    try {
      const response = await AuthAPI.login(password);
      
      if (response.success) {
        // 兼容不同的响应格式
        const token = response.data?.token || response.token;
        if (token) {
          // 保存令牌
          AuthAPI.setToken(token);

          // 更新认证状态
          this.isAuthenticated = true;
          this.currentUser = { role: 'admin' };
          this.lastVerificationTime = Date.now();
          this.verificationFailureCount = 0;

          // 触发登录事件
          this.triggerEvent('login', { user: this.currentUser });
          this.triggerEvent('authChange', { authenticated: true });

          return {
            success: true,
            message: response.message || '登录成功'
          };
        } else {
          throw new Error('登录响应中缺少令牌');
        }
      } else {
        return {
          success: false,
          error: response.error || '登录失败'
        };
      }
    } catch (error) {
      console.error('登录错误:', error);
      return {
        success: false,
        error: error.message || '网络连接异常'
      };
    }
  },

  // 登出
  async logout() {
    try {
      // 清除本地存储
      AuthAPI.removeToken();
      
      // 重置认证状态
      this.isAuthenticated = false;
      this.currentUser = null;
      this.lastVerificationTime = null;
      this.verificationFailureCount = 0;
      
      // 触发登出事件
      this.triggerEvent('logout', {});
      this.triggerEvent('authChange', { authenticated: false });
      
      return {
        success: true,
        message: '已成功登出'
      };
    } catch (error) {
      console.error('登出错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 验证令牌
  async verifyToken() {
    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return false;
      }

      const response = await AuthAPI.verifyToken();
      return response.success === true;
    } catch (error) {
      console.error('令牌验证失败:', error);
      return false;
    }
  },

  // 检查是否已认证
  checkAuthenticated() {
    // 首先检查localStorage中是否有token
    const hasToken = AuthAPI.isLoggedIn();
    if (!hasToken) {
      this.isAuthenticated = false;
      return false;
    }

    // 如果内存状态已经是认证的且最近验证过，直接返回true
    if (this.isAuthenticated && this.lastVerificationTime) {
      const timeSinceLastVerification = Date.now() - this.lastVerificationTime;
      // 如果5分钟内验证过，直接返回true
      if (timeSinceLastVerification < 5 * 60 * 1000) {
        return true;
      }
    }

    // 异步验证token有效性，但不阻塞当前操作
    this.verifyTokenAsync();
    
    // 如果有token，暂时认为是已认证的
    // 如果token无效，异步验证会处理登出
    return hasToken;
  },

  // 异步验证token有效性
  async verifyTokenAsync() {
    try {
      const isValid = await this.verifyToken();
      if (isValid) {
        this.isAuthenticated = true;
        this.lastVerificationTime = Date.now();
      } else {
        console.warn('Token验证失败，自动登出');
        await this.logout();
        this.redirectToLogin();
      }
    } catch (error) {
      console.error('异步token验证错误:', error);
      // 网络错误不强制登出，除非多次失败
      this.verificationFailureCount = (this.verificationFailureCount || 0) + 1;
      if (this.verificationFailureCount > 3) {
        console.warn('多次验证失败，强制登出');
        await this.logout();
        this.redirectToLogin();
      }
    }
  },

  // 获取当前用户
  getCurrentUser() {
    return this.currentUser;
  },

  // 获取认证令牌
  getToken() {
    return AuthAPI.getToken();
  },

  // 检查权限
  hasPermission(permission) {
    if (!this.isAuthenticated) {
      return false;
    }
    
    // 管理员拥有所有权限
    if (this.currentUser?.role === 'admin') {
      return true;
    }
    
    // 这里可以扩展更复杂的权限检查逻辑
    return false;
  },

  // 要求认证
  requireAuth() {
    if (!this.checkAuthenticated()) {
      this.redirectToLogin();
      return false;
    }
    return true;
  },

  // 跳转到登录页面
  redirectToLogin() {
    const currentPath = window.location.pathname;
    const loginUrl = '/login.html';
    
    // 如果已经在登录页面，不需要跳转
    if (currentPath.includes('login.html')) {
      return;
    }
    
    // 保存当前页面，登录后可以跳转回来
    localStorage.setItem('redirect_after_login', currentPath);
    
    window.location.href = loginUrl;
  },

  // 登录后跳转
  redirectAfterLogin() {
    const redirectPath = localStorage.getItem('redirect_after_login') || '/';
    localStorage.removeItem('redirect_after_login');
    
    // 避免跳转到登录页面
    if (redirectPath.includes('login.html')) {
      window.location.href = '/';
    } else {
      window.location.href = redirectPath;
    }
  },

  // 添加事件监听器
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  },

  // 移除事件监听器
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  },

  // 触发事件
  triggerEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件监听器错误 (${event}):`, error);
        }
      });
    }
  },

  // 自动刷新令牌（如果需要）
  async refreshToken() {
    try {
      // 这里可以实现令牌刷新逻辑
      // 目前的实现中，令牌有24小时有效期，暂不需要刷新
      return true;
    } catch (error) {
      console.error('令牌刷新失败:', error);
      return false;
    }
  },

  // 检查令牌是否即将过期
  isTokenExpiringSoon() {
    try {
      const token = Storage.auth.getToken();
      if (!token) {
        return false;
      }

      // 解析JWT令牌（简单实现，生产环境建议使用专门的JWT库）
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // 转换为毫秒
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      // 如果令牌在1小时内过期，返回true
      return timeUntilExpiration < 60 * 60 * 1000;
    } catch (error) {
      console.error('检查令牌过期时间失败:', error);
      return false;
    }
  },

  // 定期检查认证状态
  startAuthCheck() {
    // 每5分钟检查一次认证状态
    setInterval(async () => {
      if (this.checkAuthenticated()) {
        const isValid = await this.verifyToken();
        if (!isValid) {
          console.warn('令牌已失效，自动登出');
          await this.logout();
          this.redirectToLogin();
        }
      }
    }, 5 * 60 * 1000);
  },

  // 页面可见性变化时检查认证状态
  handleVisibilityChange() {
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && this.checkAuthenticated()) {
        // 页面重新可见时，检查令牌是否仍然有效
        const isValid = await this.verifyToken();
        if (!isValid) {
          console.warn('令牌已失效，需要重新登录');
          await this.logout();
          this.redirectToLogin();
        }
      }
    });
  }
};

// 页面加载时初始化认证模块
document.addEventListener('DOMContentLoaded', async () => {
  await Auth.init();
  Auth.startAuthCheck();
  Auth.handleVisibilityChange();
});

// 导出到全局作用域
window.Auth = Auth;
