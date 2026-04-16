const Auth = {
  isAuthenticated: true,
  currentUser: { role: "public", mode: "public" },
  lastVerificationTime: Date.now(),
  verificationFailureCount: 0,
  listeners: {
    authChange: [],
  },

  async init() {
    this.setPublicState();
    return true;
  },

  getCurrentUser() {
    return this.currentUser;
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

  setPublicState() {
    this.isAuthenticated = true;
    this.currentUser = { role: "public", mode: "public" };
    this.lastVerificationTime = Date.now();
    this.verificationFailureCount = 0;
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});

window.Auth = Auth;
