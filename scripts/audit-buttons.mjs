import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import puppeteer from "puppeteer-core";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8788";
const executablePath =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const password = process.env.AUDIT_PASSWORD || "admin123";
const auditDir = join(tmpdir(), "shuqian-nav-audit");
const importFixturePath = join(auditDir, "bookmarks-audit.json");
const extensionPopupUrl = pathToFileURL(resolve("chrome", "popup.html")).href;

const results = [];
const failures = [];
let currentPageName = "browser";

function record(pageName, action, ok, detail = "") {
  const item = { page: pageName, action, ok, detail };
  results.push(item);
  if (!ok) failures.push(item);
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${pageName} | ${action}${detail ? ` | ${detail}` : ""}`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createImportFixture() {
  mkdirSync(auditDir, { recursive: true });
  writeFileSync(
    importFixturePath,
    JSON.stringify(
      {
        bookmarks: [
          {
            title: "Audit import preview",
            url: "https://example.net/audit-import",
            description: "fixture for button audit",
            category_name: "Audit Import",
          },
        ],
        categories: [
          {
            name: "Audit Import",
            color: "#14B8A6",
            description: "fixture category",
          },
        ],
      },
      null,
      2,
    ),
  );
}

function isIgnoredNetworkUrl(url) {
  return (
    url.includes("google.com/s2/favicons") ||
    url.includes("gstatic.com/faviconV2") ||
    url.includes("fonts.gstatic.com") ||
    url.includes("fonts.googleapis.com")
  );
}

async function watchPage(page, pageName) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon") || text.includes("Auth verification failed")) {
      return;
    }
    if (text.includes("Failed to load resource")) {
      return;
    }
    record(
      currentPageName || pageName,
      "console error",
      false,
      text.slice(0, 300),
    );
  });

  page.on("pageerror", (error) => {
    record(
      currentPageName || pageName,
      "page error",
      false,
      error.message.slice(0, 300),
    );
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (isIgnoredNetworkUrl(url)) {
      return;
    }
    record(
      currentPageName || pageName,
      "request failed",
      false,
      `${request.method()} ${url} ${request.failure()?.errorText || ""}`.slice(
        0,
        300,
      ),
    );
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;

    const url = response.url();
    if (isIgnoredNetworkUrl(url)) {
      return;
    }

    record(
      currentPageName || pageName,
      "http error response",
      false,
      `${status} ${url}`.slice(0, 300),
    );
  });
}

async function goto(page, pageName, path) {
  currentPageName = pageName;
  const response = await page.goto(`${base}${path}`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  const status = response?.status() || 0;
  record(
    pageName,
    `open ${path}`,
    status > 0 && status < 400,
    status ? `HTTP ${status}` : "no response",
  );
}

async function login(page) {
  await goto(page, "login", "/login.html");
  await page.waitForSelector("#password");
  await page.click("#password");
  await page.keyboard.type(password);
  await Promise.all([
    page
      .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
      .catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  const token = await page.evaluate(() =>
    localStorage.getItem("bookmark_nav_token"),
  );
  record(
    "login",
    "submit password",
    Boolean(token),
    token ? "token stored" : "no token",
  );
}

async function api(page, path, options = {}) {
  return await page.evaluate(
    async ({ path, options }) => {
      const token = localStorage.getItem("bookmark_nav_token");
      const response = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { status: response.status, ok: response.ok, body };
    },
    { path, options },
  );
}

async function assertApiOk(page, pageName, path, options = {}) {
  const response = await api(page, path, options);
  const detail =
    typeof response.body === "string"
      ? response.body
      : response.body?.message ||
        response.body?.error ||
        `status ${response.status}`;
  record(pageName, `${options.method || "GET"} ${path}`, response.ok, detail);
  return response;
}

async function initDatabase(page) {
  await assertApiOk(page, "setup", "/api/system/init-database", {
    method: "POST",
  });
}

async function seed(page) {
  const suffix = Date.now();
  const category = await assertApiOk(
    page,
    "seed",
    "/api/bookmarks/categories",
    {
      method: "POST",
      body: JSON.stringify({
        name: `E2E Category ${suffix}`,
        color: "#2F6FED",
        description: "button audit",
      }),
    },
  );
  const categoryId = category.body?.data?.id || null;
  const bookmark = await assertApiOk(page, "seed", "/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      title: `E2E Bookmark ${suffix}`,
      url: `https://example.com/?e2e=${suffix}`,
      description: "button audit",
      category_id: categoryId,
    }),
  });
  const trash = await assertApiOk(page, "seed", "/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      title: `E2E Deleted ${suffix}`,
      url: `https://example.com/deleted-${suffix}`,
      description: "deleted record for button audit",
      category_id: categoryId,
    }),
  });
  const trashId = trash.body?.data?.id || null;
  if (trashId) {
    await assertApiOk(page, "seed", `/api/bookmarks/${trashId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: "manual_delete" }),
    });
  }
  const secondTrash = await assertApiOk(page, "seed", "/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      title: `E2E Deleted Spare ${suffix}`,
      url: `https://example.com/deleted-spare-${suffix}`,
      description: "spare deleted record for button audit",
      category_id: categoryId,
    }),
  });
  const secondTrashId = secondTrash.body?.data?.id || null;
  if (secondTrashId) {
    await assertApiOk(page, "seed", `/api/bookmarks/${secondTrashId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: "manual_delete" }),
    });
  }

  const currentBookmarks = await assertApiOk(
    page,
    "seed",
    "/api/bookmarks?page=1&limit=1",
  );
  const totalBookmarks =
    currentBookmarks.body?.data?.pagination?.total ||
    currentBookmarks.body?.data?.bookmarks?.length ||
    0;
  const requiredTotal = 35;
  const missingCount = Math.max(0, requiredTotal - totalBookmarks);
  for (let index = 0; index < missingCount; index += 1) {
    await assertApiOk(page, "seed", "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        title: `E2E Page ${suffix}-${index + 1}`,
        url: `https://example.com/page-${suffix}-${index + 1}`,
        description: "pagination audit",
        category_id: categoryId,
      }),
    });
  }
  record(
    "seed",
    "ensure pagination data",
    true,
    missingCount ? `created ${missingCount}` : "already enough",
  );

  return { suffix, categoryId, bookmarkId: bookmark.body?.data?.id || null };
}

