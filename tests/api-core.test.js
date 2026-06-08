import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { onRequestPost as loginHandler } from "../pages/functions/api/auth/login.js";
import { onRequestPost as changePasswordHandler } from "../pages/functions/api/auth/change-password.js";
import { onRequestGet as healthHandler } from "../pages/functions/api/health.js";
import {
  onRequestGet as performanceGetHandler,
  onRequestPut as performancePutHandler,
} from "../pages/functions/api/system/performance.js";
import {
  onRequestGet as optimizeDatabaseGetHandler,
  onRequestPost as optimizeDatabasePostHandler,
} from "../pages/functions/api/system/optimize-database.js";
import {
  onRequestGet as backupDataGetHandler,
  onRequestPost as backupDataPostHandler,
} from "../pages/functions/api/system/backup-data.js";
import { onRequestGet as backupExportGetHandler } from "../pages/functions/api/system/backup.js";
import {
  onRequestDelete as backupAutoDeleteHandler,
  onRequestGet as backupAutoGetHandler,
  onRequestPost as backupAutoPostHandler,
  onRequestPut as backupAutoPutHandler,
} from "../pages/functions/api/system/backup-auto.js";
import {
  onRequestGet as checkLinksStreamGetHandler,
  onRequestPost as checkLinksStreamPostHandler,
} from "../pages/functions/api/system/check-links-stream.js";
import {
  onRequestGet as checkLinksGetHandler,
  onRequestPost as checkLinksPostHandler,
} from "../pages/functions/api/system/check-links.js";
import {
  onRequestGet as weeklyCheckGetHandler,
  onRequestPost as weeklyCheckPostHandler,
} from "../pages/functions/api/cron/weekly-check.js";
import {
  onRequestGet as analyticsGetHandler,
  onRequestPost as analyticsPostHandler,
  onRequestPut as analyticsPutHandler,
} from "../pages/functions/api/analytics/index.js";
import { onRequestPost as migrateKeepStatusHandler } from "../pages/functions/api/system/migrate.js";
import { onRequestPost as migrateDeletedBookmarksHandler } from "../pages/functions/api/system/migrate-deleted-bookmarks.js";
import {
  onRequestPost as verifyHandler,
  verifyToken as verifyPublicToken,
  authenticateRequest,
} from "../pages/functions/api/auth/verify.js";
import {
  onRequestGet as tokenListHandler,
  onRequestPost as tokenCreateHandler,
  verifyApiToken,
} from "../pages/functions/api/auth/token.js";
import {
  onRequestGet as syncListHandler,
  onRequestPost as syncPostHandler,
} from "../pages/functions/api/bookmarks/sync.js";
import { onRequestPost as keepStatusHandler } from "../pages/functions/api/bookmarks/keep-status.js";
import {
  onRequestGet as bookmarkListHandler,
  onRequestPost as bookmarkCreateHandler,
} from "../pages/functions/api/bookmarks/index.js";
import {
  onRequestDelete as bookmarkDeleteHandler,
  onRequestPut as bookmarkUpdateHandler,
} from "../pages/functions/api/bookmarks/[id].js";
import { onRequestPost as bookmarkVisitHandler } from "../pages/functions/api/bookmarks/[id]/visit.js";
import { onRequestPost as batchDeleteHandler } from "../pages/functions/api/bookmarks/batch-delete.js";
import { onRequestPost as batchMoveHandler } from "../pages/functions/api/bookmarks/batch-move.js";
import {
  onRequestDelete as deletedPermanentDeleteHandler,
  onRequestGet as deletedListHandler,
  onRequestPost as deletedRestoreHandler,
} from "../pages/functions/api/bookmarks/deleted.js";
import {
  onRequestGet as categoryListHandler,
  onRequestPost as categoryCreateHandler,
} from "../pages/functions/api/bookmarks/categories.js";
import {
  onRequestDelete as categoryDeleteHandler,
  onRequestPut as categoryUpdateHandler,
} from "../pages/functions/api/bookmarks/categories/[id].js";
import { onRequestPost as bookmarkClearHandler } from "../pages/functions/api/bookmarks/clear.js";
import { onRequestPost as bookmarkImportHandler } from "../pages/functions/api/bookmarks/import.js";
import { JWTKeyManager } from "../pages/functions/utils/jwt-manager.js";
import {
  getKnownProtectedSiteResult,
  isKnownProtectedSite,
} from "../pages/functions/utils/link-checker-protection.js";
import {
  classifyHttpResponse,
  classifyNetworkError,
} from "../pages/functions/utils/link-checker-status.js";

function createDbMock({
  firstResult,
  firstError,
  runResult,
  runError,
  allResult,
  allError,
  execResult,
  execError,
} = {}) {
  function createExecution(sql, params = []) {
    return {
      async first() {
        if (firstError) {
          throw firstError;
        }
        if (typeof firstResult === "function") {
          return firstResult({ sql, params });
        }
        return firstResult ?? null;
      },
      async run() {
        if (runError) {
          throw runError;
        }
        if (typeof runResult === "function") {
          return runResult({ sql, params });
        }
        return runResult ?? { success: true, changes: 1 };
      },
      async all() {
        if (allError) {
          throw allError;
        }
        if (typeof allResult === "function") {
          return allResult({ sql, params });
        }
        return allResult ?? { results: [] };
      },
    };
  }

  return {
    async exec(sql) {
      if (execError) {
        throw execError;
      }
      if (typeof execResult === "function") {
        return execResult({ sql });
      }
      return execResult ?? { success: true };
    },
    prepare(sql) {
      const execution = createExecution(sql);
      return {
        ...execution,
        bind(...params) {
          return createExecution(sql, params);
        },
      };
    },
  };
}

function loadBrowserApi(fetchImpl) {
  const code = readFileSync(
    new URL("../public/js/shared/api.js", import.meta.url),
    "utf8",
  );
  const context = {
    window: {
      location: { origin: "https://example.com" },
      Auth: {
        getAuthHeaders() {
          return {};
        },
        logout() {},
      },
    },
    document: { referrer: "" },
    navigator: { userAgent: "node-test" },
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    AbortController,
    APIError: undefined,
    console,
  };
  context.globalThis = context;
  vm.runInNewContext(`${code}\nglobalThis.__API = API;`, context);
  return context.__API;
}

function loadBrowserAuth(fetchImpl) {
  const code = readFileSync(
    new URL("../public/js/shared/auth.js", import.meta.url),
    "utf8",
  );
  const storage = new Map();
  const context = {
    window: {
      location: {
        pathname: "/bookmarks-manage.html",
        search: "",
        href: "https://example.com/bookmarks-manage.html",
      },
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    fetch: fetchImpl,
    console,
  };
  context.globalThis = context;
  vm.runInNewContext(`${code}\nglobalThis.__Auth = Auth;`, context);
  return { Auth: context.__Auth, storage, window: context.window };
}

test("browser API treats aborted signal timeout errors as TimeoutError", async () => {
  const api = loadBrowserApi((url, options) => {
    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        reject(new TypeError("signal is aborted without reason"));
      });
    });
  });
  api.config.retryAttempts = 0;

  await assert.rejects(
    () => api.post("/api/bookmarks/clear", {}, { timeout: 1 }),
    (error) => {
      assert.equal(error.name, "TimeoutError");
      assert.match(error.message, /Request timed out/);
      return true;
    },
  );
});

