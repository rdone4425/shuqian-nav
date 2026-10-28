import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let DatabaseSync = null;

try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = null;
}

const skip = DatabaseSync
  ? false
  : "node:sqlite is unavailable on this Node version";

// Pre-0001 shape of the two tables that migration 0001 upgrades.
const LEGACY_SCHEMA = `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category_id INTEGER,
  favicon_url TEXT,
  keep_status TEXT DEFAULT 'normal',
  visit_count INTEGER DEFAULT 0,
  last_visited DATETIME,
  popularity_score REAL DEFAULT 0,
  tags TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

INSERT INTO categories (name, color) VALUES ('工具', '#10B981');
INSERT INTO bookmarks (title, url, category_id, visit_count, is_favorite)
VALUES ('Legacy site', 'https://example.com', 1, 7, 1);
`;

test(
  "0001_nav upgrades a legacy database and is idempotent",
  { skip },
  async () => {
    const db = new DatabaseSync(":memory:");

    try {
      db.exec(LEGACY_SCHEMA);
      // This is the step CI runs before migrations: it must not touch the
      // new columns, otherwise the deploy fails on an existing database.
      db.exec(
        readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"),
      );

      const ctx = {
        query(sql) {
          return db.prepare(sql).all();
        },
        exec(sql) {
          db.exec(sql);
        },
        columnExists(table, column) {
          return db
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .some((row) => row.name === column);
        },
        tableExists(table) {
          return Boolean(
            db
              .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
              )
              .get(table),
          );
        },
      };

      const { up } = await import("../db/migrations/0001_nav.mjs");
      await up(ctx);
      // The runner records the version, but `up` itself must also be safe to
      // call twice (e.g. a retried deploy).
      await up(ctx);

      const bookmarkColumns = db
        .prepare("PRAGMA table_info(bookmarks)")
        .all()
        .map((row) => row.name);
      const categoryColumns = db
        .prepare("PRAGMA table_info(categories)")
        .all()
        .map((row) => row.name);

      for (const column of [
        "sort_order",
        "is_pinned",
        "is_featured",
        "is_visible",
        "click_count",
        "last_click_at",
        "source",
      ]) {
        assert.ok(bookmarkColumns.includes(column), `bookmarks.${column}`);
      }

      for (const column of ["slug", "sort_order", "is_visible"]) {
        assert.ok(categoryColumns.includes(column), `categories.${column}`);
      }

      const categories = db
        .prepare("SELECT id, slug FROM categories ORDER BY id")
        .all();
      assert.ok(categories.length >= 1);
      assert.ok(
        categories.every((row) => /^c-\d+$/.test(row.slug)),
        "every category gets a c-<id> slug",
      );

      const legacy = db
        .prepare(
          "SELECT sort_order, click_count, is_visible, is_pinned, is_featured FROM bookmarks WHERE title = 'Legacy site'",
        )
        .get();
      assert.equal(legacy.sort_order, 1);
      assert.equal(legacy.click_count, 7);
      assert.equal(legacy.is_visible, 1);
      assert.equal(legacy.is_pinned, 0);
      assert.equal(legacy.is_featured, 1);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all()
        .map((row) => row.name);
      assert.ok(indexes.includes("idx_bookmarks_nav_order"));
      assert.ok(indexes.includes("idx_categories_nav_order"));
      assert.ok(indexes.includes("idx_categories_slug"));
      assert.ok(indexes.includes("idx_nav_clicks_bookmark"));

      const navClicks = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'nav_clicks'",
        )
        .get();
      assert.ok(navClicks, "nav_clicks table exists");
    } finally {
      db.close();
    }
  },
);
