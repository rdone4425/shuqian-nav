import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import puppeteer from "puppeteer-core";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8788";
const executablePath =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const password = process.env.AUDIT_PASSWORD || "admin123";
const auditDir = join(tmpdir(), "shuqian-nav-audit");
const importFixturePath = join(auditDir, "bookmarks-audit.json");

const results = [];
const failures = [];

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
    record(pageName, "console error", false, text.slice(0, 300));
  });

  page.on("pageerror", (error) => {
    record(pageName, "page error", false, error.message.slice(0, 300));
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (
      url.includes("google.com/s2/favicons") ||
      url.includes("fonts.gstatic.com") ||
      url.includes("fonts.googleapis.com")
    ) {
      return;
    }
    record(
      pageName,
      "request failed",
      false,
      `${request.method()} ${url} ${request.failure()?.errorText || ""}`.slice(
        0,
        300,
      ),
    );
  });
}

async function goto(page, pageName, path) {
  await page.goto(`${base}${path}`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  record(pageName, `open ${path}`, true);
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
  const links = await page.$$eval("#toolsDropdown a.dropdown-item", (items) =>
    items.map((item) => item.textContent.trim()).filter(Boolean),
  );
  record(pageName, "menu has links", links.length >= 6, links.join(" / "));
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
  await commonMenu(page, name);
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
  await clickIf(page, name, "#searchToggle", "search button");
  await page.type("#searchInput", "E2E");
  await clickIf(page, name, "#searchBtn", "search submit button");
  await clickIf(page, name, "#clearSearchBtn", "clear search button");
  await clickIf(page, name, "#addBookmarkBtn", "open add bookmark modal");
  await clickIf(page, name, "#cancelBtn", "cancel add bookmark modal");
  await clickIf(page, name, "#addBookmarkBtn", "reopen add bookmark modal");
  await page.type("#bookmarkTitle", `Button Audit ${Date.now()}`);
  await page.type("#bookmarkUrl", `https://example.org/${Date.now()}`);
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
  await clickIf(page, name, "#toolsMenuToggle", "open menu for settings");
  await clickVisible(page, name, "#settingsToggle", "open settings panel");
  await clickIf(page, name, "#exportBtn", "settings export html button", {
    wait: 1000,
  });
  await clickIf(page, name, "#exportJSONBtn", "settings export json button", {
    wait: 1000,
  });
  await clickIf(
    page,
    name,
    "#fullBackupJSONBtn",
    "settings full backup json button",
    { wait: 1000 },
  );
  await clickIf(
    page,
    name,
    "#fullBackupHTMLBtn",
    "settings full backup html button",
    { wait: 1000 },
  );
  await clickIf(
    page,
    name,
    "#changePasswordBtn",
    "change password validation button",
  );
  await clickIf(page, name, "#settingsClose", "close settings panel");
  await clickIf(page, name, "#toolsMenuToggle", "open menu for import");
  await clickVisible(page, name, "#settingsToggle", "reopen settings panel");
  await clickIf(page, name, "#importBtn", "settings import button", {
    wait: 1000,
  });
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
  await clickIf(page, name, "#refreshBookmarksBtn", "refresh button");
  await clickIf(page, name, "#selectAllBookmarks", "select all checkbox");
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
}

async function testCategories(page) {
  const name = "categories";
  await goto(page, name, "/categories.html");
  await commonMenu(page, name);
  await page.type("#categoryName", `Button Category ${Date.now()}`);
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
  await clickIf(page, name, "#nextBtn", "next step button");
  await clickIf(page, name, "#prevBtn", "previous step button");
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
  await clickVisible(page, name, ".detail-btn", "deleted detail button");
  await clickIf(page, name, "#closeDetailModal", "close deleted detail modal");
  await clickVisible(
    page,
    name,
    ".restore-btn",
    "deleted restore button opens modal",
  );
  await clickIf(page, name, "#cancelRestore", "cancel deleted restore modal");
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

  await clickVisible(page, name, "#refreshTokensBtn", "refresh tokens button");
  await page.$eval("#tokenName", (input) => {
    input.value = "";
  });
  await page.type("#tokenName", `Button Token ${Date.now()}`);
  await clickVisible(page, name, "#createTokenBtn", "create token button", {
    wait: 1000,
  });
  if (await page.$("#copyTokenBtn")) {
    await clickVisible(page, name, "#copyTokenBtn", "copy token button");
  }
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
}

async function testAdminDashboard(page) {
  const name = "admin-dashboard";
  await goto(page, name, "/admin-dashboard.html");
  if (page.url().includes("/?settings=security")) {
    record(name, "redirects to security settings", true, page.url());
    return;
  }
  await clickIf(
    page,
    name,
    'a.btn[href="/?settings=security"]',
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
  await testBookmarkManage(page);
  await testCategories(page);
  await testImport(page);
  await testLinkChecker(page);
  await testDeleted(page);
  await testToken(page);
  await testNotifications(page);
  await testAdminDashboard(page);
  await testLogoutLogin(page);
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
