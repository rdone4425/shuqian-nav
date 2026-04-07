const AUTH_VERIFY_CACHE_MS = 5 * 60 * 1000;
const AUTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const Auth = {
  isAuthenticated: false,
  currentUser: null,
  lastVerificationTime: null,
  verificationFailureCount: 0,
  authCheckTimer: null,
  visibilityHandlerBound: false,

  listeners: {
    login: [],
    logout: [],
    authChange: [],
  },

  async init() {
    const token = AuthAPI.getToken();
    if (!token) {
      this.resetState(false);
      return false;
    }

    const isValid = await this.verifyToken();
    if (!isValid) {
      AuthAPI.removeToken();
      this.resetState(false);
      return false;
    }

    this.setAuthenticatedState();
    return true;
  },

  async login(password) {
    try {
      const response = await AuthAPI.login(password);
      if (!response.success) {
        return {
          success: false,
          error: response.error || "登录失败",
          isDefaultPassword: Boolean(response.isDefaultPassword),
          requirePasswordChange: Boolean(response.requirePasswordChange),
        };
      }

      const token = response.data?.token || response.token;
      if (!token) {
        throw new Error("登录响应缺少令牌");
      }

      AuthAPI.setToken(token);
      this.setAuthenticatedState();
      this.triggerEvent("login", { user: this.currentUser });
      this.triggerEvent("authChange", { authenticated: true });

      return {
        success: true,
        message: response.message || "登录成功",
        isDefaultPassword: Boolean(response.isDefaultPassword),
        requirePasswordChange: Boolean(response.requirePasswordChange),
      };
    } catch (error) {
      console.error("登录失败:", error);
      return {
        success: false,
        error: error.message || "网络连接异常",
      };
    }
  },

  async logout() {
    try {
      AuthAPI.removeToken();
      this.resetState(false);
      this.triggerEvent("logout", {});
      this.triggerEvent("authChange", { authenticated: false });
      return {
        success: true,
        message: "已退出登录",
      };
    } catch (error) {
      console.error("退出登录失败:", error);
      return {
        success: false,
        error: error.message || "退出登录失败",
      };
    }
  },

  async verifyToken() {
    const token = AuthAPI.getToken();
    if (!token) {
      return false;
    }

    try {
      const response = await AuthAPI.verifyToken();
      const isValid = response.success === true;

      if (isValid) {
        this.setAuthenticatedState();
        this.verificationFailureCount = 0;
      }

      return isValid;
    } catch (error) {
      console.error("令牌校验失败:", error);
      return false;
    }
  },

  checkAuthenticated() {
    if (!AuthAPI.isLoggedIn()) {
      this.resetState(false);
      return false;
    }

    if (
      this.isAuthenticated &&
      this.lastVerificationTime &&
      Date.now() - this.lastVerificationTime < AUTH_VERIFY_CACHE_MS
    ) {
      return true;
    }

    this.verifyTokenAsync();
    return true;
  },

  async verifyTokenAsync() {
    try {
      const isValid = await this.verifyToken();
      if (!isValid) {
        await this.logout();
        this.redirectToLogin();
      }
    } catch (error) {
      console.error("异步校验失败:", error);
      this.verificationFailureCount += 1;
      if (this.verificationFailureCount >= 3) {
        await this.logout();
        this.redirectToLogin();
      }
    }
  },

  getCurrentUser() {
    return this.currentUser;
  },

  getToken() {
    return AuthAPI.getToken();
  },

  hasPermission() {
    return this.isAuthenticated && this.currentUser?.role === "admin";
  },

  requireAuth() {
    if (!this.checkAuthenticated()) {
      this.redirectToLogin();
      return false;
    }

    return true;
  },

  redirectToLogin() {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (window.location.pathname.includes("login.html")) {
      return;
    }

    localStorage.setItem("redirect_after_login", currentPath);
    window.location.href = "/login.html";
  },

  redirectAfterLogin() {
    const redirectPath = localStorage.getItem("redirect_after_login") || "/";
    localStorage.removeItem("redirect_after_login");

    if (!redirectPath || redirectPath.includes("login.html")) {
      window.location.href = "/";
      return;
    }

    window.location.href = redirectPath;
  },

  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  },

  removeEventListener(event, callback) {
    if (!this.listeners[event]) {
      return;
    }

    this.listeners[event] = this.listeners[event].filter(
      (item) => item !== callback,
    );
  },

  triggerEvent(event, data) {
    if (!this.listeners[event]) {
      return;
    }

    this.listeners[event].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`认证事件处理失败: ${event}`, error);
      }
    });
  },

  async refreshToken() {
    return true;
  },

  isTokenExpiringSoon() {
    const token = AuthAPI.getToken();
    if (!token) {
      return false;
    }

    try {
      const payloadSegment = token.split(".")[1];
      if (!payloadSegment) {
        return false;
      }

      const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(normalized));
      if (!payload.exp) {
        return false;
      }

      return payload.exp * 1000 - Date.now() < 60 * 60 * 1000;
    } catch (error) {
      console.error("解析令牌过期时间失败:", error);
      return false;
    }
  },

  startAuthCheck() {
    if (this.authCheckTimer) {
      clearInterval(this.authCheckTimer);
    }

    this.authCheckTimer = setInterval(async () => {
      if (!AuthAPI.isLoggedIn()) {
        return;
      }

      const isValid = await this.verifyToken();
      if (!isValid) {
        await this.logout();
        this.redirectToLogin();
      }
    }, AUTH_CHECK_INTERVAL_MS);
  },

  handleVisibilityChange() {
    if (this.visibilityHandlerBound) {
      return;
    }

    document.addEventListener("visibilitychange", async () => {
      if (document.hidden || !AuthAPI.isLoggedIn()) {
        return;
      }

      const isValid = await this.verifyToken();
      if (!isValid) {
        await this.logout();
        this.redirectToLogin();
      }
    });

    this.visibilityHandlerBound = true;
  },

  setAuthenticatedState() {
    this.isAuthenticated = true;
    this.currentUser = { role: "admin" };
    this.lastVerificationTime = Date.now();
  },

  resetState(isAuthenticated = false) {
    this.isAuthenticated = isAuthenticated;
    this.currentUser = isAuthenticated ? { role: "admin" } : null;
    this.lastVerificationTime = isAuthenticated ? Date.now() : null;
    this.verificationFailureCount = 0;
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
  Auth.startAuthCheck();
  Auth.handleVisibilityChange();
});

window.Auth = Auth;
