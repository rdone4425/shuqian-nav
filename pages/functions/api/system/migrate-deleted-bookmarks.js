import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const MIGRATION_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS deleted_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_bookmark_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT,
      description TEXT,
      favicon_url TEXT,
      tags TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_reason TEXT,
      check_status TEXT,
      status_code INTEGER,
      status_text TEXT,
      error_message TEXT,
      keep_status TEXT,
      deleted_by TEXT DEFAULT 'system'
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_original_id
    ON deleted_bookmarks(original_bookmark_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_at
    ON deleted_bookmarks(deleted_at);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_url
    ON deleted_bookmarks(url);
  `,
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    for (const statement of MIGRATION_STATEMENTS) {
      await env.BOOKMARKS_DB.exec(statement);
    }

    return ResponseHelper.success(
      {
        migrated: true,
        table: "deleted_bookmarks",
        statements: MIGRATION_STATEMENTS.length,
      },
      "Deleted bookmarks migration completed",
    );
  } catch (error) {
    console.error("Deleted bookmarks migration failed:", error);
    return ResponseHelper.serverError(
      "Deleted bookmarks migration failed",
      error.message,
    );
  }
}
