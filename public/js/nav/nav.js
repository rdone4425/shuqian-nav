/**
 * Public navigation homepage behaviour.
 *
 * The directory itself is rendered on the server, so this file only adds
 * progressive enhancements: instant search over the rendered cards, the theme
 * toggle, scrollspy for the category rail, and back-to-top. It must never
 * reference the login/admin runtime.
 */
(function () {
  "use strict";

  var searchInput = document.getElementById("navSearch");
  var resultCount = document.getElementById("navResultCount");
  var emptyMessage = document.getElementById("navEmpty");
  var themeToggle = document.getElementById("navThemeToggle");
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var topButton = document.getElementById("navTop");
  var featuredSection = document.getElementById("nav-featured");
  var sections = Array.prototype.slice.call(
    document.querySelectorAll("[data-nav-section]"),
  );
  var navTargets = Array.prototype.slice.call(
    document.querySelectorAll("a[data-nav-target]"),
  );
  var groups = Array.prototype.slice.call(
    document.querySelectorAll("[data-nav-group]"),
  );
  var cards = Array.prototype.slice.call(
    document.querySelectorAll(".nav-site"),
  );
  var total = resultCount ? Number(resultCount.dataset.total) || 0 : 0;
  var filterTimer = null;
  var activeLock = null;
  var activeLockTimer = null;

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

  function setActive(target) {
    navTargets.forEach(function (item) {
      var active = item.getAttribute("data-nav-target") === target;
      item.classList.toggle("is-active", active);
      if (active) {
        item.setAttribute("aria-current", "location");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  function applyFilter() {
    var query = normalize(searchInput ? searchInput.value : "");
    var visible = 0;

    cards.forEach(function (card) {
      var match = !query || normalize(card.dataset.search).indexOf(query) >= 0;
      card.hidden = !match;

      var isFeaturedCard = featuredSection && featuredSection.contains(card);
      if (match && !(query && isFeaturedCard)) {
        visible += 1;
      }
    });

    groups.forEach(function (group) {
      if (group === featuredSection) return;
      group.hidden =
        group.querySelectorAll(".nav-site:not([hidden])").length === 0;
    });

    // The featured row duplicates cards from the directory; hide it while a
    // query is active so results are not shown twice.
    if (featuredSection) {
      featuredSection.hidden = Boolean(query);
    }

    if (resultCount) {
      resultCount.textContent = query
        ? "找到 " + visible + " 个"
        : total + " 个站点";
    }

    if (emptyMessage) {
      emptyMessage.hidden = visible !== 0;
    }

    if (query) {
      setActive("all");
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
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute(
      "aria-label",
      isDark ? "切换浅色模式" : "切换深色模式",
    );
    themeToggle.setAttribute("title", isDark ? "切换浅色模式" : "切换深色模式");
    if (themeMeta) {
      themeMeta.setAttribute("content", isDark ? "#0f141b" : "#f4f6f3");
    }
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
      topButton.classList.toggle("is-visible", window.scrollY > 600);
    };
    window.addEventListener("scroll", updateTopButton, { passive: true });
    topButton.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateTopButton();
  }

  navTargets.forEach(function (item) {
    item.addEventListener("click", function () {
      if (searchInput && searchInput.value) {
        searchInput.value = "";
        applyFilter();
      }
      var target = item.getAttribute("data-nav-target");
      setActive(target);
      activeLock = target;
      window.clearTimeout(activeLockTimer);
      activeLockTimer = window.setTimeout(function () {
        activeLock = null;
        updateActiveOnScroll();
      }, 900);
    });
  });

  var ticking = false;

  function updateActiveOnScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(function () {
      ticking = false;

      if (searchInput && normalize(searchInput.value)) {
        setActive("all");
        return;
      }

      if (activeLock) return;

      var atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;

      if (atBottom) {
        for (var j = sections.length - 1; j >= 0; j -= 1) {
          if (!sections[j].hidden) {
            setActive(sections[j].getAttribute("data-nav-target"));
            return;
          }
        }
      }

      // Stay on "全部" at the very top / after clicking it; otherwise the first
      // category would win immediately because it starts just below the header.
      if (window.scrollY <= 4) {
        setActive("all");
        return;
      }

      var offset = 96;
      var active = "all";

      for (var i = 0; i < sections.length; i += 1) {
        var section = sections[i];
        if (section.hidden) continue;

        if (section.getBoundingClientRect().top <= offset) {
          active = section.getAttribute("data-nav-target") || active;
        } else {
          break;
        }
      }

      setActive(active);
    });
  }

  window.addEventListener("scroll", updateActiveOnScroll, { passive: true });
  window.addEventListener("resize", updateActiveOnScroll);
  updateActiveOnScroll();
})();
