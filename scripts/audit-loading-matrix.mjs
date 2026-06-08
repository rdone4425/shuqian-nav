import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const publicDir = join(process.cwd(), "public");

const adminPages = new Map([
  ["admin-dashboard.html", "/js/admin/admin-dashboard.js"],
  ["admin-settings.html", "/js/admin/admin-settings.js"],
  ["bookmarks-manage.html", "/js/admin/bookmark-manager-page.js"],
  ["categories.html", "/js/admin/category-manager.js"],
  ["deleted-bookmarks.html", "/js/admin/deleted-bookmarks.js"],
  ["import.html", "/js/admin/import.js"],
  ["link-checker.html", "/js/admin/link-checker-page.js"],
  ["notifications.html", "/js/admin/notifications-page.js"],
  ["token.html", "/js/admin/token-page.js"],
]);

const homeSharedScripts = new Set([
  "/js/shared/api.js",
  "/js/shared/site-menu.js",
]);

const expectedMenuGroups = [
  ["home", "admin-dashboard"],
  ["bookmarks-manage", "categories", "deleted-bookmarks"],
  ["import"],
  ["link-checker", "notifications"],
  ["admin-settings", "token"],
];

const failures = [];

function readPage(pageName) {
  return readFileSync(join(publicDir, pageName), "utf8");
}

function readPublicJs(scriptPath) {
  return readFileSync(join(publicDir, "js", scriptPath), "utf8");
}

function normalizeScript(src) {
  return src.split("?")[0];
}

function getScriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => normalizeScript(match[1]),
  );
}

function getRawScriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
}

function assertScriptOrder(pageName, scripts, expectedScripts) {
  assertPage(
    pageName,
    JSON.stringify(scripts) === JSON.stringify(expectedScripts),
    `script order must be ${expectedScripts.join(" -> ")}`,
  );
}
function getRawStylesheetHrefs(html) {
  return [
    ...html.matchAll(
      /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi,
    ),
  ].map((match) => match[1]);
}

function getInlineScripts(html) {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/gi)];
}

function assertPage(pageName, condition, message) {
  if (!condition) {
    failures.push(`${pageName}: ${message}`);
  }
}

function listFiles(dir, predicate) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(fullPath, predicate);
    }

    return predicate(fullPath) ? [fullPath] : [];
  });
}

function includesScript(scripts, target) {
  return scripts.includes(target);
}

function getPageKey(html) {
  return html.match(/data-page-key=["']([^"']+)["']/)?.[1] || "";
}

function getMenuItemBlock(siteMenu, key) {
  const keyIndex = siteMenu.indexOf(`key: "${key}"`);
  if (keyIndex < 0) return "";

  const blockStart = siteMenu.lastIndexOf("{", keyIndex);
  const blockEnd = siteMenu.indexOf("},", keyIndex);
  if (blockStart < 0 || blockEnd < 0) return "";

  return siteMenu.slice(blockStart, blockEnd + 1);
}

function getMenuGroupKeys(siteMenu) {
  return [...siteMenu.matchAll(/keys:\s*\[([^\]]*)\]/g)].map((match) =>
    [...match[1].matchAll(/"([^"]+)"/g)].map((keyMatch) => keyMatch[1]),
  );
}

function auditHome() {
  const pageName = "index.html";
  const html = readPage(pageName);
  const scripts = getScriptSources(html);

  assertScriptOrder(pageName, scripts, [
    "/js/home/i18n.js",
    "/js/home/storage.js",
    "/js/shared/api.js",
    "/js/home/sorting.js",
    "/js/home/dom-helper.js",
    "/js/home/ui-helper.js",
    "/js/home/bookmarks.js",
    "/js/home/ui-enhancements.js",
    "/js/shared/site-menu.js",
    "/js/home/app.js",
  ]);

  assertPage(
    pageName,
    html.includes('data-require-auth="false"'),
    "homepage must remain public with data-require-auth=false",
  );
  assertPage(
    pageName,
    !html.includes("settingsPanel") &&
      !html.includes("changePasswordForm") &&
      !html.includes("fullBackup"),
    "homepage must not render admin settings, password, or backup controls",
  );
  assertPage(
    pageName,
    !html.includes('id="addBookmarkBtn"'),
    "homepage must not render an in-page add-bookmark control; admin actions belong on /bookmarks-manage.html",
  );
  assertPage(
    pageName,
    !html.includes('id="bookmarkModal"'),
    "homepage must not embed the bookmark create/edit modal; admin actions belong on /bookmarks-manage.html",
  );
  assertPage(
    pageName,
    !/编辑|删除|新增站点|新增书签|导入|备份|改密码/.test(html),
    "homepage visible HTML must not mention admin actions such as edit, delete, add, import, backup, or password changes",
  );
  assertPage(
    pageName,
    !scripts.includes("/js/shared/auth.js"),
    "homepage must not load /js/shared/auth.js; the public homepage stays decoupled from the auth runtime",
  );

  for (const script of scripts) {
    assertPage(
      pageName,
      script.startsWith("/js/home/") || homeSharedScripts.has(script),
      `homepage must not load admin-only script ${script}`,
    );
  }

  assertPage(
    pageName,
    !scripts.includes("/js/shared/admin-common.js"),
    "homepage must not load shared admin-common.js",
  );
}

