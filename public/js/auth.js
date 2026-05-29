const Auth = {
  tokenKey: "bookmark_nav_token",
  userKey: "bookmark_nav_user",
  isAuthenticated: false,
  currentUser: null,
  listeners: {
    authChange: [],
  },

  async init({ requireAuth = true } = {}) {
    const token = this.getToken();
    if (!token) {
      this.setSignedOut();
      if (requireAuth) {
        this.redirectToLogin();
      }
      return false;
    }

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: this.getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Authentication failed.");
      }

      this.isAuthenticated = true;
      this.currentUser = data.user || { role: "admin" };
      localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
      this.triggerEvent("authChange", {
        authenticated: true,
        user: this.currentUser,
      });
      return true;
    } catch (error) {
      console.error("Auth verification failed:", error);
      this.logout({ redirect: requireAuth });
      return false;
    }
  },

  async login(password) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();

    if (!response.ok || !data.success || !data.token) {
      throw new Error(data.error || "Login failed.");
    }

    localStorage.setItem(this.tokenKey, data.token);
    this.currentUser = data.user || { role: "admin" };
    localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
    this.isAuthenticated = true;
    this.triggerEvent("authChange", {
      authenticated: true,
      user: this.currentUser,
    });
    return data;
  },

  logout({ redirect = true } = {}) {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.setSignedOut();
    if (redirect) {
      this.redirectToLogin();
    }
  },

  setSignedOut() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.triggerEvent("authChange", { authenticated: false, user: null });
  },

  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      return JSON.parse(localStorage.getItem(this.userKey) || "null");
    } catch {
      return null;
    }
  },

  redirectToLogin() {
    if (window.location.pathname.endsWith("/login.html")) {
      return;
    }

    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login.html?next=${encodeURIComponent(next)}`;
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
        console.error(`Auth event failed: ${event}`, error);
      }
    });
  },
};

window.Auth = Auth;