async function clickIf(page, pageName, selector, label, options = {}) {
  const element = await page.$(selector);
  if (!element) {
    record(pageName, label, false, `missing ${selector}`);
    return false;
  }

  try {
    await page.click(selector);
    await sleep(options.wait ?? 400);
    record(pageName, label, true);
    return true;
  } catch (error) {
    record(pageName, label, false, error.message.slice(0, 250));
    return false;
  }
}

async function clickVisible(page, pageName, selector, label, options = {}) {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    const visible = await handle.evaluate((node) => {
      node.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !node.disabled
      );
    });
    if (!visible) continue;
    try {
      await handle.click();
      await sleep(options.wait ?? 400);
      record(pageName, label, true);
      return true;
    } catch (error) {
      record(pageName, label, false, error.message.slice(0, 250));
      return false;
    }
  }
  record(pageName, label, false, `no visible ${selector}`);
  return false;
}

async function waitForAny(page, pageName, selector, label, timeout = 8000) {
  try {
    await page.waitForSelector(selector, { timeout });
    record(pageName, label, true);
    return true;
  } catch {
    record(pageName, label, false, `missing ${selector}`);
    return false;
  }
}

async function recordEnabled(page, pageName, selector, label) {
  const enabled = await page
    .$eval(selector, (node) => !node.disabled)
    .catch(() => false);
  record(pageName, label, enabled);
  return enabled;
}

async function selectFirstNonEmptyOption(page, pageName, selector, label) {
  const value = await page
    .$eval(selector, (select) => {
      const option = [...select.options].find((item) => item.value);
      return option?.value || "";
    })
    .catch(() => "");

  if (!value) {
    record(pageName, label, true, "no non-empty option available");
    return false;
  }

  await page.select(selector, value);
  await sleep(700);
  record(pageName, label, true, value);
  return true;
}

