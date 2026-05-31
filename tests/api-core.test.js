import test from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as loginHandler } from "../pages/functions/api/auth/login.js";
import { onRequestPost as changePasswordHandler } from "../pages/functions/api/auth/change-password.js";
import { onRequestGet as healthHandler } from "../pages/functions/api/health.js";
import {
  verifyToken as verifyPublicToken,
  authenticateRequest,
} from "../pages/functions/api/auth/verify.js";
import {
  onRequestGet as tokenListHandler,
  onRequestPost as tokenCreateHandler,
  verifyApiToken,
} from "../pages/functions/api/auth/token.js";
import { onRequestDelete as bookmarkDeleteHandler } from "../pages/functions/api/bookmarks/[id].js";
import { JWTKeyManager } from "../pages/functions/utils/jwt-manager.js";

function createDbMock({ firstResult, firstError, runResult, runError } = {}) {
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
        return { results: [] };
      },
    };
  }

  return {
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
  assert.equal(body.user.role, "admin");
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

test("bookmark delete removes an inaccessible link and records it", async () => {
  let deleted = false;
  let deletionRecordInserted = false;
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
});

test("health reports connected database state when D1 is available", async () => {
  const response = await healthHandler({
    env: {
      ENVIRONMENT: "test",
      BOOKMARKS_DB: createDbMock({ firstResult: { test: 1 } }),
    },
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.status, "healthy");
  assert.equal(body.database.status, "connected");
  assert.equal(body.environment, "test");
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

test("token management stays disabled by default in public mode", async () => {
  const listResponse = await tokenListHandler({
    request: new Request("https://example.com/api/auth/token"),
    env: {
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock(),
    },
  });

  assert.equal(listResponse.status, 403);
  const listBody = await listResponse.json();
  assert.equal(listBody.success, false);
  assert.match(listBody.error, /disabled in public mode/i);

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

  assert.equal(createResponse.status, 403);
  const createBody = await createResponse.json();
  assert.equal(createBody.success, false);
  assert.match(createBody.error, /disabled in public mode/i);
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