test("browser auth accepts shared-envelope login responses", async () => {
  const { Auth, storage } = loadBrowserAuth(async (url) => {
    assert.equal(url, "/api/auth/login");
    return new Response(
      JSON.stringify({
        success: true,
        data: { token: "session-token", user: { role: "admin" } },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  const result = await Auth.login("StrongPass123");

  assert.equal(result.data.token, "session-token");
  assert.equal(Auth.isAuthenticated, true);
  assert.equal(Auth.currentUser.role, "admin");
  assert.equal(storage.get("bookmark_nav_token"), "session-token");
});

test("browser auth accepts shared-envelope verify responses", async () => {
  const { Auth, storage } = loadBrowserAuth(async (url) => {
    assert.equal(url, "/api/auth/verify");
    return new Response(
      JSON.stringify({
        success: true,
        data: { user: { role: "admin" } },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  storage.set("bookmark_nav_token", "session-token");

  const ok = await Auth.init({ requireAuth: true });

  assert.equal(ok, true);
  assert.equal(Auth.isAuthenticated, true);
  assert.equal(Auth.currentUser.role, "admin");
});

test("browser auth reuses a verified session for the same token", async () => {
  let verifyCalls = 0;
  const { Auth, storage } = loadBrowserAuth(async (url) => {
    verifyCalls += 1;
    assert.equal(url, "/api/auth/verify");
    return new Response(
      JSON.stringify({
        success: true,
        data: { user: { role: "admin" } },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  storage.set("bookmark_nav_token", "session-token");

  assert.equal(await Auth.init({ requireAuth: true }), true);
  assert.equal(await Auth.init({ requireAuth: true }), true);

  assert.equal(verifyCalls, 1);
});

test("browser auth shares concurrent verification for the same token", async () => {
  let verifyCalls = 0;
  let resolveVerify;
  const { Auth, storage } = loadBrowserAuth(async (url) => {
    verifyCalls += 1;
    assert.equal(url, "/api/auth/verify");
    return await new Promise((resolve) => {
      resolveVerify = () =>
        resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { user: { role: "admin" } },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
    });
  });
  storage.set("bookmark_nav_token", "session-token");

  const first = Auth.init({ requireAuth: true });
  const second = Auth.init({ requireAuth: true });
  assert.equal(verifyCalls, 1);
  resolveVerify();

  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(verifyCalls, 1);
});

test("login endpoint issues a web session token for the admin password", async () => {
  const request = new Request("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "StrongPass123" }),
  });

  const response = await loginHandler({
    request,
    env: {
      ADMIN_PASSWORD: "StrongPass123",
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.token, "string");
  assert.equal(body.data.token, body.token);
  assert.equal(body.user.role, "admin");
  assert.equal(body.data.user.role, "admin");
  assert.equal(body.message, "Login successful.");
  assert.equal(typeof body.timestamp, "string");
});

test("login endpoint rejects bad passwords with the shared envelope", async () => {
  const response = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    }),
    env: {
      ADMIN_PASSWORD: "StrongPass123",
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Incorrect password.");
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.token, undefined);
});

test("change-password requires an authenticated session", async () => {
  const request = new Request("https://example.com/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPassword: "admin123",
      newPassword: "new-pass",
    }),
  });

  const response = await changePasswordHandler({
    request,
    env: {
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(response.status, 401);

  const body = await response.json();
  assert.equal(body.success, false);
  assert.match(body.error, /令牌|登录/i);
});

test("change-password updates the stored password after env-password login", async () => {
  const config = new Map([["admin_password", "admin123"]]);
  const env = {
    ADMIN_PASSWORD: "EnvPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config") && params[0] === "admin_password") {
          return { config_value: config.get("admin_password") };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("system_config") && params[0] === "admin_password") {
          config.set("admin_password", params[1]);
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "EnvPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const changeResponse = await changePasswordHandler({
    request: new Request("https://example.com/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        currentPassword: "EnvPass123",
        newPassword: "NewPass456",
      }),
    }),
    env,
  });

  assert.equal(changeResponse.status, 200);
  assert.equal(config.get("admin_password"), "NewPass456");

  const reloginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "NewPass456" }),
    }),
    env,
  });

  assert.equal(reloginResponse.status, 200);
});

test("verify helper accepts a login token", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };
  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();
  const request = new Request("http://127.0.0.1:8788/api/auth/verify");
  request.headers.set("Authorization", `Bearer ${loginBody.token}`);
  const result = await verifyPublicToken(request, env);

  assert.equal(result.valid, true);
  assert.equal(result.payload.sub, "admin");
  assert.equal(result.payload.role, "admin");
});

test("verify endpoint uses the shared response envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };

  const rejected = await verifyHandler({
    request: new Request("https://example.com/api/auth/verify", {
      method: "POST",
    }),
    env,
  });

  assert.equal(rejected.status, 401);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const accepted = await verifyHandler({
    request: new Request("https://example.com/api/auth/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginBody.token}`,
      },
    }),
    env,
  });

  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.success, true);
  assert.equal(acceptedBody.data.user.role, "admin");
  assert.equal(typeof acceptedBody.timestamp, "string");
});

test("authenticateRequest blocks requests without a login token", async () => {
  const request = new Request("https://example.com/api/bookmarks", {
    method: "POST",
  });

  const result = await authenticateRequest(request, {
    ENVIRONMENT: "production",
  });

  assert.equal(result.authenticated, false);
  assert.match(result.error, /令牌|登录/i);
});

test("authenticateRequest accepts a login token", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };
  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();
  const request = new Request("https://example.com/api/bookmarks", {
    method: "POST",
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });

  const result = await authenticateRequest(request, env);

  assert.equal(result.authenticated, true);
  assert.equal(result.user.role, "admin");
});

test("bookmark and category lists are public read-only endpoints", async () => {
  const env = {
    ENVIRONMENT: "production",
    BOOKMARKS_DB: createDbMock({
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks b")) {
          return {
            results: [
              {
                id: 1,
                title: "Example",
                url: "https://example.com",
                description: "",
                favicon_url: null,
                keep_status: "normal",
                visit_count: 0,
                last_visited: null,
                created_at: "2026-06-01T00:00:00.000Z",
                updated_at: "2026-06-01T00:00:00.000Z",
                category_id: 2,
                category_name: "Tools",
                category_color: "#2563eb",
              },
            ],
          };
        }

        if (sql.includes("FROM categories c")) {
          return {
            results: [
              {
                id: 2,
                name: "Tools",
                color: "#2563eb",
                description: "",
                bookmark_count: 1,
              },
            ],
          };
        }

        return { results: [] };
      },
      firstResult({ sql }) {
        if (sql.includes("COUNT(*) as total")) {
          return { total: 1 };
        }
        return null;
      },
    }),
  };

  const bookmarksResponse = await bookmarkListHandler({
    request: new Request("https://example.com/api/bookmarks"),
    env,
  });
  const categoriesResponse = await categoryListHandler({
    request: new Request("https://example.com/api/bookmarks/categories"),
    env,
  });

  assert.equal(bookmarksResponse.status, 200);
  assert.equal(categoriesResponse.status, 200);
  assert.equal((await bookmarksResponse.json()).data.bookmarks.length, 1);
  assert.equal((await categoriesResponse.json()).data.length, 1);
});

test("bookmark list clamps unsafe pagination parameters", async () => {
  let bookmarkQueryParams = null;
  const env = {
    BOOKMARKS_DB: createDbMock({
      allResult({ sql, params }) {
        if (sql.includes("FROM bookmarks b")) {
          bookmarkQueryParams = params;
        }
        return { results: [] };
      },
      firstResult({ sql }) {
        if (sql.includes("COUNT(*) as total")) {
          return { total: 10 };
        }
        return null;
      },
    }),
  };

  const response = await bookmarkListHandler({
    request: new Request("https://example.com/api/bookmarks?page=-2&limit=-1"),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(bookmarkQueryParams.slice(-2), [1, 0]);
  assert.equal(body.data.pagination.page, 1);
  assert.equal(body.data.pagination.limit, 1);
  assert.equal(body.data.pagination.totalPages, 10);
});

test("bookmark list category filter includes child categories", async () => {
  let bookmarkQuery = null;
  let bookmarkQueryParams = null;
  const env = {
    BOOKMARKS_DB: createDbMock({
      allResult({ sql, params }) {
        if (sql.includes("FROM bookmarks b")) {
          bookmarkQuery = sql;
          bookmarkQueryParams = params;
        }
        return { results: [] };
      },
      firstResult({ sql }) {
        if (sql.includes("COUNT(*) as total")) {
          return { total: 0 };
        }
        return null;
      },
    }),
  };

  const response = await bookmarkListHandler({
    request: new Request("https://example.com/api/bookmarks?category=5"),
    env,
  });

  assert.equal(response.status, 200);
  assert.match(bookmarkQuery, /SELECT category_id FROM category_hierarchy/);
  assert.deepEqual(bookmarkQueryParams.slice(0, 2), ["5", "5"]);
});

test("bookmark list falls back when category hierarchy is missing", async () => {
  let fallbackQuery = null;
  let fallbackParams = null;
  const env = {
    BOOKMARKS_DB: createDbMock({
      allResult({ sql, params }) {
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("FROM bookmarks b")) {
          fallbackQuery = sql;
          fallbackParams = params;
          return {
            results: [
              {
                id: 1,
                title: "Example",
                url: "https://example.com",
                category_id: 5,
                category_name: "Docs",
                category_display_name: "Docs",
              },
            ],
          };
        }
        return { results: [] };
      },
      firstResult({ sql }) {
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("COUNT(*) as total")) {
          return { total: 1 };
        }
        return null;
      },
    }),
  };

  const response = await bookmarkListHandler({
    request: new Request("https://example.com/api/bookmarks?category=5"),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.doesNotMatch(fallbackQuery, /category_hierarchy/);
  assert.deepEqual(fallbackParams, ["5", 20, 0]);
  assert.equal(body.data.bookmarks.length, 1);
});

test("category list falls back when category hierarchy is missing", async () => {
  const env = {
    BOOKMARKS_DB: createDbMock({
      allResult({ sql }) {
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("FROM categories c")) {
          return {
            results: [
              {
                id: 2,
                name: "Docs",
                parent_id: null,
                display_name: "Docs",
                bookmark_count: 3,
              },
            ],
          };
        }
        return { results: [] };
      },
    }),
  };

  const response = await categoryListHandler({
    request: new Request("https://example.com/api/bookmarks/categories"),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].parent_id, null);
  assert.equal(body.data[0].display_name, "Docs");
});

test("bookmark and category writes still require login", async () => {
  const env = {
    ENVIRONMENT: "production",
    BOOKMARKS_DB: createDbMock(),
  };

  const bookmarkResponse = await bookmarkCreateHandler({
    request: new Request("https://example.com/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Example", url: "https://example.com" }),
    }),
    env,
  });
  const categoryResponse = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tools" }),
    }),
    env,
  });
  const importResponse = await bookmarkImportHandler({
    request: new Request("https://example.com/api/bookmarks/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookmarks: [{ title: "Example", url: "https://example.com" }],
      }),
    }),
    env,
  });
  const deleteResponse = await bookmarkDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/1", {
      method: "DELETE",
    }),
    params: { id: "1" },
    env,
  });
  const updateResponse = await bookmarkUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Example", url: "https://example.com" }),
    }),
    params: { id: "1" },
    env,
  });

  assert.equal(bookmarkResponse.status, 401);
  assert.equal(categoryResponse.status, 401);
  assert.equal(importResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
  assert.equal(updateResponse.status, 401);
});