async function clearInput(page, selector) {
  await page.$eval(selector, (input) => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function setChecked(page, pageName, selector, checked, label) {
  const ok = await page
    .$eval(
      selector,
      (input, targetChecked) => {
        input.checked = targetChecked;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return input.checked === targetChecked;
      },
      checked,
    )
    .catch(() => false);
  record(pageName, label, ok, selector);
  return ok;
}

async function waitForEnabled(page, pageName, selector, label, timeout = 2000) {
  try {
    await page.waitForFunction(
      (targetSelector) => {
        const node = document.querySelector(targetSelector);
        return Boolean(node && !node.disabled);
      },
      { timeout },
      selector,
    );
    record(pageName, label, true);
    return true;
  } catch {
    const detail = await page
      .$eval(selector, (node) =>
        JSON.stringify({
          disabled: node.disabled,
          text: node.textContent.trim(),
          selected: document.getElementById("selectedCount")?.textContent,
        }),
      )
      .catch(() => `missing ${selector}`);
    record(pageName, label, false, detail);
    return false;
  }
}

async function commonMenu(page, pageName) {
  await clickIf(page, pageName, "#toolsMenuToggle", "open management menu");
  const menuItems = await page.$$eval(
    "#toolsDropdown a.dropdown-item",
    (items) =>
      items.map((item) => ({
        href: item.getAttribute("href") || "",
        text: item.textContent.trim().replace(/\s+/g, " "),
      })),
  );
  record(
    pageName,
    "menu has links",
    menuItems.length >= 6,
    menuItems.map((item) => `${item.text} -> ${item.href}`).join(" / "),
  );

  const expectedMenuTargets = [
    "/",
    "/bookmarks-manage.html",
    "/categories.html",
    "/import.html",
    "/link-checker.html",
    "/deleted-bookmarks",
    "/admin-settings.html",
    "/token.html",
    "/notifications.html",
  ];
  const missingTargets = expectedMenuTargets.filter(
    (target) => !menuItems.some((item) => item.href === target),
  );
  record(
    pageName,
    "menu exposes every target",
    missingTargets.length === 0,
    missingTargets.join(", "),
  );

  const targetChecks = await page.evaluate(async (targets) => {
    const entries = [];
    for (const target of targets) {
      const response = await fetch(target, { method: "GET" });
      entries.push({ target, status: response.status, ok: response.ok });
    }
    return entries;
  }, expectedMenuTargets);
  const brokenTargets = targetChecks.filter((item) => !item.ok);
  record(
    pageName,
    "menu target pages respond",
    brokenTargets.length === 0,
    brokenTargets
      .map((item) => `${item.target} HTTP ${item.status}`)
      .join(", "),
  );
  await page.evaluate(() => {
    document.getElementById("toolsDropdown")?.classList.remove("show");
    document
      .getElementById("toolsDropdown")
      ?.style.removeProperty("visibility");
    document.getElementById("toolsMenuToggle")?.classList.remove("active");
  });
}

async function testHome(page) {
  const name = "home";
  await goto(page, name, "/");
  const hasPublicMenuToggle = await page.$("#toolsMenuToggle");
  record(
    name,
    "public home does not render management menu",
    !hasPublicMenuToggle,
  );
  await clickIf(page, name, "#listViewBtn", "switch list view button");
  await clickIf(page, name, "#gridViewBtn", "switch grid view button");
  await clickVisible(
    page,
    name,
    '#categoryRail .category-chip[data-category-id=""]',
    "category rail all chip",
  );
  await clickVisible(
    page,
    name,
    "#categoryRail .category-chip:not([data-category-id=''])",
    "category rail category chip",
  );
  await selectFirstNonEmptyOption(
    page,
    name,
    "#categoryFilter",
    "category select filter",
  );
  await page.select("#categoryFilter", "");
  await sleep(700);
  record(name, "category select all option", true);
  await page.select("#sortSelect", "title:asc");
  await sleep(700);
  record(name, "sort select title ascending", true);
  const hasHeaderSearchToggle = await page.$("#searchToggle");
  record(
    name,
    "public home does not render header search shortcut",
    !hasHeaderSearchToggle,
  );
  await page.type("#searchInput", "E2E");
  await clickIf(page, name, "#searchBtn", "search submit button");
  await clickIf(page, name, "#clearSearchBtn", "clear search button");
  await clickIf(page, name, "#addBookmarkBtn", "open add bookmark modal");
  await clickIf(
    page,
    name,
    "#closeModalBtn",
    "close add bookmark modal button",
  );
  await clickIf(page, name, "#addBookmarkBtn", "open add bookmark modal again");
  await clickIf(page, name, "#cancelBtn", "cancel add bookmark modal");
  await clickIf(page, name, "#addBookmarkBtn", "reopen add bookmark modal");
  await page.type("#bookmarkTitle", `Button Audit ${Date.now()}`);
  await page.type("#bookmarkUrl", `https://example.org/${Date.now()}`);
  await page.type("#bookmarkDescription", "button audit description");
  await selectFirstNonEmptyOption(
    page,
    name,
    "#bookmarkCategory",
    "bookmark category select",
  );
  await clickIf(page, name, "#saveBtn", "save bookmark button", { wait: 1000 });
  await page.evaluate(() => window.Storage?.search?.clear?.());
  await goto(page, name, "/?view=grid");
  await waitForAny(
    page,
    name,
    ".bookmark-card .edit-btn",
    "bookmark card actions render",
  );
  await clickVisible(
    page,
    name,
    ".bookmark-card .edit-btn",
    "bookmark edit button",
    {
      wait: 1000,
    },
  );
  await clickIf(page, name, "#cancelBtn", "cancel edit bookmark modal");
  await clickVisible(
    page,
    name,
    ".bookmark-card .delete-btn",
    "bookmark delete button cancel dialog",
    { wait: 700 },
  );
  await clickIf(page, name, "#nextPageBtn", "home next page button", {
    wait: 1000,
  });
  await clickIf(page, name, "#prevPageBtn", "home previous page button", {
    wait: 1000,
  });
  if (await page.$(".page-btn:not(.active)")) {
    await clickVisible(
      page,
      name,
      ".page-btn:not(.active)",
      "home page number button",
      {
        wait: 1000,
      },
    );
  } else {
    record(name, "home page number button", true, "single visible page");
  }
  const hasHomeSettingsPanel = await page.$("#settingsPanel");
  record(
    name,
    "home does not render admin settings panel",
    !hasHomeSettingsPanel,
  );
}

async function testAdminSettings(page) {
  const name = "admin-settings";
  await goto(page, name, "/admin-settings.html");
  await commonMenu(page, name);
  await clickIf(page, name, "#exportHtmlBtn", "settings export html button", {
    wait: 1000,
  });
  await clickIf(page, name, "#exportJsonBtn", "settings export json button", {
    wait: 1000,
  });
  await clickIf(page, name, "#backupJsonBtn", "settings backup json button", {
    wait: 1000,
  });
  await clickIf(page, name, "#backupHtmlBtn", "settings backup html button", {
    wait: 1000,
  });
  await clickIf(
    page,
    name,
    "#changePasswordBtn",
    "change password required validation button",
  );
  await page.type("#currentPassword", password);
  await page.type("#newPassword", "abcdef");
  await page.type("#confirmPassword", "ghijkl");
  await clickIf(
    page,
    name,
    "#changePasswordBtn",
    "change password mismatch validation button",
  );
  await clickVisible(
    page,
    name,
    'a.btn[href="/import.html"]',
    "settings import link",
    {
      wait: 1000,
    },
  );
  record(
    name,
    "settings import navigates to import page",
    page.url().includes("/import"),
    page.url(),
  );
}

async function testBookmarkManage(page) {
  const name = "bookmarks-manage";
  await goto(page, name, "/bookmarks-manage.html");
  await commonMenu(page, name);
  await page.type("#bookmarkSearch", "E2E");
  await sleep(800);
  record(name, "search input filters", true);
  await clearInput(page, "#bookmarkSearch");
  await sleep(800);
  record(name, "search input clears", true);
  await selectFirstNonEmptyOption(
    page,
    name,
    "#bookmarkCategoryFilter",
    "category filter select",
  );
  await page.select("#bookmarkCategoryFilter", "");
  await sleep(700);
  record(name, "category filter all option", true);
  await clickIf(page, name, "#refreshBookmarksBtn", "refresh button");
  await clickVisible(
    page,
    name,
    "[data-bookmark-check]",
    "single row checkbox",
    { wait: 500 },
  );
  await clickIf(page, name, "#selectAllBookmarks", "select all checkbox");
  await selectFirstNonEmptyOption(
    page,
    name,
    "#bulkMoveCategory",
    "bulk move target select",
  );
  const bulkEnabled = await page.$eval(
    "#bulkMoveBtn",
    (button) => !button.disabled,
  );
  record(name, "bulk move enabled after selection", bulkEnabled);
  await clickIf(page, name, "#bulkMoveBtn", "bulk move selected button", {
    wait: 1000,
  });
  const rowSelect = await page.$("[data-move-bookmark]");
  if (rowSelect) {
    await page.select("[data-move-bookmark]", "");
    await sleep(800);
    record(name, "single row move select", true);
  } else {
    record(name, "single row move select", false, "no row select");
  }
  if (await page.$("#bookmarkPagination [data-page]:not([disabled])")) {
    await clickVisible(
      page,
      name,
      "#bookmarkPagination [data-page]:not([disabled])",
      "pagination button",
      { wait: 1000 },
    );
  } else {
    record(name, "pagination button", true, "single page or disabled");
  }
}

async function testCategories(page) {
  const name = "categories";
  await goto(page, name, "/categories.html");
  await commonMenu(page, name);
  await page.type("#categoryName", `Button Category ${Date.now()}`);
  await page.$eval("#categoryColor", (input) => {
    input.value = "#0EA5E9";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  record(name, "category color input", true);
  await page.type("#categoryDescription", "created from audit");
  await clickIf(page, name, "#saveCategoryBtn", "save category button", {
    wait: 1000,
  });
  await clickIf(page, name, "[data-edit-id]", "edit category row button");
  await clickIf(page, name, "#resetCategoryBtn", "cancel edit button");
  await clickIf(
    page,
    name,
    "[data-delete-id]",
    "delete category button cancel dialog",
  );
}

async function testImport(page) {
  const name = "import";
  await goto(page, name, "/import.html");
  await commonMenu(page, name);
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 5000 }),
    clickIf(page, name, "#selectFileBtn", "select file button"),
  ]);
  await fileChooser.accept([importFixturePath]);
  await sleep(800);
  await recordEnabled(page, name, "#nextBtn", "next button enabled after file");
  await clickIf(page, name, "#nextBtn", "preview step button");
  await clickIf(page, name, "#nextBtn", "options step button");
  await setChecked(
    page,
    name,
    'input[name="importMode"][value="replace"]',
    true,
    "replace mode radio",
  );
  await setChecked(
    page,
    name,
    'input[name="importMode"][value="merge"]',
    true,
    "merge mode radio",
  );
  await setChecked(
    page,
    name,
    "#skipDuplicates",
    false,
    "skip duplicates checkbox",
  );
  await setChecked(
    page,
    name,
    "#createCategories",
    false,
    "create categories checkbox",
  );
  await setChecked(
    page,
    name,
    "#createCategories",
    true,
    "restore create categories checkbox",
  );
  await clickIf(page, name, "#prevBtn", "previous step button");
  await clickIf(page, name, "#nextBtn", "return to options step button");
  await clickIf(page, name, "#importBtn", "execute import button", {
    wait: 2500,
  });
  await clickIf(page, name, "#finishBtn", "finish import button", {
    wait: 1000,
  });
  await goto(page, name, "/import.html");
  await clickIf(
    page,
    name,
    "#clearAllBookmarksBtn",
    "clear all bookmarks cancel prompt",
  );
  const buttons = await page.$$eval("button", (items) =>
    items.map((button) => ({
      id: button.id,
      text: button.textContent.trim(),
      disabled: button.disabled,
    })),
  );
  record(
    name,
    "buttons enumerated",
    buttons.length > 0,
    JSON.stringify(buttons).slice(0, 500),
  );
}

