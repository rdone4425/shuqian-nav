import test from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as loginHandler } from "../pages/functions/api/auth/login.js";
import { onRequestGet as healthHandler } from "../pages/functions/api/health.js";

function createDbMock({ firstResult, firstError, runResult } = {}) {
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
        if (typeof runResult === "function") {
          return runResult({ sql, params });
        }
        return runResult ?? { success: true, changes: 1 };
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

test("login returns a JWT when ADMIN_PASSWORD is configured", async () => {
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
  assert.equal(body.passwordSource, "environment");
  assert.equal(body.canChangePassword, false);
});

test("login falls back to the seeded default password from D1", async () => {
  const request = new Request("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin123" }),
  });

  const response = await loginHandler({
    request,
    env: {
      JWT_SECRET: "test-secret-with-safe-length-1234567890",
      BOOKMARKS_DB: createDbMock({
        firstResult: ({ params }) =>
          params[0] === "admin_password" ? { config_value: "admin123" } : null,
      }),
    },
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.isDefaultPassword, true);
  assert.equal(body.passwordSource, "database");
  assert.equal(body.canChangePassword, true);
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