test("bookmark creation rejects unsafe URL protocols and accepts valid URLs", async () => {
  let insertAttempted = false;
  let insertParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (
          sql.includes("FROM bookmarks b") &&
          sql.includes("WHERE b.id = ?")
        ) {
          return {
            id: Number(params[0]),
            title: insertParams[0],
            url: insertParams[1],
            description: insertParams[2],
            favicon_url: insertParams[4],
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO bookmarks")) {
          insertAttempted = true;
          insertParams = params;
          return { success: true, meta: { last_row_id: 33 } };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const blockedResponse = await bookmarkCreateHandler({
    request: new Request("https://example.com/api/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        title: "Unsafe",
        url: "javascript:alert(1)",
      }),
    }),
    env,
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(insertAttempted, false);

  const response = await bookmarkCreateHandler({
    request: new Request("https://example.com/api/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        title: " Example ",
        url: " https://example.com/docs ",
        description: " Docs ",
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.deepEqual(insertParams.slice(0, 3), [
    "Example",
    "https://example.com/docs",
    "Docs",
  ]);
});

test("bookmark update rejects unsafe URL protocols and accepts valid URLs", async () => {
  let updateAttempted = false;
  let updateParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT id FROM bookmarks WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        if (
          sql.includes("FROM bookmarks b") &&
          sql.includes("WHERE b.id = ?")
        ) {
          return {
            id: Number(params[0]),
            title: updateParams[0],
            url: updateParams[1],
            description: updateParams[2],
            favicon_url: updateParams[4],
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("UPDATE bookmarks")) {
          updateAttempted = true;
          updateParams = params;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const blockedResponse = await bookmarkUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/12", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        title: "Unsafe",
        url: "data:text/html,hello",
      }),
    }),
    params: { id: "12" },
    env,
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(updateAttempted, false);

  const response = await bookmarkUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/12", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        title: "Updated",
        url: "https://example.com/updated",
      }),
    }),
    params: { id: "12" },
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(updateParams[1], "https://example.com/updated");
});

test("authenticated admin can create categories through the shared envelope", async () => {
  let insertParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          return null;
        }
        if (
          sql.includes("FROM categories c") &&
          sql.includes("WHERE c.id = ?")
        ) {
          return {
            id: params[0],
            name: insertParams[0],
            color: insertParams[1],
            description: insertParams[2],
            bookmark_count: 0,
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO categories")) {
          insertParams = params;
          return { success: true, meta: { last_row_id: 12 } };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        name: "Research",
        color: "#10B981",
        description: "Reading queue",
      }),
    }),
    env,
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.message, "Category created");
  assert.equal(body.data.id, 12);
  assert.equal(body.data.name, "Research");
  assert.deepEqual(insertParams, ["Research", "#10B981", "Reading queue"]);
});

test("category creation rejects invalid colors and uses the default color", async () => {
  let insertAttempted = false;
  let insertParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          return null;
        }
        if (
          sql.includes("FROM categories c") &&
          sql.includes("WHERE c.id = ?")
        ) {
          return {
            id: Number(params[0]),
            name: insertParams[0],
            color: insertParams[1],
            description: insertParams[2],
            bookmark_count: 0,
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO categories")) {
          insertAttempted = true;
          insertParams = params;
          return { success: true, meta: { last_row_id: 44 } };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const blockedResponse = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        name: "Bad color",
        color: "not-a-color",
      }),
    }),
    env,
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(insertAttempted, false);

  const response = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        name: " Defaulted ",
        description: " Uses default color ",
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.deepEqual(insertParams, [
    "Defaulted",
    "#3B82F6",
    "Uses default color",
  ]);
});

test("category creation supports a second-level parent", async () => {
  let relationParams = null;
  let insertParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          return null;
        }
        if (
          sql.includes("FROM categories c") &&
          sql.includes("LEFT JOIN category_hierarchy h") &&
          !sql.includes("COUNT(b.id)")
        ) {
          return { id: Number(params[0]), parent_id: null };
        }
        if (sql.includes("FROM categories c") && sql.includes("COUNT(b.id)")) {
          return {
            id: Number(params[0]),
            name: insertParams[0],
            color: insertParams[1],
            description: insertParams[2],
            parent_id: 5,
            parent_name: "Frontend",
            display_name: `Frontend / ${insertParams[0]}`,
            bookmark_count: 0,
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO categories")) {
          insertParams = params;
          return { success: true, meta: { last_row_id: 45 } };
        }
        if (sql.includes("INSERT INTO category_hierarchy")) {
          relationParams = params;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        name: "React",
        color: "#3B82F6",
        parent_id: 5,
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(relationParams, [45, 5]);
  assert.equal(body.data.parent_id, 5);
  assert.equal(body.data.display_name, "Frontend / React");
});

test("top-level category creation works when category hierarchy is missing", async () => {
  let insertParams = null;
  let hierarchyWriteAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          return null;
        }
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("FROM categories c")) {
          return {
            id: Number(params[0]),
            name: insertParams[0],
            color: insertParams[1],
            description: insertParams[2],
            parent_id: null,
            display_name: insertParams[0],
            bookmark_count: 0,
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("category_hierarchy")) {
          hierarchyWriteAttempted = true;
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("INSERT INTO categories")) {
          insertParams = params;
          return { success: true, meta: { last_row_id: 46 } };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Legacy", color: "#3B82F6" }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.display_name, "Legacy");
  assert.equal(hierarchyWriteAttempted, false);
});

test("second-level category creation returns validation when hierarchy is missing", async () => {
  let insertAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        return null;
      },
      runResult({ sql }) {
        if (sql.includes("INSERT INTO categories")) {
          insertAttempted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryCreateHandler({
    request: new Request("https://example.com/api/bookmarks/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Child", parent_id: 5 }),
    }),
    env,
  });

  assert.equal(response.status, 400);
  assert.equal(insertAttempted, false);
});

test("bookmark visit tracking remains public and returns updated counters", async () => {
  let updateParams = null;
  const env = {
    ENVIRONMENT: "production",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM bookmarks")) {
          return {
            id: 7,
            title: "Example",
            url: "https://example.com",
            category_id: 2,
            visit_count: 3,
            last_visited: null,
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("UPDATE bookmarks")) {
          updateParams = params;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const response = await bookmarkVisitHandler({
    request: new Request("https://example.com/api/bookmarks/7/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: "2026-06-01T12:00:00.000Z",
        userAgent: "node-test",
        referrer: "https://example.com/",
      }),
    }),
    params: { id: "7" },
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(body.success, true);
  assert.equal(body.data.bookmarkId, "7");
  assert.equal(body.data.visitCount, 4);
  assert.equal(body.data.lastVisited, "2026-06-01T12:00:00.000Z");
  assert.deepEqual(updateParams, [4, "2026-06-01T12:00:00.000Z", "7"]);
});

test("bookmark delete removes an inaccessible link and records it", async () => {
  let deleted = false;
  let deletionRecordInserted = false;
  let deleteLookupSql = "";
  const bookmark = {
    id: 42,
    title: "Broken Link",
    url: "https://broken.example",
    description: "Broken test link",
    favicon_url: null,
    created_at: "2026-05-31T00:00:00.000Z",
    updated_at: "2026-05-31T00:00:00.000Z",
    category_name: "测试",
    keep_status: "normal",
  };
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM bookmarks b")) {
          deleteLookupSql = sql;
          return deleted ? null : bookmark;
        }
        if (sql.includes("FROM deleted_bookmarks")) {
          return null;
        }
        return null;
      },
      runResult({ sql }) {
        if (sql.includes("INSERT INTO deleted_bookmarks")) {
          deletionRecordInserted = true;
        }
        if (sql.includes("DELETE FROM bookmarks")) {
          deleted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await bookmarkDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/42", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        reason: "link_check_failed",
        checkStatus: "inaccessible",
        statusCode: 0,
        errorMessage: "Network Error",
      }),
    }),
    params: { id: "42" },
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(deletionRecordInserted, true);
  assert.equal(deleted, true);
  assert.equal(deleteLookupSql.includes("category_hierarchy"), false);
});

