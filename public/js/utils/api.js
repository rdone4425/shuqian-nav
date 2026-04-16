const API = {
  config: {
    baseURL: window.location.origin,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  interceptors: {
    request: [],
    response: [],
  },

  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  },

  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  },

  getAuthHeaders() {
    return {};
  },

  async request(url, options = {}) {
    const fullUrl = url.startsWith("http") ? url : `${this.config.baseURL}${url}`;
    const defaultOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.getAuthHeaders(),
      },
      timeout: this.config.timeout,
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    for (const interceptor of this.interceptors.request) {
      await interceptor(finalOptions);
    }

    let lastError;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);

        const response = await fetch(fullUrl, {
          ...finalOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        for (const interceptor of this.interceptors.response) {
          await interceptor(response);
        }

        if (!response.ok) {
          const errorData = await this.parseResponse(response);
          throw new APIError(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData,
          );
        }

        return await this.parseResponse(response);
      } catch (error) {
        lastError = error;
        if (attempt === this.config.retryAttempts || !this.shouldRetry(error, finalOptions)) {
          break;
        }

        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError;
  },

  async parseResponse(response) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return await response.text();
  },

  shouldRetry(error, requestOptions = {}) {
    const method = (requestOptions.method || "GET").toUpperCase();
    const isRetryableMethod = ["GET", "HEAD", "OPTIONS"].includes(method);

    if (!isRetryableMethod) {
      return false;
    }

    if (error.name === "AbortError" || error.name === "TypeError") {
      return true;
    }

    if (error instanceof APIError && error.status >= 500) {
      return true;
    }

    return false;
  },

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  async get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return await this.request(fullUrl, { method: "GET" });
  },

  async post(url, data = {}) {
    return await this.request(url, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async put(url, data = {}) {
    return await this.request(url, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(url) {
    return await this.request(url, { method: "DELETE" });
  },

  async upload(url, file, additionalData = {}) {
    const formData = new FormData();
    formData.append("file", file);

    for (const [key, value] of Object.entries(additionalData)) {
      formData.append(key, value);
    }

    return await this.request(url, {
      method: "POST",
      body: formData,
      headers: {
        ...this.getAuthHeaders(),
      },
    });
  },

  async healthCheck() {
    try {
      const response = await this.get("/api/health");
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message, data: null };
    }
  },
};

class APIError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

const BookmarkAPI = {
  async getBookmarks(params = {}) {
    return await API.get("/api/bookmarks", params);
  },

  async getBookmark(id) {
    return await API.get(`/api/bookmarks/${id}`);
  },

  async createBookmark(data) {
    return await API.post("/api/bookmarks", data);
  },

  async updateBookmark(id, data) {
    return await API.put(`/api/bookmarks/${id}`, data);
  },

  async deleteBookmark(id, options = {}) {
    const deleteData = {
      reason: options.reason || "manual_delete",
      checkStatus: options.checkStatus || null,
      statusCode: options.statusCode || null,
      statusText: options.statusText || null,
      errorMessage: options.errorMessage || null,
      keepStatus: options.keepStatus || null,
    };

    return await API.request(`/api/bookmarks/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deleteData),
    });
  },

  async getCategories() {
    return await API.get("/api/bookmarks/categories");
  },

  async createCategory(data) {
    return await API.post("/api/bookmarks/categories", data);
  },

  async recordVisit(id) {
    return await API.post(`/api/bookmarks/${id}/visit`, {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
    });
  },
};

const AuthAPI = {
  async verifyToken() {
    return {
      success: true,
      valid: true,
      message: "Public mode is active.",
    };
  },
};

const SystemAPI = {
  async createBackup(format = "json") {
    const response = await fetch(`/api/system/backup?format=${format}`, {
      method: "GET",
      headers: {
        Accept: format === "json" ? "application/json" : "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(`备份失败: ${response.status} ${response.statusText}`);
    }

    return response;
  },
};

window.API = API;
window.APIError = APIError;
window.BookmarkAPI = BookmarkAPI;
window.AuthAPI = AuthAPI;
window.SystemAPI = SystemAPI;
