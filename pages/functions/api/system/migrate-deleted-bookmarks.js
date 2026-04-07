// 创建删除书签记录表的迁移
export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 创建删除书签记录表
    await env.BOOKMARKS_DB.exec(`
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
    `);

    // 创建索引以提高查询性能
    await env.BOOKMARKS_DB.exec(`
      CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_original_id
      ON deleted_bookmarks(original_bookmark_id);
    `);

    await env.BOOKMARKS_DB.exec(`
      CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_at
      ON deleted_bookmarks(deleted_at);
    `);

    await env.BOOKMARKS_DB.exec(`
      CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_url
      ON deleted_bookmarks(url);
    `);

    return new Response(JSON.stringify({
      success: true,
      message: '删除书签记录表创建成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('创建删除书签记录表失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '创建删除书签记录表失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