test("replace import requires explicit clear confirmation before deleting bookmarks", async () => {
  let deleteAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      runResult({ sql }) {
        if (sql.includes("DELETE FROM bookmarks")) {
          deleteAttempted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await bookmarkImportHandler({
    request: new Request("https://example.com/api/bookmarks/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        bookmarks: [
          {
            title: "Example",
            url: "https://example.com",
          },
        ],
        categories: [],
        clearExisting: true,
      }),
    }),
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(deleteAttempted, false);
});

test("authenticated admin can import bookmarks through the shared envelope", async () => {
  const insertedBookmarks = [];
  const insertedCategories = [];
  let userDataMarked = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT id FROM bookmarks WHERE url = ?")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          return null;
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO categories")) {
          insertedCategories.push(params);
          return { success: true, meta: { last_row_id: 21 } };
        }
        if (sql.includes("INSERT INTO bookmarks")) {
          insertedBookmarks.push(params);
          return { success: true, changes: 1 };
        }
        if (sql.includes("INSERT OR REPLACE INTO system_config")) {
          userDataMarked = true;
          return { success: true, changes: 1 };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await bookmarkImportHandler({
    request: new Request("https://example.com/api/bookmarks/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        bookmarks: [
          {
            title: "Example",
            url: "https://example.com/docs",
            description: "Docs",
            category_name: "Research",
          },
        ],
        categories: [{ name: "Research" }],
      }),
    }),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.imported, 1);
  assert.equal(body.data.skipped, 0);
  assert.equal(body.data.errors, 0);
  assert.equal(body.data.total, 1);
  assert.deepEqual(body.data.errorDetails, []);
  assert.equal(insertedCategories.length, 1);
  assert.equal(insertedBookmarks.length, 1);
  assert.equal(insertedBookmarks[0][0], "Example");
  assert.equal(insertedBookmarks[0][3], 21);
  assert.equal(userDataMarked, true);
});

test("clear all bookmarks archives records and requires confirmation", async () => {
  let deletionRecordInserted = false;
  let deleteAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM deleted_bookmarks")) {
          return null;
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks b")) {
          return {
            results: [
              {
                id: 1,
                title: "Example",
                url: "https://example.com",
                description: "",
                favicon_url: null,
                created_at: "2026-05-31T00:00:00.000Z",
                updated_at: "2026-05-31T00:00:00.000Z",
                category_name: "测试",
                keep_status: "normal",
              },
            ],
          };
        }
        return { results: [] };
      },
      runResult({ sql }) {
        if (sql.includes("INSERT INTO deleted_bookmarks")) {
          deletionRecordInserted = true;
        }
        if (sql.includes("DELETE FROM bookmarks")) {
          deleteAttempted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const blockedResponse = await bookmarkClearHandler({
    request: new Request("https://example.com/api/bookmarks/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ confirmation: "" }),
    }),
    env,
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(deleteAttempted, false);
  assert.equal(deletionRecordInserted, false);

  const response = await bookmarkClearHandler({
    request: new Request("https://example.com/api/bookmarks/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        confirmation: "CONFIRM_CLEAR_ALL_BOOKMARKS",
      }),
    }),
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.deleted, 1);
  assert.equal(deletionRecordInserted, true);
  assert.equal(deleteAttempted, true);
});

test("keep-status update requires login and returns the updated bookmark state", async () => {
  let updatedParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("SELECT id, title, keep_status FROM bookmarks")) {
          return {
            id: params[0],
            title: "Example",
            keep_status: updatedParams?.[0] || "normal",
          };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("UPDATE bookmarks SET keep_status")) {
          updatedParams = params;
          return { success: true, changes: 1 };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const blockedResponse = await keepStatusHandler({
    request: new Request("https://example.com/api/bookmarks/keep-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarkId: 1, keepStatus: "keep" }),
    }),
    env,
  });

  assert.equal(blockedResponse.status, 401);

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await keepStatusHandler({
    request: new Request("https://example.com/api/bookmarks/keep-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ bookmarkId: 1, keepStatus: "keep" }),
    }),
    env,
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.bookmarkId, 1);
  assert.equal(body.data.keepStatus, "keep");
  assert.deepEqual(updatedParams, ["keep", 1]);
});

test("category update rejects duplicate names and updates existing category", async () => {
  let updateAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        if (
          sql.includes("SELECT id FROM categories WHERE name = ? AND id != ?")
        ) {
          return params[0] === "Duplicate" ? { id: 9 } : null;
        }
        if (
          sql.includes("FROM categories c") &&
          sql.includes("LEFT JOIN category_hierarchy h") &&
          !sql.includes("COUNT(b.id)")
        ) {
          return {
            id: Number(params[0]),
            parent_id: Number(params[0]) === 4 ? 1 : null,
          };
        }
        if (sql.includes("FROM categories c")) {
          return {
            id: Number(params[0]),
            name: "Updated",
            color: "#111111",
            description: "New description",
            bookmark_count: 2,
          };
        }
        return null;
      },
      runResult({ sql }) {
        if (sql.includes("UPDATE categories")) {
          updateAttempted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const invalidColorResponse = await categoryUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Updated", color: "not-a-color" }),
    }),
    params: { id: "2" },
    env,
  });
  assert.equal(invalidColorResponse.status, 400);
  assert.equal(updateAttempted, false);

  const invalidParentResponse = await categoryUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Updated", parent_id: 4 }),
    }),
    params: { id: "2" },
    env,
  });
  assert.equal(invalidParentResponse.status, 400);
  assert.equal(updateAttempted, false);

  const duplicateResponse = await categoryUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Duplicate" }),
    }),
    params: { id: "2" },
    env,
  });
  assert.equal(duplicateResponse.status, 422);

  const response = await categoryUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        name: "Updated",
        color: "#111111",
        description: "New description",
      }),
    }),
    params: { id: "2" },
    env,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.name, "Updated");
});

test("top-level category update works when category hierarchy is missing", async () => {
  let updateAttempted = false;
  let hierarchyWriteAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        if (
          sql.includes("SELECT id FROM categories WHERE name = ? AND id != ?")
        ) {
          return null;
        }
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("FROM categories c")) {
          return {
            id: Number(params[0]),
            name: "Updated",
            color: "#111111",
            parent_id: null,
            display_name: "Updated",
            bookmark_count: 0,
          };
        }
        return null;
      },
      runResult({ sql }) {
        if (sql.includes("category_hierarchy")) {
          hierarchyWriteAttempted = true;
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("UPDATE categories")) {
          updateAttempted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Updated", color: "#111111" }),
    }),
    params: { id: "2" },
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.display_name, "Updated");
  assert.equal(updateAttempted, true);
  assert.equal(hierarchyWriteAttempted, true);
});

test("category update with parent returns validation when hierarchy is missing", async () => {
  let updateAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        if (
          sql.includes("SELECT id FROM categories WHERE name = ? AND id != ?")
        ) {
          return null;
        }
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        return null;
      },
      runResult({ sql }) {
        if (sql.includes("UPDATE categories")) {
          updateAttempted = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryUpdateHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Updated", parent_id: 5 }),
    }),
    params: { id: "2" },
    env,
  });

  assert.equal(response.status, 400);
  assert.equal(updateAttempted, false);
});

test("category delete migrates bookmarks before removing the category", async () => {
  let movedTo = undefined;
  let deletedCategory = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("FROM categories c")) {
          return { id: Number(params[0]), name: "Old", bookmark_count: 3 };
        }
        if (sql.includes("SELECT id FROM categories WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("UPDATE bookmarks SET category_id")) {
          movedTo = params[0];
          return { success: true, meta: { changes: 3 } };
        }
        if (sql.includes("DELETE FROM categories")) {
          deletedCategory = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ moveToCategoryId: 4 }),
    }),
    params: { id: "2" },
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(movedTo, 4);
  assert.equal(deletedCategory, true);
  assert.equal(body.data.movedCount, 3);
});