function auditPublicJsRootBoundary() {
  const allowedRootScripts = new Set(["login.js"]);
  const rootScripts = readdirSync(join(publicDir, "js"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name);

  for (const scriptName of rootScripts) {
    assertPage(
      "public/js",
      allowedRootScripts.has(scriptName),
      `root script ${scriptName} must move under /js/home/, /js/admin/, or /js/shared/`,
    );
  }
}
function auditSharedRuntimeOwnership() {
  const legacySharedScriptPaths = [
    "/js/auth.js",
    "/js/site-menu.js",
    "/js/admin-common.js",
    "/js/utils/api.js",
  ];
  const pageFiles = listFiles(publicDir, (filePath) =>
    filePath.endsWith(".html"),
  );

  for (const filePath of pageFiles) {
    const pageName = basename(filePath);
    const scripts = getScriptSources(readFileSync(filePath, "utf8"));

    for (const legacyPath of legacySharedScriptPaths) {
      assertPage(
        pageName,
        !scripts.includes(legacyPath),
        `legacy shared runtime path ${legacyPath} must stay migrated under /js/shared/`,
      );
    }
  }

  for (const legacyPath of legacySharedScriptPaths) {
    assertPage(
      legacyPath,
      !existsSync(join(publicDir, legacyPath.slice(1))),
      `legacy shared runtime file ${legacyPath} must not exist outside /js/shared/`,
    );
  }
}
function auditAdminScriptOwnership() {
  const legacyAdminScriptPaths = [
    "/js/admin-settings.js",
    "/js/bookmark-manager-page.js",
    "/js/category-manager.js",
    "/js/deleted-bookmarks.js",
    "/js/import.js",
    "/js/link-checker-page.js",
    "/js/notifications-page.js",
    "/js/token-page.js",
  ];
  const pageFiles = listFiles(publicDir, (filePath) =>
    filePath.endsWith(".html"),
  );

  for (const filePath of pageFiles) {
    const pageName = basename(filePath);
    const scripts = getScriptSources(readFileSync(filePath, "utf8"));

    for (const legacyPath of legacyAdminScriptPaths) {
      assertPage(
        pageName,
        !scripts.includes(legacyPath),
        `legacy admin module path ${legacyPath} must stay migrated under /js/admin/`,
      );
    }
  }

  for (const legacyPath of legacyAdminScriptPaths) {
    assertPage(
      legacyPath,
      !existsSync(join(publicDir, legacyPath.slice(1))),
      `legacy admin module file ${legacyPath} must not exist outside /js/admin/`,
    );
  }
}

function auditHomeScriptOwnership() {
  const pageFiles = listFiles(publicDir, (filePath) =>
    filePath.endsWith(".html"),
  );
  const legacyHomeScriptPaths = [
    "/js/i18n.js",
    "/js/app.js",
    "/js/bookmarks.js",
    "/js/ui-enhancements.js",
    "/js/utils/storage.js",
    "/js/utils/sorting.js",
    "/js/utils/dom-helper.js",
    "/js/utils/ui-helper.js",
  ];

  for (const filePath of pageFiles) {
    const pageName = basename(filePath);
    const scripts = getScriptSources(readFileSync(filePath, "utf8"));
    const isHomePage = pageName === "index.html";

    assertPage(
      pageName,
      isHomePage || !scripts.some((script) => script.startsWith("/js/home/")),
      "only the homepage may load /js/home/* scripts",
    );

    for (const legacyPath of legacyHomeScriptPaths) {
      assertPage(
        pageName,
        !scripts.includes(legacyPath),
        `legacy homepage script path ${legacyPath} must stay migrated under /js/home/`,
      );
    }
  }

  for (const legacyPath of legacyHomeScriptPaths) {
    assertPage(
      legacyPath,
      !existsSync(join(publicDir, legacyPath.slice(1))),
      `legacy homepage script file ${legacyPath} must not exist outside /js/home/`,
    );
  }
}

function auditAdminPage(pageName, expectedModule) {
  const html = readPage(pageName);
  const scripts = getScriptSources(html);
  const inlineScripts = getInlineScripts(html);
  const expectedPageKey = pageName.replace(/\.html$/, "");

  const expectedScriptOrder =
    pageName === "token.html"
      ? [
          "/js/shared/auth.js",
          "/js/shared/admin-menu.js",
          "/js/shared/site-menu.js",
          "/js/shared/admin-common.js",
          "/js/shared/admin-shell.js",
          expectedModule,
        ]
      : [
          "/js/shared/api.js",
          "/js/shared/auth.js",
          "/js/shared/admin-menu.js",
          "/js/shared/site-menu.js",
          "/js/shared/admin-common.js",
          "/js/shared/admin-shell.js",
          expectedModule,
        ];

  assertScriptOrder(pageName, scripts, expectedScriptOrder);

  assertPage(
    pageName,
    html.includes("data-site-header"),
    "missing site header",
  );
  assertPage(pageName, html.includes("data-page-key="), "missing page key");
  assertPage(
    pageName,
    getPageKey(html) === expectedPageKey,
    `data-page-key must be ${expectedPageKey}`,
  );
  assertPage(
    pageName,
    !html.includes('data-require-auth="false"'),
    "admin page must not opt out of auth",
  );
  assertPage(
    pageName,
    includesScript(scripts, "/js/shared/auth.js"),
    "missing shared auth.js",
  );
  assertPage(
    pageName,
    includesScript(scripts, "/js/shared/site-menu.js"),
    "missing shared site-menu.js",
  );
  assertPage(
    pageName,
    includesScript(scripts, "/js/shared/admin-common.js"),
    "missing admin-common.js",
  );
  assertPage(
    pageName,
    includesScript(scripts, "/js/shared/admin-shell.js"),
    "missing unified admin-shell.js",
  );
  assertPage(
    pageName,
    includesScript(scripts, expectedModule),
    `missing page module ${expectedModule}`,
  );
  assertPage(
    pageName,
    !scripts.some((script) => script.startsWith("/js/home/")),
    "admin page must not load homepage scripts",
  );
  assertPage(
    pageName,
    !scripts.includes("/js/i18n.js") && !scripts.includes("/js/home/i18n.js"),
    "admin page must not load homepage i18n.js",
  );
  assertPage(
    pageName,
    inlineScripts.length === 0,
    "admin page must keep business logic in external modules",
  );
  assertPage(
    pageName,
    html.includes("workspace-section-heading"),
    "admin page must use the shared workspace section heading shell",
  );
}

function auditAdminModulesRequireAuth() {
  for (const [pageName, expectedModule] of adminPages) {
    const modulePath = join(publicDir, expectedModule.slice(1));
    const source = readFileSync(modulePath, "utf8");

    assertPage(
      expectedModule,
      source.includes("AdminUI.requireAuth("),
      `${pageName} module must call AdminUI.requireAuth before protected work`,
    );
  }
}

function auditAuthBoundaryImplementations() {
  const homeApp = readPublicJs("home/app.js");
  const homeBookmarks = readPublicJs("home/bookmarks.js");
  const siteMenu = readPublicJs("shared/site-menu.js");
  const adminCommon = readPublicJs("shared/admin-common.js");
  const adminShell = readPublicJs("shared/admin-shell.js");

  assertPage(
    "public/js/home/app.js",
    !/\bAuth\b/.test(homeApp),
    "homepage controller must not reference the Auth runtime; public homepage stays decoupled from auth",
  );
  assertPage(
    "public/js/home/bookmarks.js",
    !/\bAuth\b/.test(homeBookmarks),
    "homepage bookmarks module must not reference the Auth runtime; public homepage stays decoupled from auth",
  );
  assertPage(
    "public/js/shared/site-menu.js",
    /data-require-auth/.test(siteMenu) &&
      /getAttribute\("data-require-auth"\)\s*!==\s*"false"/.test(siteMenu) &&
      /Auth\.init\(\{\s*requireAuth\s*\}\)/.test(siteMenu),
    "site menu must derive Auth.init requireAuth from the data-require-auth attribute",
  );
  assertPage(
    "public/js/shared/site-menu.js",
    /this\.syncAuthState\(host, requireAuth\);[\s\S]{0,80}this\.syncMenuAuthState\(host, requireAuth\);/.test(
      siteMenu,
    ),
    "site menu must apply guest auth UI even when window.Auth is absent (public homepage)",
  );
  assertPage(
    "public/js/shared/admin-common.js",
    /Auth\.init\(\{\s*requireAuth:\s*true\s*\}\)/.test(adminCommon),
    "admin helper must initialize Auth with requireAuth=true",
  );
  assertPage(
    "public/js/shared/admin-shell.js",
    adminShell.includes("getAdminMenuGroups") &&
      adminShell.includes("admin-sidebar") &&
      adminShell.includes("data-admin-shell-logout"),
    "admin shell must render the unified sidebar and logout action from the shared menu contract",
  );
  const auth = readPublicJs("shared/auth.js");
  assertPage(
    "public/js/shared/auth.js",
    auth.includes("verifiedToken") &&
      auth.includes("verifyPromise") &&
      auth.includes("verifySession(token)"),
    "shared auth must cache verified sessions and reuse in-flight verification",
  );
}

function auditSiteMenuInformationArchitecture() {
  const siteMenu = readPublicJs("shared/site-menu.js");
  const menuGroups = getMenuGroupKeys(siteMenu);
  const expectedKeys = expectedMenuGroups.flat();
  const adminPageKeys = [...adminPages.keys()].map((pageName) =>
    pageName.replace(/\.html$/, ""),
  );

  assertPage(
    "public/js/shared/site-menu.js",
    JSON.stringify(menuGroups) === JSON.stringify(expectedMenuGroups),
    "site menu groups must preserve the roadmap information architecture",
  );

  for (const key of expectedKeys) {
    assertPage(
      "public/js/shared/site-menu.js",
      Boolean(getMenuItemBlock(siteMenu, key)),
      `site menu item ${key} must exist`,
    );
  }

  for (const pageName of adminPages.keys()) {
    const key = pageName.replace(/\.html$/, "");
    const block = getMenuItemBlock(siteMenu, key);
    assertPage(
      "public/js/shared/site-menu.js",
      Boolean(block),
      `admin page ${key} must have a matching site menu item`,
    );
    assertPage(
      "public/js/shared/site-menu.js",
      /requiresAuth:\s*true/.test(block),
      `admin page menu item ${key} must require auth`,
    );
    assertPage(
      "public/js/shared/site-menu.js",
      new RegExp(`href:\\s*"/${pageName.replace(".", "\\.")}"`).test(block),
      `admin page menu item ${key} must link directly to /${pageName}`,
    );
  }

  for (const key of expectedKeys.filter((item) => item !== "home")) {
    const block = getMenuItemBlock(siteMenu, key);
    assertPage(
      "public/js/shared/site-menu.js",
      /requiresAuth:\s*true/.test(block),
      `protected menu item ${key} must require auth`,
    );
  }

  assertPage(
    "public/js/shared/site-menu.js",
    !/data-site-header-nav-link/.test(siteMenu),
    "site menu must not reintroduce a second fixed nav link system",
  );
  assertPage(
    "public/js/shared/site-menu.js",
    siteMenu.includes("data-public-login-prompt") &&
      siteMenu.includes("isPublicGuest") &&
      /isPublicPage[\s\S]*?\[data-auth-group\][\s\S]*?classList\.toggle\("hidden",\s*isPublicPage\)/.test(
        siteMenu,
      ),
    "site menu must collapse protected groups into a single admin entry on the public homepage",
  );
}

function auditSharedHeaderDefaults() {
  const pageName = "components/header.html";
  const html = readPage(pageName);

  assertPage(
    pageName,
    html.includes('<span class="action-btn-label">菜单</span>'),
    "shared header menu button must use neutral menu text instead of a duplicate admin label",
  );
  assertPage(
    pageName,
    html.includes('title="登录后台"') &&
      html.includes('<span class="btn-icon" aria-hidden="true">↗</span>') &&
      html.includes('<span class="action-btn-label">登录后台</span>'),
    "shared header must default to the public login action before auth state is known",
  );
}

function auditLogin() {
  const pageName = "login.html";
  const scripts = getScriptSources(readPage(pageName));
  assertScriptOrder(pageName, scripts, ["/js/shared/auth.js", "/js/login.js"]);
  assertPage(
    pageName,
    scripts.length === 2 &&
      includesScript(scripts, "/js/shared/auth.js") &&
      includesScript(scripts, "/js/login.js"),
    "login page should only load shared auth.js and login.js",
  );
}

function auditAdminDashboardPage() {
  const pageName = "admin-dashboard.html";
  const html = readPage(pageName);
  assertPage(
    pageName,
    !html.includes('http-equiv="refresh"') &&
      html.includes("admin-dashboard-grid") &&
      html.includes("/js/admin/admin-dashboard.js"),
    "admin dashboard must be a real protected overview page",
  );
  assertPage(
    pageName,
    html.includes("/js/shared/admin-shell.js"),
    "admin dashboard must load the unified admin shell",
  );
}

function auditUnifiedSiteHeader() {
  const pageName = "components/header.html";
  const html = readPage(pageName);

  assertPage(
    pageName,
    html.includes("data-site-header-shell"),
    "shared header partial must render the site header shell",
  );
  assertPage(
    pageName,
    !html.includes('class="nav-menu"') &&
      !html.includes("data-site-header-nav-link"),
    "shared header must not render a second fixed nav; use the SiteMenu dropdown as the single menu source",
  );
}

function auditPublicJsEventBinding() {
  const jsFiles = listFiles(join(publicDir, "js"), (filePath) =>
    filePath.endsWith(".js"),
  );

  for (const filePath of jsFiles) {
    const source = readFileSync(filePath, "utf8");
    const pageName = filePath.slice(process.cwd().length + 1);
    assertPage(
      pageName,
      !/\bonclick\s*=|\.onclick\s*=/.test(source),
      "use addEventListener instead of inline onclick handlers",
    );
  }
}

function auditNoPrivateConfirmArtifacts() {
  const files = listFiles(publicDir, (filePath) =>
    /\.(css|html|js)$/.test(filePath),
  );
  const privateConfirmArtifacts = [
    "token-confirm",
    "deleted-confirm",
    "import-confirm",
    "link-checker-confirm",
    "actionConfirmModal",
    "deleteTokenModal",
    "deleteBookmarksModal",
    "deleteBookmarksSummary",
    "confirmDeleteBookmarksBtn",
    "importConfirm",
  ];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const pageName = filePath.slice(process.cwd().length + 1);

    for (const artifact of privateConfirmArtifacts) {
      assertPage(
        pageName,
        !source.includes(artifact),
        `private confirmation artifact ${artifact} must use AdminUI.confirm instead`,
      );
    }
  }
}

