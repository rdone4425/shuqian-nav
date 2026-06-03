const App = {
  isInitialized: false,
  elements: {},

  async init() {
    try {
      this.bindElements();
      this.bindEvents();
      await BookmarkManager.init();
      this.isInitialized = true;
    } catch (error) {
      console.error("应用初始化失败:", error);
      this.showMessage(
        `${this.t("messages.appInitFailed")}: ${error.message}`,
        "error",
      );
    }
  },

  bindElements() {
    const selectors = {
      searchToggle: "searchToggle",
      searchContainer: "searchContainer",
      searchBtn: "searchBtn",
      clearSearchBtn: "clearSearchBtn",
      messageContainer: "messageContainer",
      messageText: "messageText",
    };

    this.elements = DOMHelper.getElements(selectors);
  },

  bindEvents() {
    this.elements.searchToggle?.addEventListener("click", () => {
      this.focusSearch();
    });

    this.elements.clearSearchBtn?.addEventListener("click", () => {
      this.clearSearch();
    });

    this.elements.searchBtn?.addEventListener("click", () => {
      this.runSearch();
    });

    document.addEventListener("keydown", (event) => {
      this.handleKeyboardShortcuts(event);
    });
  },

  t(key, params = {}) {
    return window.I18n?.t(key, params) || key;
  },

  focusSearch() {
    this.elements.searchContainer?.classList.remove("hidden");
    document.getElementById("searchInput")?.focus();
  },

  clearSearch() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.focus();
    }
  },

  runSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) {
      return;
    }

    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
  },

  handleKeyboardShortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.focusSearch();
    }
  },

  showMessage(text, type = "info") {
    if (!this.elements.messageContainer || !this.elements.messageText) {
      return;
    }

    this.elements.messageText.textContent = text;
    this.elements.messageText.className = `message-text ${type}`;
    this.elements.messageContainer.classList.remove("hidden");

    const timeout = type === "error" ? 5000 : 3000;
    setTimeout(() => {
      this.elements.messageContainer?.classList.add("hidden");
    }, timeout);
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await App.init();
});

window.App = App;