test("category delete works when category hierarchy is missing", async () => {
  let movedTo = undefined;
  let deletedCategory = false;
  let hierarchyDeleteAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("category_hierarchy")) {
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("FROM categories c")) {
          return { id: Number(params[0]), name: "Old", bookmark_count: 3 };
        }
        if (sql.includes("SELECT id FROM categories WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("category_hierarchy")) {
          hierarchyDeleteAttempted = true;
          throw new Error("no such table: category_hierarchy");
        }
        if (sql.includes("UPDATE bookmarks SET category_id")) {
          movedTo = params[0];
          return { success: true, meta: { changes: 3 } };
        }
        if (sql.includes("DELETE FROM categories")) {
          deletedCategory = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ moveToCategoryId: 4 }),
    }),
    params: { id: "2" },
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(movedTo, 4);
  assert.equal(deletedCategory, true);
  assert.equal(hierarchyDeleteAttempted, true);
  assert.equal(body.data.movedCount, 3);
});

test("category delete rejects invalid migration target values", async () => {
  let moved = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("FROM categories c")) {
          return { id: Number(params[0]), name: "Old", bookmark_count: 3 };
        }
        return null;
      },
      runResult({ sql }) {
        if (sql.includes("UPDATE bookmarks SET category_id")) {
          moved = true;
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await categoryDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/categories/2", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ moveToCategoryId: "abc" }),
    }),
    params: { id: "2" },
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(moved, false);
});

test("batch move updates selected bookmark category in one request", async () => {
  let updateParams = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE id = ?")) {
          return { id: Number(params[0]) };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("UPDATE bookmarks")) {
          updateParams = params;
          return { success: true, meta: { changes: 2 } };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await batchMoveHandler({
    request: new Request("https://example.com/api/bookmarks/batch-move", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ bookmarkIds: [1, 2, 2], categoryId: 5 }),
    }),
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(updateParams, [5, 1, 2]);
  assert.equal(body.data.movedCount, 2);
});

test("batch delete archives selected bookmarks before removing them", async () => {
  let deletionRecordCount = 0;
  let deleteParams = null;
  const bookmarks = [
    {
      id: 1,
      title: "Example",
      url: "https://example.com",
      description: "",
      favicon_url: null,
      created_at: "2026-05-31T00:00:00.000Z",
      updated_at: "2026-05-31T00:00:00.000Z",
      category_name: "测试",
      keep_status: "normal",
    },
    {
      id: 2,
      title: "Docs",
      url: "https://docs.example.com",
      description: "",
      favicon_url: null,
      created_at: "2026-05-31T00:00:00.000Z",
      updated_at: "2026-05-31T00:00:00.000Z",
      category_name: "资料",
      keep_status: "normal",
    },
  ];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("FROM deleted_bookmarks")) {
          return null;
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks b")) {
          return { results: bookmarks };
        }
        return { results: [] };
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO deleted_bookmarks")) {
          deletionRecordCount++;
        }
        if (sql.includes("DELETE FROM bookmarks")) {
          deleteParams = params;
          return { success: true, meta: { changes: 2 } };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await batchDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/batch-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ bookmarkIds: [1, 2, 2] }),
    }),
    env,
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(deletionRecordCount, 2);
  assert.deepEqual(deleteParams, [1, 2]);
  assert.equal(body.data.deletedCount, 2);
  assert.equal(body.data.archive.inserted, 2);
});

test("deleted bookmarks list supports reason, time range, and search filters", async () => {
  const captured = [];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        captured.push({ method: "first", sql, params });
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("COUNT(*) as total FROM deleted_bookmarks")) {
          return { total: 1 };
        }
        return null;
      },
      allResult({ sql, params }) {
        captured.push({ method: "all", sql, params });
        if (sql.includes("FROM deleted_bookmarks")) {
          return {
            results: [
              {
                id: 7,
                title: "Linux Do",
                url: "https://linux.do/",
                deleted_reason: "manual_delete",
                deleted_at: "2026-06-01 10:00:00",
              },
            ],
          };
        }
        return { results: [] };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await deletedListHandler({
    request: new Request(
      "https://example.com/api/bookmarks/deleted?filter=manual_delete&range=7d&search=linux&page=2&limit=10",
      {
        headers: {
          Authorization: `Bearer ${loginBody.token}`,
        },
      },
    ),
    env,
  });

  const body = await response.json();
  const listQuery = captured.find(
    (entry) =>
      entry.method === "all" && entry.sql.includes("FROM deleted_bookmarks"),
  );

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(listQuery.sql, /deleted_reason = \?/);
  assert.match(listQuery.sql, /deleted_at >= \?/);
  assert.match(listQuery.sql, /\(title LIKE \? OR url LIKE \?\)/);
  assert.equal(listQuery.params[0], "manual_delete");
  assert.match(listQuery.params[1], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(listQuery.params[2], "%linux%");
  assert.equal(listQuery.params[3], "%linux%");
  assert.equal(listQuery.params[4], 10);
  assert.equal(listQuery.params[5], 10);
});

test("deleted bookmark restore recreates the bookmark and removes the trash record", async () => {
  const capturedRuns = [];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("FROM deleted_bookmarks WHERE id = ?")) {
          assert.deepEqual(params, ["7"]);
          return {
            id: 7,
            title: "Linux Do",
            url: "https://linux.do/",
            description: "Community",
            category: "Community",
            favicon_url: "https://linux.do/favicon.ico",
            tags: "linux,forum",
            created_at: "2026-06-01 10:00:00",
            keep_status: "normal",
          };
        }
        if (sql.includes("SELECT id FROM bookmarks WHERE url = ?")) {
          assert.deepEqual(params, ["https://linux.do/"]);
          return null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          assert.deepEqual(params, ["Community"]);
          return { id: 5 };
        }
        return null;
      },
      runResult({ sql, params }) {
        capturedRuns.push({ sql, params });
        if (sql.includes("INSERT INTO bookmarks")) {
          return { success: true, meta: { last_row_id: 99 } };
        }
        if (sql.includes("DELETE FROM deleted_bookmarks")) {
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { last_row_id: 1 } };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await deletedRestoreHandler({
    request: new Request("https://example.com/api/bookmarks/deleted", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ deletedId: "7" }),
    }),
    env,
  });

  const body = await response.json();
  const restoreRun = capturedRuns.find((entry) =>
    entry.sql.includes("INSERT INTO bookmarks"),
  );
  const deleteRun = capturedRuns.find((entry) =>
    entry.sql.includes("DELETE FROM deleted_bookmarks"),
  );

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.bookmarkId, 99);
  assert.equal(restoreRun.params[0], "Linux Do");
  assert.equal(restoreRun.params[3], 5);
  assert.deepEqual(deleteRun.params, ["7"]);
});

test("deleted bookmark permanent delete requires admin and returns shared envelope", async () => {
  let deleted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("SELECT title FROM deleted_bookmarks WHERE id = ?")) {
          assert.deepEqual(params, ["7"]);
          return { title: "Linux Do" };
        }
        return null;
      },
      runResult({ sql, params }) {
        if (sql.includes("DELETE FROM deleted_bookmarks WHERE id = ?")) {
          assert.deepEqual(params, ["7"]);
          deleted = true;
        }
        return { success: true, meta: { changes: 1 } };
      },
    }),
  };

  const rejected = await deletedPermanentDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/deleted?id=7", {
      method: "DELETE",
    }),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await deletedPermanentDeleteHandler({
    request: new Request("https://example.com/api/bookmarks/deleted?id=7", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.deletedId, "7");
  assert.equal(deleted, true);
});

test("known protected sites are treated as reachable during link checks", () => {
  assert.equal(isKnownProtectedSite("https://linux.do/"), true);
  assert.equal(isKnownProtectedSite("https://www.linux.do/t/topic"), true);
  assert.equal(isKnownProtectedSite("https://broken.example/"), false);

  const result = getKnownProtectedSiteResult("https://linux.do/");
  assert.equal(result.accessible, true);
  assert.equal(result.deleteCandidate, false);
  assert.equal(result.status, 200);
  assert.equal(result.method, "PROTECTED_SITE");
});

test("link checker only marks hard failures as delete candidates", () => {
  const notFound = classifyHttpResponse(new Response("", { status: 404 }));
  assert.equal(notFound.accessible, false);
  assert.equal(notFound.deleteCandidate, true);
  assert.equal(notFound.reviewRequired, false);

  const forbidden = classifyHttpResponse(new Response("", { status: 403 }));
  assert.equal(forbidden.accessible, false);
  assert.equal(forbidden.deleteCandidate, false);
  assert.equal(forbidden.reviewRequired, true);

  const timeout = classifyNetworkError("GET request timeout");
  assert.equal(timeout.accessible, false);
  assert.equal(timeout.deleteCandidate, false);
  assert.equal(timeout.reviewRequired, true);
});

