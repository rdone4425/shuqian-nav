import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const OPTIMIZATIONS = [
  {
    name: "idx_bookmarks_category",
    sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id)",
    description: "Bookmarks category index",
  },
  {
    name: "idx_bookmarks_created_at",
    sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC)",
    description: "Bookmarks created-time index",
  },
  {
    name: "idx_bookmarks_title",
    sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title)",
    description: "Bookmarks title index for search",
  },
  {
    name: "idx_bookmarks_url",
    sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)",
    description: "Bookmarks URL index for duplicate checks",
  },
  {
    name: "idx_system_config_key",
    sql: "CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key)",
    description: "System config key index",
  },
];

async function requireAdmin(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return { error: ResponseHelper.unauthorized(auth.error) };
  }
  return { auth };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const admin = await requireAdmin(request, env);
    if (admin.error) return admin.error;

    const results = [];

    for (const optimization of OPTIMIZATIONS) {
      try {
        await env.BOOKMARKS_DB.exec(optimization.sql);
        results.push({
          index: optimization.name,
          description: optimization.description,
          status: "success",
        });
      } catch (error) {
        results.push({
          index: optimization.name,
          description: optimization.description,
          status: "error",
          error: error.message,
        });
      }
    }

    try {
      await env.BOOKMARKS_DB.exec("VACUUM");
      results.push({
        index: "vacuum",
        description: "Database vacuum cleanup",
        status: "success",
      });
    } catch (error) {
      results.push({
        index: "vacuum",
        description: "Database vacuum cleanup",
        status: "error",
        error: error.message,
      });
    }

    return ResponseHelper.success(
      { optimizations: results },
      "Database optimization completed",
    );
  } catch (error) {
    console.error("Database optimization failed:", error);
    return ResponseHelper.serverError(
      "Database optimization failed",
      error.message,
    );
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const admin = await requireAdmin(request, env);
    if (admin.error) return admin.error;

    const stats = await env.BOOKMARKS_DB.prepare(
      `
        SELECT
          (SELECT COUNT(*) FROM bookmarks) as total_bookmarks,
          (SELECT COUNT(DISTINCT category_id) FROM bookmarks) as total_categories,
          (SELECT COUNT(*) FROM system_config) as total_configs
      `,
    ).first();

    const indexes = await env.BOOKMARKS_DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
    ).all();

    const totalBookmarks = Number(stats?.total_bookmarks || 0);

    return ResponseHelper.success({
      database_stats: stats,
      indexes: indexes.results || [],
      recommendations: {
        needs_optimization: totalBookmarks > 1000,
        suggested_actions:
          totalBookmarks > 1000
            ? ["Enable paginated loading", "Consider caching popular bookmarks"]
            : ["Database performance looks good"],
      },
    });
  } catch (error) {
    console.error("Failed to get database status:", error);
    return ResponseHelper.serverError(
      "Failed to get database status",
      error.message,
    );
  }
}
