/**
 * 0001_nav: turn the bookmark workspace into a navigation site.
 *
 * Adds manual ordering, pinning/featured flags, visibility, click tracking and
 * category slugs. Every ALTER is guarded by PRAGMA table_info so this migration
 * is safe to run against a database that already has the new columns (fresh
 * installs get them from db/schema.sql directly).
 */

export const version = "0001_nav";

const CATEGORY_COLUMNS = {
  slug: "TEXT",
  sort_order: "INTEGER DEFAULT 0",
  is_visible: "INTEGER DEFAULT 1",
};

const BOOKMARK_COLUMNS = {
  sort_order: "INTEGER DEFAULT 0",
  is_pinned: "INTEGER DEFAULT 0",
  is_featured: "INTEGER DEFAULT 0",
  is_visible: "INTEGER DEFAULT 1",
  click_count: "INTEGER DEFAULT 0",
  last_click_at: "DATETIME",
  source: "TEXT DEFAULT 'manual'",
};

export async function up(ctx) {
  const statements = [];

  if (await ctx.tableExists("categories")) {
    for (const [name, definition] of Object.entries(CATEGORY_COLUMNS)) {
      if (!(await ctx.columnExists("categories", name))) {
        statements.push(
          `ALTER TABLE categories ADD COLUMN ${name} ${definition}`,
        );
      }
    }
  }

  if (await ctx.tableExists("bookmarks")) {
    for (const [name, definition] of Object.entries(BOOKMARK_COLUMNS)) {
      if (!(await ctx.columnExists("bookmarks", name))) {
        statements.push(
          `ALTER TABLE bookmarks ADD COLUMN ${name} ${definition}`,
        );
      }
    }
  }

  statements.push(
    `CREATE TABLE IF NOT EXISTS nav_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookmark_id INTEGER NOT NULL,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      referrer TEXT,
      user_agent TEXT,
      country TEXT,
      device TEXT,
      FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
    )`,
    "CREATE INDEX IF NOT EXISTS idx_nav_clicks_bookmark ON nav_clicks(bookmark_id, clicked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_nav_clicks_clicked_at ON nav_clicks(clicked_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_bookmarks_nav_order ON bookmarks(is_visible, category_id, is_pinned DESC, sort_order, id)",
    "CREATE INDEX IF NOT EXISTS idx_categories_nav_order ON categories(is_visible, sort_order, id)",
  );

  if (await ctx.tableExists("categories")) {
    statements.push(
      "UPDATE categories SET slug = 'c-' || id WHERE slug IS NULL OR slug = ''",
    );
  }

  if (await ctx.tableExists("bookmarks")) {
    statements.push(
      "UPDATE bookmarks SET sort_order = id WHERE sort_order IS NULL OR sort_order = 0",
      "UPDATE bookmarks SET click_count = COALESCE(visit_count, 0) WHERE COALESCE(click_count, 0) = 0",
      "UPDATE bookmarks SET is_visible = 1 WHERE is_visible IS NULL",
      "UPDATE bookmarks SET is_pinned = 0 WHERE is_pinned IS NULL",
      "UPDATE bookmarks SET is_featured = 0 WHERE is_featured IS NULL",
      // Existing favorites become the first curated "推荐" row.
      "UPDATE bookmarks SET is_featured = 1 WHERE COALESCE(is_featured, 0) = 0 AND COALESCE(is_favorite, 0) = 1",
      "UPDATE bookmarks SET source = 'manual' WHERE source IS NULL OR source = ''",
    );
  }

  // Must run after the slug backfill.
  if (await ctx.tableExists("categories")) {
    statements.push(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug) WHERE slug IS NOT NULL",
    );
  }

  if (statements.length) {
    await ctx.exec(statements.join(";\n"));
  }
}