test("stream link checker list requires admin and returns bookmark candidates", async () => {
  const captured = [];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return null;
      },
      allResult({ sql, params }) {
        captured.push({ sql, params });
        if (sql.includes("FROM bookmarks b")) {
          return {
            results: [
              {
                id: 7,
                title: "Linux Do",
                url: "https://linux.do/",
                category_name: "Community",
                category_color: "#10b981",
                keep_status: "normal",
                created_at: "2026-06-01 10:00:00",
              },
            ],
          };
        }
        return { results: [] };
      },
    }),
  };

  const rejected = await checkLinksStreamGetHandler({
    request: new Request("https://example.com/api/system/check-links-stream"),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await checkLinksStreamGetHandler({
    request: new Request("https://example.com/api/system/check-links-stream", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 7);
  assert.equal(body.data[0].category, "Community");
  assert.equal(body.data[0].status, "pending");
  assert.equal(captured[0].params.length, 0);
});

test("stream link checker keeps protected sites out of delete candidates", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return null;
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const rejected = await checkLinksStreamPostHandler({
    request: new Request("https://example.com/api/system/check-links-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ bookmarkId: 7 }),
    }),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 400);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const response = await checkLinksStreamPostHandler({
    request: new Request("https://example.com/api/system/check-links-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        bookmarkId: 7,
        url: "https://linux.do/",
        autoDelete: true,
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.bookmarkId, 7);
  assert.equal(body.data.accessible, true);
  assert.equal(body.data.deleteCandidate, false);
  assert.equal(body.data.reviewRequired, false);
  assert.equal(body.data.deleted, false);
  assert.equal(body.data.method, "PROTECTED_SITE");
});

test("link checker history requires admin and returns the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("WHERE config_key LIKE 'link_check_%'")) {
          return {
            results: [
              {
                config_key: "link_check_1",
                config_value: JSON.stringify({
                  checkedAt: "2026-06-01T10:00:00.000Z",
                  total: 1,
                  accessible: 1,
                  inaccessible: 0,
                }),
                created_at: "2026-06-01 10:00:00",
              },
            ],
          };
        }
        return { results: [] };
      },
    }),
  };

  const rejected = await checkLinksGetHandler({
    request: new Request("https://example.com/api/system/check-links"),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await checkLinksGetHandler({
    request: new Request("https://example.com/api/system/check-links", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, "link_check_1");
  assert.equal(body.data[0].total, 1);
});

test("batch link checker keeps protected sites out of auto-delete candidates", async () => {
  let deleteAttempted = false;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks")) {
          return {
            results: [
              {
                id: 7,
                title: "Linux Do",
                url: "https://linux.do/",
                category_id: 3,
                created_at: "2026-06-01 10:00:00",
              },
            ],
          };
        }
        return { results: [] };
      },
      runResult({ sql }) {
        if (sql.includes("DELETE FROM bookmarks")) {
          deleteAttempted = true;
        }
        return { success: true, meta: { changes: 1 } };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await checkLinksPostHandler({
    request: new Request("https://example.com/api/system/check-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ autoDelete: true, batchSize: 1 }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.total, 1);
  assert.equal(body.data.checked, 1);
  assert.equal(body.data.accessible, 1);
  assert.equal(body.data.inaccessible, 0);
  assert.equal(body.data.deleted, 0);
  assert.deepEqual(body.data.inaccessibleBookmarks, []);
  assert.equal(deleteAttempted, false);
});

test("weekly check notifications require admin and return the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("weekly_notification_%")) {
          return {
            results: [
              {
                config_key: "weekly_check_1",
                config_value: JSON.stringify({
                  type: "weekly_auto_check",
                  checkedAt: "2026-06-01T10:00:00.000Z",
                  total: 1,
                  accessible: 1,
                  inaccessible: 0,
                }),
                created_at: "2026-06-01 10:00:00",
              },
            ],
          };
        }
        return { results: [] };
      },
    }),
  };

  const rejected = await weeklyCheckGetHandler({
    request: new Request("https://example.com/api/cron/weekly-check"),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await weeklyCheckGetHandler({
    request: new Request("https://example.com/api/cron/weekly-check", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, "weekly_check_1");
  assert.equal(body.data[0].type, "weekly_auto_check");
});

test("weekly check uses cron secret and treats protected sites as reachable", async () => {
  const insertedRecords = [];
  const env = {
    CRON_SECRET: "cron-secret-123",
    BOOKMARKS_DB: createDbMock({
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks")) {
          return {
            results: [
              {
                id: 7,
                title: "Linux Do",
                url: "https://linux.do/",
                category_id: 3,
                created_at: "2026-06-01 10:00:00",
              },
            ],
          };
        }
        return { results: [] };
      },
      runResult({ sql, params }) {
        if (sql.includes("INSERT INTO system_config")) {
          insertedRecords.push(params);
        }
        return { success: true, meta: { changes: 1 } };
      },
    }),
  };

  const rejected = await weeklyCheckPostHandler({
    request: new Request("https://example.com/api/cron/weekly-check", {
      method: "POST",
    }),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const response = await weeklyCheckPostHandler({
    request: new Request("https://example.com/api/cron/weekly-check", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret-123" },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.total, 1);
  assert.equal(body.data.checked, 1);
  assert.equal(body.data.accessible, 1);
  assert.equal(body.data.inaccessible, 0);
  assert.deepEqual(body.data.inaccessibleBookmarks, []);
  assert.equal(insertedRecords.length, 1);
  assert.match(insertedRecords[0][0], /^weekly_check_/);
});

test("health reports connected database state when D1 is available", async () => {
  const response = await healthHandler({
    env: {
      ENVIRONMENT: "test",
      BOOKMARKS_DB: createDbMock({
        firstResult({ sql, params }) {
          if (sql.includes("SELECT 1")) {
            return { test: 1 };
          }
          if (sql.includes("sqlite_master")) {
            return { name: params[0] };
          }
          return null;
        },
      }),
    },
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.status, "healthy");
  assert.equal(body.database.status, "connected");
  assert.equal(body.environment, "test");
});

test("health reports missing core database tables", async () => {
  const response = await healthHandler({
    env: {
      ENVIRONMENT: "test",
      BOOKMARKS_DB: createDbMock({
        firstResult({ sql }) {
          if (sql.includes("SELECT 1")) {
            return { test: 1 };
          }
          return null;
        },
      }),
    },
  });

  assert.equal(response.status, 503);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.status, "warning");
  assert.equal(body.database.status, "error");
  assert.match(body.database.error, /Missing core tables/);
});

test("health degrades to warning when database probe fails", async () => {
  const response = await healthHandler({
    env: {
      ENVIRONMENT: "test",
      BOOKMARKS_DB: createDbMock({ firstError: new Error("db down") }),
    },
  });

  assert.equal(response.status, 503);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.status, "warning");
  assert.equal(body.database.status, "error");
  assert.equal(body.database.error, "db down");
});

test("health reports a missing database binding clearly", async () => {
  const response = await healthHandler({
    env: {
      ENVIRONMENT: "test",
    },
  });

  assert.equal(response.status, 503);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.status, "warning");
  assert.equal(body.database.status, "missing");
  assert.equal(body.database.error, "BOOKMARKS_DB binding is missing.");
});

test("backup data status requires admin and returns the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("sqlite_master")) {
          return { name: params[0] };
        }
        if (sql.includes("COUNT(*) as count")) {
          return { count: params?.[0] || 2 };
        }
        return null;
      },
    }),
  };

  const rejected = await backupDataGetHandler({
    request: new Request("https://example.com/api/system/backup-data"),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await backupDataGetHandler({
    request: new Request("https://example.com/api/system/backup-data", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Database status check completed.");
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.canBackup, true);
  assert.equal(body.data.tables.bookmarks, 2);
});

test("backup data export returns backup payload and download headers", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        if (sql.includes("sqlite_master")) {
          return { name: params[0] };
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("PRAGMA table_info")) {
          return { results: [{ name: "id", type: "INTEGER" }] };
        }
        if (sql.includes("SELECT * FROM bookmarks")) {
          return {
            results: [{ id: 1, title: "Example", url: "https://example.com" }],
          };
        }
        return { results: [] };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await backupDataPostHandler({
    request: new Request("https://example.com/api/system/backup-data", {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("Content-Disposition"),
    /^attachment; filename="bookmark-backup-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  assert.equal(body.success, true);
  assert.equal(body.message, "Database backup completed.");
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.backupData.version, "1.0");
  assert.equal(body.data.backupData.tables.bookmarks.count, 1);
  assert.equal(body.data.totalRecords, 1);
  assert.equal(
    body.data.tables.some((table) => table.name === "bookmarks"),
    true,
  );
});

test("complete backup export requires admin and preserves the download payload", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return null;
      },
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks b")) {
          return {
            results: [
              {
                id: 1,
                title: "Example",
                url: "https://example.com",
                category_id: 2,
                favicon_url: "https://example.com/favicon.ico",
                visit_count: 4,
                category_name: "Docs",
                category_color: "#2563eb",
              },
            ],
          };
        }
        if (sql.includes("FROM categories")) {
          return {
            results: [
              {
                id: 2,
                name: "Docs",
                color: "#2563eb",
                bookmark_count: 1,
              },
            ],
          };
        }
        if (sql.includes("FROM system_config")) {
          return {
            results: [{ config_key: "site_title", config_value: "Bookmarks" }],
          };
        }
        return { results: [] };
      },
    }),
  };

  const rejected = await backupExportGetHandler({
    request: new Request("https://example.com/api/system/backup?format=json"),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await backupExportGetHandler({
    request: new Request("https://example.com/api/system/backup?format=json", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /application\/json/);
  assert.match(
    response.headers.get("Content-Disposition"),
    /^attachment; filename="bookmarks-backup-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  assert.equal(body.success, undefined);
  assert.equal(body.metadata.totalBookmarks, 1);
  assert.equal(body.metadata.systemConfig.site_title, "Bookmarks");
  assert.equal(body.bookmarks[0].title, "Example");
  assert.equal(body.statistics.totalVisits, 4);
});

test("automatic backup endpoints require admin and use the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return null;
        }
        return {
          total_bookmarks: 3,
          total_categories: 2,
          total_configs: 1,
        };
      },
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks")) {
          return {
            results: [{ id: 1, title: "Example", url: "https://example.com" }],
          };
        }
        if (sql.includes("FROM categories")) {
          return { results: [{ id: 2, name: "Docs", color: "#2563eb" }] };
        }
        return { results: [] };
      },
    }),
    BACKUP_BUCKET: {
      async delete() {
        return undefined;
      },
    },
  };

  const rejectedHandlers = [
    backupAutoGetHandler({
      request: new Request("https://example.com/api/system/backup-auto"),
      env,
    }),
    backupAutoPostHandler({
      request: new Request("https://example.com/api/system/backup-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadToR2: false }),
      }),
      env,
    }),
    backupAutoPutHandler({
      request: new Request("https://example.com/api/system/backup-auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "upload", backupData: {} }),
      }),
      env,
    }),
    backupAutoDeleteHandler({
      request: new Request("https://example.com/api/system/backup-auto", {
        method: "DELETE",
      }),
      env,
    }),
  ];

  for (const rejected of await Promise.all(rejectedHandlers)) {
    assert.equal(rejected.status, 401);
    const body = await rejected.json();
    assert.equal(body.success, false);
    assert.equal(typeof body.timestamp, "string");
  }

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginBody.token}`,
  };

  const statusResponse = await backupAutoGetHandler({
    request: new Request(
      "https://example.com/api/system/backup-auto?action=status",
      { headers },
    ),
    env,
  });
  const statusBody = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(statusBody.success, true);
  assert.equal(typeof statusBody.timestamp, "string");
  assert.equal(statusBody.data.r2Configured, true);
  assert.equal(statusBody.data.databaseStats.total_bookmarks, 3);

  const backupResponse = await backupAutoPostHandler({
    request: new Request("https://example.com/api/system/backup-auto", {
      method: "POST",
      headers,
      body: JSON.stringify({ uploadToR2: false }),
    }),
    env,
  });
  const backupBody = await backupResponse.json();
  assert.equal(backupResponse.status, 200);
  assert.match(
    backupResponse.headers.get("Content-Disposition"),
    /^attachment; filename="bookmark-backup-full-\d{4}-\d{2}-\d{2}_/,
  );
  assert.equal(backupBody.success, true);
  assert.equal(backupBody.message, "Backup created successfully.");
  assert.equal(backupBody.data.backup.type, "full_backup");
  assert.equal(backupBody.data.r2, false);
  assert.equal(backupBody.data.backupData.data.bookmarks.length, 1);
});

test("analytics summary remains public for the homepage", async () => {
  const response = await analyticsGetHandler({
    request: new Request("https://example.com/api/analytics?type=summary"),
    env: {},
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(typeof body.data.generatedAt, "string");
  assert.equal(typeof body.data.summary.totalBookmarks, "number");
  assert.equal(Array.isArray(body.data.popularBookmarks), true);
});

test("analytics recording is public but admin actions require login", async () => {
  const visitResponse = await analyticsPostHandler({
    request: new Request("https://example.com/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "visit",
        bookmarkId: 88,
        bookmarkData: {
          title: "Example",
          url: "https://example.com",
          category: "Docs",
        },
      }),
    }),
    env: {},
  });

  assert.equal(visitResponse.status, 200);
  const visitBody = await visitResponse.json();
  assert.equal(visitBody.success, true);
  assert.equal(visitBody.data.bookmarkId, 88);

  const blocked = await analyticsPutHandler({
    request: new Request("https://example.com/api/analytics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    }),
    env: {},
  });

  assert.equal(blocked.status, 401);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.success, false);
  assert.equal(typeof blockedBody.timestamp, "string");
});

test("performance report endpoint requires admin and uses the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };

  const rejected = await performanceGetHandler({
    request: new Request("https://example.com/api/system/performance"),
    env,
  });

  assert.equal(rejected.status, 401);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await performanceGetHandler({
    request: new Request(
      "https://example.com/api/system/performance?type=detailed",
      {
        headers: { Authorization: `Bearer ${loginBody.token}` },
      },
    ),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(typeof body.data.generatedAt, "string");
  assert.equal(typeof body.data.report.summary.totalEndpoints, "number");
});

test("performance manual record validates required fields with the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const rejected = await performancePutHandler({
    request: new Request("https://example.com/api/system/performance", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ endpoint: "/api/bookmarks" }),
    }),
    env,
  });

  assert.equal(rejected.status, 400);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.success, false);
  assert.match(rejectedBody.error, /endpoint, startTime, endTime, status/);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const response = await performancePutHandler({
    request: new Request("https://example.com/api/system/performance", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({
        endpoint: "/api/bookmarks",
        startTime: 100,
        endTime: 160,
        status: 200,
      }),
    }),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.message, "性能数据记录成功");
  assert.equal(body.data.metric.endpoint, "/api/bookmarks");
});

test("database optimization status requires admin and uses the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult: ({ sql }) => {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        return {
          total_bookmarks: 1201,
          total_categories: 8,
          total_configs: 3,
        };
      },
      allResult: {
        results: [
          {
            name: "idx_bookmarks_category",
            sql: "CREATE INDEX idx_bookmarks_category ON bookmarks(category_id)",
          },
        ],
      },
    }),
  };

  const rejected = await optimizeDatabaseGetHandler({
    request: new Request("https://example.com/api/system/optimize-database"),
    env,
  });

  assert.equal(rejected.status, 401);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await optimizeDatabaseGetHandler({
    request: new Request("https://example.com/api/system/optimize-database", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.database_stats.total_bookmarks, 1201);
  assert.equal(body.data.indexes.length, 1);
  assert.equal(body.data.recommendations.needs_optimization, true);
});

test("database optimization runs indexes and vacuum through the shared envelope", async () => {
  const executed = [];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult: ({ sql }) => {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        return null;
      },
      execResult: ({ sql }) => {
        executed.push(sql);
        return { success: true };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await optimizeDatabasePostHandler({
    request: new Request("https://example.com/api/system/optimize-database", {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.message, "Database optimization completed");
  assert.equal(body.data.optimizations.length, 6);
  assert.equal(body.data.optimizations.at(-1).index, "vacuum");
  assert.equal(executed.includes("VACUUM"), true);
});

test("system migrations require admin and use the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };

  const rejected = await migrateKeepStatusHandler({
    request: new Request("https://example.com/api/system/migrate", {
      method: "POST",
    }),
    env,
  });

  assert.equal(rejected.status, 401);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");

  const deletedRejected = await migrateDeletedBookmarksHandler({
    request: new Request(
      "https://example.com/api/system/migrate-deleted-bookmarks",
      { method: "POST" },
    ),
    env,
  });

  assert.equal(deletedRejected.status, 401);
  const deletedRejectedBody = await deletedRejected.json();
  assert.equal(deletedRejectedBody.success, false);
  assert.equal(typeof deletedRejectedBody.timestamp, "string");
});

test("keep-status migration reports existing column through the shared envelope", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult: ({ sql }) => {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        if (sql.includes("SELECT keep_status FROM bookmarks")) {
          return { keep_status: "normal" };
        }
        return null;
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await migrateKeepStatusHandler({
    request: new Request("https://example.com/api/system/migrate", {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.migrated, false);
  assert.equal(body.data.reason, "already_exists");
});

test("deleted bookmarks migration creates table and indexes", async () => {
  const executed = [];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult: ({ sql }) => {
        if (sql.includes("system_config WHERE config_key")) {
          return null;
        }
        return null;
      },
      execResult: ({ sql }) => {
        executed.push(sql);
        return { success: true };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await migrateDeletedBookmarksHandler({
    request: new Request(
      "https://example.com/api/system/migrate-deleted-bookmarks",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${loginBody.token}` },
      },
    ),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.migrated, true);
  assert.equal(body.data.table, "deleted_bookmarks");
  assert.equal(body.data.statements, 4);
  assert.equal(executed.length, 4);
  assert.equal(executed[0].includes("CREATE TABLE IF NOT EXISTS"), true);
});