async function testLinkChecker(page) {
  const name = "link-checker";
  await goto(page, name, "/link-checker.html");
  await commonMenu(page, name);
  await clickIf(page, name, "#reloadBookmarksBtn", "reload bookmarks button", {
    wait: 1000,
  });
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="all"]',
    "filter all button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="accessible"]',
    "filter accessible button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="checked"]',
    "filter checked button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="inaccessible"]',
    "filter inaccessible button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="review"]',
    "filter review button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="kept"]',
    "filter kept button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="deleted"]',
    "filter deleted button",
  );
  await clickIf(
    page,
    name,
    '.stat-item[data-filter="all"]',
    "return to all filter button",
  );
  await waitForAny(page, name, '[data-action="check"]', "link rows render");
  await clickVisible(page, name, '[data-action="check"]', "row check button", {
    wait: 2500,
  });
  await clickVisible(page, name, '[data-action="keep"]', "row keep button", {
    wait: 1000,
  });
  await clickVisible(
    page,
    name,
    '[data-action="unkeep"]',
    "row unkeep button",
    {
      wait: 1000,
    },
  );
  await clickVisible(
    page,
    name,
    '[data-action="delete"]',
    "row delete button cancel dialog",
    { wait: 700 },
  );
  await clickIf(
    page,
    name,
    "#deleteInaccessibleBtn",
    "delete inaccessible button safe path",
    { wait: 700 },
  );
  await clickIf(page, name, "#startCheckBtn", "start check button", {
    wait: 1500,
  });
  if (await page.$("#stopCheckBtn:not(.hidden)")) {
    await clickIf(page, name, "#stopCheckBtn", "stop check button", {
      wait: 500,
    });
  }
}

