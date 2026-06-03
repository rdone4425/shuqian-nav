import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

async function hasKeepStatusColumn(env) {
  try {
    await env.BOOKMARKS_DB.prepare(
      "SELECT keep_status FROM bookmarks LIMIT 1",
    ).first();
    return true;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    if (await hasKeepStatusColumn(env)) {
      return ResponseHelper.success(
        {
          migrated: false,
          field: "keep_status",
          reason: "already_exists",
        },
        "keep_status column already exists",
      );
    }

    await env.BOOKMARKS_DB.prepare(
      "ALTER TABLE bookmarks ADD COLUMN keep_status TEXT DEFAULT 'normal'",
    ).run();

    let indexCreated = true;
    try {
      await env.BOOKMARKS_DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_bookmarks_keep_status ON bookmarks(keep_status)",
      ).run();
    } catch (error) {
      indexCreated = false;
      console.warn("Failed to create keep_status index:", error.message);
    }

    await env.BOOKMARKS_DB.prepare(
      "SELECT keep_status FROM bookmarks LIMIT 1",
    ).first();

    return ResponseHelper.success(
      {
        migrated: true,
        field: "keep_status",
        indexCreated,
      },
      "keep_status column migration completed",
    );
  } catch (error) {
    console.error("Database migration failed:", error);
    return ResponseHelper.serverError(
      "Database migration failed",
      error.message,
    );
  }
}