test("JWT secret falls back to a cached in-memory value when D1 is unavailable", async () => {
  const env = {
    BOOKMARKS_DB: createDbMock({
      firstError: new Error("db down"),
      runError: new Error("db down"),
    }),
  };

  const firstSecret = await JWTKeyManager.getJWTSecret(env);
  const secondSecret = await JWTKeyManager.getJWTSecret(env);

  assert.equal(typeof firstSecret, "string");
  assert.equal(firstSecret, secondSecret);
  assert.equal(firstSecret.length > 20, true);
});

test("token management requires an administrator session by default", async () => {
  const listResponse = await tokenListHandler({
    request: new Request("https://example.com/api/auth/token"),
    env: {
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(listResponse.status, 401);
  const listBody = await listResponse.json();
  assert.equal(listBody.success, false);
  assert.equal(typeof listBody.error, "string");
  assert.equal(typeof listBody.timestamp, "string");

  const createResponse = await tokenCreateHandler({
    request: new Request("https://example.com/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Chrome Sync" }),
    }),
    env: {
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(createResponse.status, 401);
  const createBody = await createResponse.json();
  assert.equal(createBody.success, false);
  assert.equal(typeof createBody.error, "string");
  assert.equal(typeof createBody.timestamp, "string");
});

test("token management can be explicitly disabled", async () => {
  const response = await tokenListHandler({
    request: new Request("https://example.com/api/auth/token"),
    env: {
      PUBLIC_API_TOKEN_MANAGEMENT: "disabled",
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.match(body.error, /disabled/i);
  assert.equal(typeof body.timestamp, "string");
});

test("authenticated admin can create a sync API token by default", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock(),
  };
  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await tokenCreateHandler({
    request: new Request("https://example.com/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Chrome Sync", expiresIn: 365 }),
    }),
    env,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.data.token, "string");
  assert.equal(body.data.name, "Chrome Sync");
  assert.match(body.data.id, /^api_token_/);
  assert.equal(body.message, "API token created successfully.");
  assert.equal(typeof body.timestamp, "string");
});

test("deleted API token metadata revokes newly generated tokens", async () => {
  let activeTokenId = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return params[0] === activeTokenId
            ? { config_key: activeTokenId }
            : null;
        }
        return null;
      },
      runResult({ params }) {
        if (String(params[0] || "").startsWith("api_token_")) {
          activeTokenId = params[0];
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();

  const response = await tokenCreateHandler({
    request: new Request("https://example.com/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Chrome Sync", expiresIn: 365 }),
    }),
    env,
  });
  const body = await response.json();

  const validCheck = await verifyApiToken(body.data.token, env);
  assert.equal(validCheck.valid, true);

  activeTokenId = null;
  const revokedCheck = await verifyApiToken(body.data.token, env);
  assert.equal(revokedCheck.valid, false);
  assert.match(revokedCheck.error, /revoked/i);
});