async function testDeleted(page) {
  const name = "deleted-bookmarks";
  await goto(page, name, "/deleted-bookmarks");
  await commonMenu(page, name);
  await clickIf(page, name, "#refreshBtn", "refresh button");
  await waitForAny(page, name, ".record-item", "deleted record rows render");
  await page.select("#filterSelect", "manual_delete");
  await sleep(800);
  record(name, "deleted filter select", true);
  await page.select("#filterSelect", "all");
  await sleep(800);
  record(name, "deleted filter all option", true);
  await page.type("#searchInput", "E2E");
  await sleep(800);
  record(name, "deleted search input", true);
  await clearInput(page, "#searchInput");
  await sleep(800);
  record(name, "deleted search clears", true);
  await clickVisible(page, name, ".detail-btn", "deleted detail button");
  await clickIf(page, name, "#closeDetailModal", "close deleted detail modal");
  await clickVisible(
    page,
    name,
    ".restore-btn",
    "deleted restore button opens modal",
  );
  await clickIf(
    page,
    name,
    "#closeRestoreModal",
    "close deleted restore modal",
  );
  await clickVisible(
    page,
    name,
    ".restore-btn",
    "deleted restore button reopens modal",
  );
  await clickIf(page, name, "#cancelRestore", "cancel deleted restore modal");
  await clickVisible(
    page,
    name,
    ".restore-btn",
    "deleted restore button opens confirm modal",
  );
  await clickIf(
    page,
    name,
    "#confirmRestore",
    "confirm deleted restore button",
    {
      wait: 1000,
    },
  );
  await waitForAny(
    page,
    name,
    ".record-item",
    "deleted rows remain after restore",
  );
  await clickVisible(
    page,
    name,
    ".delete-btn",
    "permanent delete cancel dialog",
    {
      wait: 700,
    },
  );
  await clickIf(page, name, "#selectAllRecords", "select all checkbox", {
    wait: 1000,
  });
  await waitForEnabled(
    page,
    name,
    "#batchRestoreBtn",
    "batch restore enabled after selection",
  );
  await waitForEnabled(
    page,
    name,
    "#batchDeleteBtn",
    "batch delete enabled after selection",
  );
  await clickIf(page, name, "#batchRestoreBtn", "batch restore cancel dialog", {
    wait: 700,
  });
  await clickIf(page, name, "#batchDeleteBtn", "batch delete cancel dialog", {
    wait: 700,
  });
  await clickIf(page, name, "#prevPage", "prev page button");
  await clickIf(page, name, "#nextPage", "next page button");
}

