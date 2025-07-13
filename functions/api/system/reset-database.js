/**
 * 重置数据库API
 * 完全清空数据库并重新创建表结构（危险操作）
 */

import { authenticateRequest } from '../auth/verify.js';

export async function onRequestPost(context) {
  try {
    // 验证认证
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = context.env.BOOKMARKS_DB;
    
    // 重置数据库的SQL语句
    const resetSQL = `
      -- 删除所有表
      DROP TABLE IF EXISTS bookmarks;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS system_config;
      DROP TABLE IF EXISTS deleted_bookmarks;
      DROP TABLE IF EXISTS bookmark_visits;

      -- 重新创建表结构
      CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT DEFAULT '#3B82F6',
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          category_id INTEGER,
          favicon_url TEXT,
          keep_status TEXT DEFAULT 'normal' CHECK (keep_status IN ('normal', 'keep', 'ignore')),
          visit_count INTEGER DEFAULT 0,
          last_visited DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS system_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key TEXT NOT NULL UNIQUE,
          config_value TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS bookmark_visits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bookmark_id INTEGER NOT NULL,
          visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_agent TEXT,
          referrer TEXT,
          FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_keep_status ON bookmarks(keep_status);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_visit_count ON bookmarks(visit_count);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_last_visited ON bookmarks(last_visited);

      CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_original_id ON deleted_bookmarks(original_bookmark_id);
      CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_at ON deleted_bookmarks(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_url ON deleted_bookmarks(url);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_bookmarks_unique_url ON deleted_bookmarks(url, original_bookmark_id);

      CREATE INDEX IF NOT EXISTS idx_bookmark_visits_bookmark_id ON bookmark_visits(bookmark_id);
      CREATE INDEX IF NOT EXISTS idx_bookmark_visits_time ON bookmark_visits(visit_time);

      -- 创建触发器
      CREATE TRIGGER IF NOT EXISTS update_bookmarks_timestamp
          AFTER UPDATE ON bookmarks
          BEGIN
              UPDATE bookmarks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;

      CREATE TRIGGER IF NOT EXISTS update_categories_timestamp
          AFTER UPDATE ON categories
          BEGIN
              UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;

      CREATE TRIGGER IF NOT EXISTS update_system_config_timestamp
          AFTER UPDATE ON system_config
          BEGIN
              UPDATE system_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;

      CREATE TRIGGER IF NOT EXISTS update_bookmark_visit_count
          AFTER INSERT ON bookmark_visits
          BEGIN
              UPDATE bookmarks 
              SET visit_count = visit_count + 1,
                  last_visited = NEW.visit_time
              WHERE id = NEW.bookmark_id;
          END;

      -- 插入基本系统配置
      INSERT OR REPLACE INTO system_config (config_key, config_value, description) VALUES
          ('site_title', '书签导航', '网站标题'),
          ('site_description', '现代化书签管理系统', '网站描述'),
          ('has_user_data', 'false', '系统是否包含用户导入的数据'),
          ('initialized', 'true', '系统是否已初始化');
    `;

    // 执行重置操作
    await db.exec(resetSQL);

    return new Response(JSON.stringify({
      success: true,
      message: '数据库重置完成',
      data: {
        action: 'database_reset',
        timestamp: new Date().toISOString(),
        summary: '数据库已完全重置，所有数据已清空'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('重置数据库失败:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: '重置数据库失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
