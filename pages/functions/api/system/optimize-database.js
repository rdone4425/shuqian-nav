import { authenticateRequest } from "../auth/verify.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: auth.error,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("开始数据库优化...");

    const optimizations = [
      {
        name: "idx_bookmarks_category",
        sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id)",
        description: "书签分类索引",
      },
      {
        name: "idx_bookmarks_created_at",
        sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC)",
        description: "书签创建时间索引",
      },
      {
        name: "idx_bookmarks_title",
        sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title)",
        description: "书签标题索引（用于搜索）",
      },
      {
        name: "idx_bookmarks_url",
        sql: "CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)",
        description: "URL 索引（用于重复检测）",
      },
      {
        name: "idx_system_config_key",
        sql: "CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key)",
        description: "系统配置键索引",
      },
    ];

    const results = [];

    for (const opt of optimizations) {
      try {
        await env.BOOKMARKS_DB.exec(opt.sql);
        results.push({
          index: opt.name,
          description: opt.description,
          status: "success",
        });
        console.log(`✅ ${opt.description} 创建成功`);
      } catch (error) {
        results.push({
          index: opt.name,
          description: opt.description,
          status: "error",
          error: error.message,
        });
        console.error(`❌ ${opt.description} 创建失败:`, error);
      }
    }

    try {
      await env.BOOKMARKS_DB.exec("VACUUM");
      results.push({
        index: "vacuum",
        description: "数据库碎片整理",
        status: "success",
      });
      console.log("✅ 数据库 VACUUM 优化完成");
    } catch (error) {
      results.push({
        index: "vacuum",
        description: "数据库碎片整理",
        status: "error",
        error: error.message,
      });
      console.error("❌ VACUUM 优化失败:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "数据库优化完成",
        optimizations: results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("数据库优化失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "数据库优化失败",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: auth.error,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

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

    return new Response(
      JSON.stringify({
        success: true,
        database_stats: stats,
        indexes: indexes.results || [],
        recommendations: {
          needs_optimization: stats.total_bookmarks > 1000,
          suggested_actions:
            stats.total_bookmarks > 1000
              ? ["启用分页加载", "考虑缓存热门书签"]
              : ["数据库性能良好"],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("获取数据库状态失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "获取数据库状态失败",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