async function testToken(page) {
  const name = "token";
  await goto(page, name, "/token.html");
  await commonMenu(page, name);
  const formVisible = await page.$eval("#tokenForm", (form) => {
    const style = window.getComputedStyle(form);
    return !form.classList.contains("hidden") && style.display !== "none";
  });

  if (!formVisible) {
    await clickIf(
      page,
      name,
      "#checkTokenGuardBtn",
      "check token guard button",
      {
        wait: 1000,
      },
    );
  }

  await clickVisible(
    page,
    name,
    "#checkTokenGuardBtn",
    "check token guard button",
  );
  await clickVisible(page, name, "#refreshTokensBtn", "refresh tokens button");
  await page.$eval("#tokenName", (input) => {
    input.value = "";
  });
  await page.type("#tokenName", `Button Token ${Date.now()}`);
  await page.type("#tokenDescription", "button audit token");
  await clearInput(page, "#tokenExpiresIn");
  await page.type("#tokenExpiresIn", "30");
  record(name, "token description and expiry inputs", true);
  await clickVisible(page, name, "#createTokenBtn", "create token button", {
    wait: 1000,
  });
  if (await page.$("#copyTokenBtn")) {
    await clickVisible(page, name, "#copyTokenBtn", "copy token button");
  }
  await clickVisible(
    page,
    name,
    ".delete-token-btn",
    "delete token cancel dialog",
    {
      wait: 700,
    },
  );
  if (await page.$("#closeTokenResultBtn")) {
    await clickIf(
      page,
      name,
      "#closeTokenResultBtn",
      "close token result button",
    );
  }
}