function auditCategoryDeleteSharedConfirm() {
  const source = readPublicJs("admin/category-manager.js");
  const html = readPage("categories.html");

  assertPage(
    "public/js/admin/category-manager.js",
    /confirmDeleteCategory\(\)[\s\S]*?AdminUI\.confirm\(/.test(source),
    "category delete must use AdminUI.confirm after migration target selection",
  );
  assertPage(
    "categories.html",
    !/id="confirmDeleteCategoryBtn"[\s\S]{0,160}class="[^"]*\bbtn-danger\b/.test(
      html,
    ),
    "category migration-target modal must not be the final dangerous confirmation",
  );
}

function auditAdminSettingsLocalActions() {
  const html = readPage("admin-settings.html");
  const siteMenu = readPublicJs("shared/site-menu.js");

  assertPage(
    "admin-settings.html",
    !/<a\b[^>]*href=["']\/import\.html["'][^>]*>[\s\S]*?<\/a>/i.test(html),
    "settings page must not duplicate the import entry from the unified site menu",
  );
  assertPage(
    "public/js/shared/site-menu.js",
    /key:\s*"import"[\s\S]*?href:\s*"\/import\.html"/.test(siteMenu),
    "unified site menu must keep the import entry as the single navigation source",
  );
}

function auditScriptCacheBusting() {
  const pageFiles = listFiles(publicDir, (filePath) =>
    filePath.endsWith(".html"),
  );

  for (const filePath of pageFiles) {
    const pageName = basename(filePath);
    const scripts = getRawScriptSources(readFileSync(filePath, "utf8"));

    scripts
      .filter((script) => normalizeScript(script).startsWith("/js/"))
      .forEach((script) => {
        const scriptName = normalizeScript(script);
        assertPage(
          pageName,
          /\?v=nav-/.test(script),
          `${scriptName} references must include a nav cache-busting query string`,
        );
      });
  }
}

function auditCurrentCacheVersions() {
  const pageFiles = listFiles(publicDir, (filePath) =>
    filePath.endsWith(".html"),
  );
  const expectedVersions = new Map([
    ["/js/shared/auth.js", "nav-20260602-auth-cache"],
    ["/js/shared/admin-menu.js", "nav-20260605-admin-menu"],
    ["/js/shared/site-menu.js", "nav-20260605-admin-menu"],
    ["/js/shared/admin-shell.js", "nav-20260603-admin-shell"],
    ["/js/admin/bookmark-manager-page.js", "nav-20260605-spa"],
    ["/js/admin/category-manager.js", "nav-20260608-category-parent"],
  ]);

  for (const filePath of pageFiles) {
    const pageName = basename(filePath);
    const scripts = getRawScriptSources(readFileSync(filePath, "utf8"));

    for (const script of scripts) {
      const scriptName = normalizeScript(script);
      const expectedVersion = expectedVersions.get(scriptName);
      if (!expectedVersion) continue;

      assertPage(
        pageName,
        script.includes(`?v=${expectedVersion}`),
        `${scriptName} must use cache-busting version ${expectedVersion}`,
      );
    }
  }
}

function auditCssCacheBusting() {
  const pageFiles = listFiles(publicDir, (filePath) =>
    filePath.endsWith(".html"),
  );

  for (const filePath of pageFiles) {
    const pageName = basename(filePath);
    const stylesheets = getRawStylesheetHrefs(readFileSync(filePath, "utf8"));

    stylesheets
      .filter((href) => normalizeScript(href).startsWith("/css/"))
      .filter((href) => normalizeScript(href) !== "/css/styles.css")
      .forEach((href) => {
        assertPage(
          pageName,
          /\?v=nav-/.test(href),
          `${normalizeScript(href)} references must include a nav cache-busting query string`,
        );
      });
  }
}

function auditLoadingMatrixDocs() {
  const docPath = join(process.cwd(), "docs", "refactor-loading-matrix.md");
  const source = readFileSync(docPath, "utf8");
  const staleSnippets = [
    "`auth.js`、`site-menu.js`、`utils/api.js`",
    "`auth.js`、`site-menu.js`、`admin-common.js`",
    "`utils/api.js`",
    "utils/api.js            # shared API client",
    "admin-common.js         # admin-only helper",
    "  auth.js                 # shared",
    "  site-menu.js            # shared header/menu runtime",
    "Admin pages still load `utils/api.js`, `auth.js`, `site-menu.js`",
  ];
  const requiredSnippets = [
    "public/js/shared/",
    "public/js/home/",
    "public/js/admin/",
    "`public/js/` 根目录只允许保留 `login.js`",
    "/js/shared/auth.js",
    "/js/shared/site-menu.js",
    "/js/shared/api.js",
    "/js/shared/admin-common.js",
    "/js/admin/bookmark-manager-page.js",
    "/js/home/i18n.js",
  ];

  for (const snippet of staleSnippets) {
    assertPage(
      "docs/refactor-loading-matrix.md",
      !source.includes(snippet),
      `loading matrix doc must not contain stale path text: ${snippet}`,
    );
  }

  for (const snippet of requiredSnippets) {
    assertPage(
      "docs/refactor-loading-matrix.md",
      source.includes(snippet),
      `loading matrix doc must mention current contract: ${snippet}`,
    );
  }
}

auditHome();
auditPublicJsRootBoundary();
auditHomeScriptOwnership();
auditAdminScriptOwnership();
auditSharedRuntimeOwnership();
for (const [pageName, expectedModule] of adminPages) {
  auditAdminPage(pageName, expectedModule);
}
auditAdminModulesRequireAuth();
auditAuthBoundaryImplementations();
auditSiteMenuInformationArchitecture();
auditLogin();
auditAdminDashboardPage();
auditUnifiedSiteHeader();
auditSharedHeaderDefaults();
auditPublicJsEventBinding();
auditNoPrivateConfirmArtifacts();
auditCategoryDeleteSharedConfirm();
auditAdminSettingsLocalActions();
auditScriptCacheBusting();
auditCurrentCacheVersions();
auditCssCacheBusting();
auditLoadingMatrixDocs();

if (failures.length) {
  console.error("Loading matrix audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Loading matrix audit passed for ${adminPages.size + 3} pages in ${basename(
    publicDir,
  )}.`,
);
