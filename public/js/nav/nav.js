/**
 * Public navigation homepage behaviour.
 *
 * The directory itself is rendered on the server, so this file only adds
 * progressive enhancements: instant search over the rendered cards, the theme
 * toggle, and back-to-top. It must never reference the login/admin runtime.
 */
(function () {
  "use strict";

  var searchInput = document.getElementById("navSearch");
  var emptyMessage = document.getElementById("navEmpty");
  var themeToggle = document.getElementById("navThemeToggle");
  var topButton = document.getElementById("navTop");
  var featuredSection = document.querySelector(".nav-featured");
  var groups = Array.prototype.slice.call(
    document.querySelectorAll("[data-nav-group]"),
  );
  var cards = Array.prototype.slice.call(
    document.querySelectorAll(".nav-site"),
  );

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .trim();
  }

  function isEditableTarget(target) {
    if (!target) return false;
    var tag = String(target.tagName || "").toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable === true
    );
  }

  var filterTimer = null;

  function applyFilter() {
    var query = normalize(searchInput ? searchInput.value : "");
    var visible = 0;

    cards.forEach(function (card) {
      var match = !query || normalize(card.dataset.search).indexOf(query) >= 0;
      card.hidden = !match;
      if (match) visible += 1;
    });

    groups.forEach(function (group) {
      group.hidden =
        group.querySelectorAll(".nav-site:not([hidden])").length === 0;
    });

    // The featured row duplicates cards from the directory; hide it while a
    // query is active so results are not shown twice.
    if (featuredSection) {
      featuredSection.hidden = Boolean(query);
    }

    if (emptyMessage) {
      emptyMessage.hidden = visible !== 0;
    }
  }

  function scheduleFilter() {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(applyFilter, 80);
  }

  if (searchInput) {
    searchInput.addEventListener("input", scheduleFilter);
    searchInput.addEventListener("search", scheduleFilter);
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        searchInput.value = "";
        applyFilter();
      }
    });
  }

  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery && searchInput) {
    searchInput.value = initialQuery;
    applyFilter();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || isEditableTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (searchInput) searchInput.focus();
  });

  function syncThemeButton() {
    if (!themeToggle) return;
    var isDark = document.documentElement.dataset.theme === "dark";
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    themeToggle.setAttribute(
      "aria-label",
      isDark ? "切换浅色模式" : "切换深色模式",
    );
    themeToggle.setAttribute("title", isDark ? "切换浅色模式" : "切换深色模式");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      if (next === "dark") {
        document.documentElement.dataset.theme = "dark";
      } else {
        delete document.documentElement.dataset.theme;
      }
      try {
        localStorage.setItem("nav-theme", next);
      } catch (error) {
        // Ignore storage failures (private mode).
      }
      syncThemeButton();
    });
    syncThemeButton();
  }

  if (topButton) {
    var updateTopButton = function () {
      topButton.classList.toggle("is-visible", window.scrollY > 480);
    };
    window.addEventListener("scroll", updateTopButton, { passive: true });
    topButton.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateTopButton();
  }

  Array.prototype.forEach.call(
    document.querySelectorAll(".nav-chip"),
    function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(
          document.querySelectorAll(".nav-chip.is-active"),
          function (active) {
            active.classList.remove("is-active");
          },
        );
        chip.classList.add("is-active");
      });
    },
  );
})();