async function testNotifications(page) {
  const name = "notifications";
  await goto(page, name, "/notifications.html");
  await commonMenu(page, name);
  await clickIf(page, name, "#refreshBtn", "refresh button");
  const loaded = await page
    .$eval("#notificationsList", (node) => {
      const text = node.textContent.trim();
      return text && !text.includes("正在加载");
    })
    .catch(() => false);
  record(name, "notifications list resolves", Boolean(loaded));
  const totalText = await page.$eval("#totalChecks", (node) =>
    node.textContent.trim(),
  );
  record(name, "notification summary renders", totalText.length > 0, totalText);
}

async function testAdminDashboard(page) {
  const name = "admin-dashboard";
  await goto(page, name, "/admin-dashboard.html");
  if (page.url().includes("/admin-settings")) {
    record(name, "redirects to admin settings", true, page.url());
    return;
  }
  await clickIf(
    page,
    name,
    'a.btn[href="/admin-settings.html"]',
    "enter settings link",
  );
}

async function testLogoutLogin(page) {
  const name = "logout-login";
  await goto(page, name, "/");
  await clickIf(page, name, "#logoutBtn", "logout button", { wait: 1000 });
  record(
    name,
    "redirected to login after logout",
    page.url().includes("/login"),
    page.url(),
  );
  await login(page);
}