test("sync list endpoint accepts API tokens and returns JSON bookmarks", async () => {
  let activeTokenId = null;
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return params[0] === activeTokenId
            ? { config_key: activeTokenId }
            : null;
        }
        return null;
      },
      runResult({ params }) {
        if (String(params[0] || "").startsWith("api_token_")) {
          activeTokenId = params[0];
        }
        return { success: true, changes: 1 };
      },
      allResult({ sql }) {
        if (sql.includes("FROM bookmarks b")) {
          return {
            results: [
              {
                id: 1,
                title: "Example",
                url: "https://example.com",
                category_name: "测试",
              },
            ],
          };
        }
        return { results: [] };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();
  const createResponse = await tokenCreateHandler({
    request: new Request("https://example.com/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Chrome Sync" }),
    }),
    env,
  });
  const createBody = await createResponse.json();

  const rejected = await syncListHandler({
    request: new Request("https://example.com/api/bookmarks/sync"),
    env,
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 401);
  assert.equal(rejectedBody.success, false);
  assert.equal(typeof rejectedBody.timestamp, "string");
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), "*");

  const response = await syncListHandler({
    request: new Request(
      "https://example.com/api/bookmarks/sync?page=1&limit=100",
      {
        headers: {
          "X-API-Token": createBody.data.token,
        },
      },
    ),
    env,
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /application\/json/);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(
    response.headers.get("Access-Control-Allow-Headers"),
    "Content-Type, X-API-Token",
  );
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.bookmarks.length, 1);
});

test("sync import keeps extension CORS and Chinese default category behavior", async () => {
  let activeTokenId = null;
  const createdCategories = [];
  const insertedBookmarks = [];
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "test-secret-with-safe-length-1234567890",
    BOOKMARKS_DB: createDbMock({
      firstResult({ sql, params }) {
        if (sql.includes("FROM system_config WHERE config_key = ?")) {
          return params[0] === activeTokenId
            ? { config_key: activeTokenId }
            : null;
        }
        if (sql.includes("SELECT id FROM categories WHERE name = ?")) {
          return null;
        }
        if (sql.includes("SELECT id FROM bookmarks WHERE url = ?")) {
          return null;
        }
        return null;
      },
      runResult({ sql, params }) {
        if (String(params[0] || "").startsWith("api_token_")) {
          activeTokenId = params[0];
          return { success: true, changes: 1 };
        }
        if (sql.includes("INSERT INTO categories")) {
          createdCategories.push(params);
          return {
            success: true,
            meta: { last_row_id: createdCategories.length },
          };
        }
        if (sql.includes("INSERT INTO bookmarks")) {
          insertedBookmarks.push(params);
          return {
            success: true,
            meta: { last_row_id: insertedBookmarks.length },
          };
        }
        return { success: true, changes: 1 };
      },
    }),
  };

  const loginResponse = await loginHandler({
    request: new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env,
  });
  const loginBody = await loginResponse.json();
  const createResponse = await tokenCreateHandler({
    request: new Request("https://example.com/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Chrome Sync" }),
    }),
    env,
  });
  const createBody = await createResponse.json();

  const response = await syncPostHandler({
    request: new Request("https://example.com/api/bookmarks/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": createBody.data.token,
      },
      body: JSON.stringify({
        bookmarks: [
          {
            title: "Example",
            url: "https://example.com",
            category: "书签栏",
          },
        ],
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.successCount, 1);
  assert.equal(createdCategories[0][0], "Chrome同步");
  assert.equal(createdCategories[0][2], "Chrome浏览器同步的书签");
  assert.equal(insertedBookmarks[0][3], 1);
});

test("token verification uses generated jwt secret instead of a fixed fallback", async () => {
  const env = {
    ADMIN_PASSWORD: "StrongPass123",
    BOOKMARKS_DB: createDbMock({
      firstError: new Error("db down"),
      runError: new Error("db down"),
    }),
  };
  const loginResponse = await loginHandler({
    request: new Request("http://127.0.0.1:8788/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "StrongPass123" }),
    }),
    env: {
      ...env,
      PUBLIC_API_TOKEN_MANAGEMENT: "enabled",
      ENVIRONMENT: "development",
    },
  });
  const loginBody = await loginResponse.json();

  const createResponse = await tokenCreateHandler({
    request: new Request("http://127.0.0.1:8788/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ name: "Local Sync" }),
    }),
    env: {
      ...env,
      PUBLIC_API_TOKEN_MANAGEMENT: "enabled",
      ENVIRONMENT: "development",
    },
  });

  assert.equal(createResponse.status, 200);
  const createBody = await createResponse.json();
  assert.equal(createBody.success, true);

  const validCheck = await verifyApiToken(createBody.data.token, env);
  assert.equal(validCheck.valid, true);

  const forgedCheck = await verifyApiToken(createBody.data.token, {
    JWT_SECRET: "different-secret-value-12345678901234567890",
    BOOKMARKS_DB: createDbMock(),
  });
  assert.equal(forgedCheck.valid, false);
});