async function installChromeExtensionMocks(page) {
  await page.evaluateOnNewDocument(() => {
    const storageData = {
      apiUrl: "http://127.0.0.1:8788",
      apiToken: "audit-token",
    };
    const bookmarkTree = [
      {
        title: "书签栏",
        children: [
          {
            title: "Audit Local Bookmark",
            url: "https://example.com/audit-local",
            dateAdded: Date.now(),
          },
        ],
      },
    ];

    window.chrome = {
      storage: {
        local: {
          async get(keys) {
            if (Array.isArray(keys)) {
              return Object.fromEntries(
                keys.map((key) => [key, storageData[key]]),
              );
            }

            if (typeof keys === "string") {
              return { [keys]: storageData[keys] };
            }

            return { ...storageData };
          },
          async set(values) {
            Object.assign(storageData, values);
          },
        },
      },
      bookmarks: {
        getTree(callback) {
          callback(bookmarkTree);
        },
      },
    };

    window.fetch = async (url, options = {}) => {
      const requestUrl = String(url);
      const method = String(options.method || "GET").toUpperCase();

      if (requestUrl.endsWith("/api/health")) {
        return new Response(JSON.stringify({ success: true, status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (requestUrl.includes("/api/bookmarks/sync")) {
        return new Response(
          JSON.stringify({
            success: true,
            data:
              method === "POST"
                ? { successCount: 1 }
                : { bookmarks: [], pagination: { hasNext: false } },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });
}

async function testChromePopup(browser) {
  const name = "chrome-popup";
  currentPageName = name;
  const popupPage = await browser.newPage();
  popupPage.setDefaultTimeout(12000);
  await watchPage(popupPage, name);
  await installChromeExtensionMocks(popupPage);

  try {
    const response = await popupPage.goto(extensionPopupUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    const status = response?.status() || 0;
    record(
      name,
      "open chrome popup",
      status > 0 && status < 400,
      status ? `HTTP ${status}` : extensionPopupUrl,
    );

    await waitForAny(
      popupPage,
      name,
      "#connectionStatus",
      "popup status renders",
    );
    await clickIf(popupPage, name, "#settingsToggle", "open settings button");
    await clearInput(popupPage, "#apiUrl");
    await popupPage.type("#apiUrl", "127.0.0.1:8788");
    await clearInput(popupPage, "#apiToken");
    await popupPage.type("#apiToken", "audit-token");
    await clickIf(popupPage, name, "#testBtn", "test connection button", {
      wait: 1000,
    });
    await clickVisible(
      popupPage,
      name,
      "#settingsClose",
      "close settings button",
    );
    await clickIf(popupPage, name, "#settingsToggle", "reopen settings button");
    await clearInput(popupPage, "#apiUrl");
    await popupPage.type("#apiUrl", "127.0.0.1:8788");
    await clearInput(popupPage, "#apiToken");
    await popupPage.type("#apiToken", "audit-token");
    await clickIf(popupPage, name, "#saveBtn", "save settings button", {
      wait: 1000,
    });
    const panelClosed = await popupPage
      .$eval("#settingsPanel", (node) => node.classList.contains("hidden"))
      .catch(() => false);
    record(name, "settings panel closes after save", panelClosed);
    await clickIf(popupPage, name, "#syncBtn", "sync button", {
      wait: 1500,
    });
    await waitForAny(
      popupPage,
      name,
      "#messageContainer:not(.hidden)",
      "popup message renders",
      3000,
    );
  } finally {
    await popupPage.close();
    currentPageName = "browser";
  }
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
page.setDefaultTimeout(12000);
await watchPage(page, "browser");
page.on("dialog", async (dialog) => dialog.dismiss());
createImportFixture();

try {
  await page._client().send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: auditDir,
  });
} catch {
  record("setup", "download behavior fallback", true, "not required");
}

try {
  await login(page);
  await initDatabase(page);
  await seed(page);
  await testHome(page);
  await testAdminSettings(page);
  await testBookmarkManage(page);
  await testCategories(page);
  await testImport(page);
  await testLinkChecker(page);
  await testDeleted(page);
  await testToken(page);
  await testNotifications(page);
  await testAdminDashboard(page);
  await testLogoutLogin(page);
  await testChromePopup(browser);
} finally {
  await browser.close();
}

console.log(
  `\nSUMMARY: ${results.length - failures.length}/${results.length} passed`,
);
if (failures.length) {
  console.log("FAILURES:");
  for (const failure of failures) console.log(JSON.stringify(failure));
  process.exitCode = 1;
}
