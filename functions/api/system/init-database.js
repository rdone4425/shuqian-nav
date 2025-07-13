/**
 * 数据库初始化API
 * 用于生产环境首次部署时初始化数据库表结构
 */

// 数据库模式定义
const DATABASE_SCHEMA = {
  tables: [
    {
      name: 'system_config',
      sql: 'CREATE TABLE IF NOT EXISTS system_config (id INTEGER PRIMARY KEY AUTOINCREMENT, config_key TEXT NOT NULL UNIQUE, config_value TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    },
    {
      name: 'categories',
      sql: 'CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT "#3B82F6", description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    },
    {
      name: 'bookmarks',
      sql: 'CREATE TABLE IF NOT EXISTS bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, description TEXT, category_id INTEGER, favicon_url TEXT, keep_status TEXT DEFAULT "normal", visit_count INTEGER DEFAULT 0, last_visited DATETIME, popularity_score REAL DEFAULT 0, tags TEXT, is_favorite INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL)'
    },
    {
      name: 'deleted_bookmarks',
      sql: 'CREATE TABLE IF NOT EXISTS deleted_bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, original_bookmark_id INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, category TEXT, description TEXT, favicon_url TEXT, tags TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT DEFAULT CURRENT_TIMESTAMP, deleted_reason TEXT, check_status TEXT, status_code INTEGER, status_text TEXT, error_message TEXT, keep_status TEXT, deleted_by TEXT DEFAULT "system")'
    },
    {
      name: 'bookmark_visits',
      sql: 'CREATE TABLE IF NOT EXISTS bookmark_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, bookmark_id INTEGER NOT NULL, visit_time DATETIME DEFAULT CURRENT_TIMESTAMP, session_id TEXT, user_agent TEXT, referrer TEXT, ip_address TEXT, device_type TEXT, browser_name TEXT, os_name TEXT, duration_seconds INTEGER DEFAULT 0, FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE)'
    },
    {
      name: 'daily_analytics',
      sql: 'CREATE TABLE IF NOT EXISTS daily_analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, date_key TEXT NOT NULL UNIQUE, total_visits INTEGER DEFAULT 0, unique_bookmarks INTEGER DEFAULT 0, unique_sessions INTEGER DEFAULT 0, hourly_distribution TEXT, category_distribution TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    },
    {
      name: 'search_logs',
      sql: 'CREATE TABLE IF NOT EXISTS search_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, search_term TEXT NOT NULL, result_count INTEGER DEFAULT 0, session_id TEXT, user_agent TEXT, search_time DATETIME DEFAULT CURRENT_TIMESTAMP, clicked_bookmark_id INTEGER, ip_address TEXT, FOREIGN KEY (clicked_bookmark_id) REFERENCES bookmarks(id) ON DELETE SET NULL)'
    },
    {
      name: 'user_sessions',
      sql: 'CREATE TABLE IF NOT EXISTS user_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE, ip_address TEXT, user_agent TEXT, device_type TEXT, browser_name TEXT, os_name TEXT, first_visit DATETIME DEFAULT CURRENT_TIMESTAMP, last_activity DATETIME DEFAULT CURRENT_TIMESTAMP, total_visits INTEGER DEFAULT 0, total_duration INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1)'
    },
    {
      name: 'popularity_cache',
      sql: 'CREATE TABLE IF NOT EXISTS popularity_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, bookmark_id INTEGER NOT NULL UNIQUE, popularity_score REAL DEFAULT 0, visit_score REAL DEFAULT 0, recency_score REAL DEFAULT 0, regularity_score REAL DEFAULT 0, freshness_score REAL DEFAULT 0, last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP, cache_key TEXT, FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE)'
    },
    {
      name: 'category_analytics',
      sql: 'CREATE TABLE IF NOT EXISTS category_analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, category_name TEXT NOT NULL, total_visits INTEGER DEFAULT 0, unique_bookmarks INTEGER DEFAULT 0, avg_visits_per_bookmark REAL DEFAULT 0, last_visit DATETIME, popularity_rank INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE)'
    }
  ],
  
  indexes: [
    // 书签表索引
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_visit_count ON bookmarks(visit_count DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_last_visited ON bookmarks(last_visited DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_popularity_score ON bookmarks(popularity_score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_keep_status ON bookmarks(keep_status)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_is_favorite ON bookmarks(is_favorite)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON bookmarks(tags)',
    
    // 访问记录表索引
    'CREATE INDEX IF NOT EXISTS idx_bookmark_visits_bookmark_id ON bookmark_visits(bookmark_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookmark_visits_visit_time ON bookmark_visits(visit_time DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bookmark_visits_session_id ON bookmark_visits(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookmark_visits_device_type ON bookmark_visits(device_type)',
    'CREATE INDEX IF NOT EXISTS idx_bookmark_visits_ip_address ON bookmark_visits(ip_address)',
    
    // 每日统计表索引
    'CREATE INDEX IF NOT EXISTS idx_daily_analytics_date_key ON daily_analytics(date_key)',
    'CREATE INDEX IF NOT EXISTS idx_daily_analytics_total_visits ON daily_analytics(total_visits DESC)',
    'CREATE INDEX IF NOT EXISTS idx_daily_analytics_created_at ON daily_analytics(created_at DESC)',
    
    // 搜索记录表索引
    'CREATE INDEX IF NOT EXISTS idx_search_logs_search_term ON search_logs(search_term)',
    'CREATE INDEX IF NOT EXISTS idx_search_logs_search_time ON search_logs(search_time DESC)',
    'CREATE INDEX IF NOT EXISTS idx_search_logs_session_id ON search_logs(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_search_logs_clicked_bookmark_id ON search_logs(clicked_bookmark_id)',
    'CREATE INDEX IF NOT EXISTS idx_search_logs_result_count ON search_logs(result_count)',
    
    // 用户会话表索引
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(ip_address)',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC)',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_device_type ON user_sessions(device_type)',
    
    // 热度缓存表索引
    'CREATE INDEX IF NOT EXISTS idx_popularity_cache_bookmark_id ON popularity_cache(bookmark_id)',
    'CREATE INDEX IF NOT EXISTS idx_popularity_cache_popularity_score ON popularity_cache(popularity_score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_popularity_cache_last_calculated ON popularity_cache(last_calculated)',
    'CREATE INDEX IF NOT EXISTS idx_popularity_cache_cache_key ON popularity_cache(cache_key)',
    
    // 分类统计表索引
    'CREATE INDEX IF NOT EXISTS idx_category_analytics_category_id ON category_analytics(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_category_analytics_total_visits ON category_analytics(total_visits DESC)',
    'CREATE INDEX IF NOT EXISTS idx_category_analytics_popularity_rank ON category_analytics(popularity_rank)',
    'CREATE INDEX IF NOT EXISTS idx_category_analytics_last_visit ON category_analytics(last_visit DESC)',
    
    // 已删除书签表索引
    'CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_url ON deleted_bookmarks(url)',
    'CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_at ON deleted_bookmarks(deleted_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_original_bookmark_id ON deleted_bookmarks(original_bookmark_id)',
    'CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_by ON deleted_bookmarks(deleted_by)',
    
    // 系统配置表索引
    'CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key)',
    'CREATE INDEX IF NOT EXISTS idx_system_config_updated_at ON system_config(updated_at DESC)',
    
    // 分类表索引
    'CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)',
    'CREATE INDEX IF NOT EXISTS idx_categories_created_at ON categories(created_at DESC)'
  ],
  
  initialData: [
    { table: 'system_config', data: [
      ['initialized', 'true', '系统是否已初始化'],
      ['admin_password', 'admin123', '管理员密码'],
      ['site_title', '书签导航', '网站标题'],
      ['site_description', '现代化书签管理系统', '网站描述']
    ]},
    { table: 'categories', data: [
      ['工具', '#10B981', '开发工具和实用工具'],
      ['学习', '#3B82F6', '学习资源和教程'],
      ['娱乐', '#F59E0B', '娱乐和休闲网站'],
      ['其他', '#6B7280', '其他未分类网站']
    ]}
  ]
};

// 工具函数
function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  try {
    console.log('=== 数据库初始化开始 ===');
    
    const db = context.env.BOOKMARKS_DB;
    
    if (!db) {
      return createResponse({
        success: false,
        error: '数据库未配置，请检查Cloudflare Pages的D1绑定设置'
      }, 500);
    }

    // 检查是否已经初始化
    const isInitialized = await checkIfInitialized(db);
    if (isInitialized) {
      console.log('数据库已经初始化');
      const verificationResult = await verifyDatabaseStructure(db);
      return createResponse({
        success: true,
        message: '数据库已经初始化',
        initialized: true,
        verification: verificationResult
      });
    }

    // 执行数据库初始化
    await initializeTables(db);
    await createIndexes(db);
    await insertInitialData(db);

    // 验证数据库结构
    const verificationResult = await verifyDatabaseStructure(db);
    
    if (!verificationResult.success) {
      throw new Error('数据库结构验证失败: ' + verificationResult.errors.join(', '));
    }

    console.log('数据库初始化完成！');
    return createResponse({
      success: true,
      message: '数据库初始化完成',
      initialized: true,
      timestamp: new Date().toISOString(),
      tables_created: verificationResult.tables,
      verification: verificationResult
    });

  } catch (error) {
    console.error('数据库初始化失败:', error);
    return createResponse({
      success: false,
      error: '数据库初始化失败: ' + error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

export async function onRequestGet(context) {
  try {
    const db = context.env.BOOKMARKS_DB;
    
    if (!db) {
      return createResponse({
        success: false,
        error: '数据库未配置',
        initialized: false
      }, 500);
    }

    const isInitialized = await checkIfInitialized(db);
    return createResponse({
      success: true,
      initialized: isInitialized,
      message: isInitialized ? '数据库已初始化' : '数据库未初始化'
    });

  } catch (error) {
    return createResponse({
      success: false,
      error: error.message,
      initialized: false
    }, 500);
  }
}

// 辅助函数
async function checkIfInitialized(db) {
  try {
    const result = await db.prepare('SELECT COUNT(*) as count FROM system_config WHERE config_key = ?')
      .bind('initialized')
      .first();
    return result && result.count > 0;
  } catch (error) {
    return false;
  }
}

async function initializeTables(db) {
  console.log('创建数据库表...');
  const tableQueries = DATABASE_SCHEMA.tables.map(table => db.prepare(table.sql));
  await db.batch(tableQueries);
}

async function createIndexes(db) {
  console.log('创建索引...');
  const indexQueries = DATABASE_SCHEMA.indexes.map(sql => db.prepare(sql));
  await db.batch(indexQueries);
}

async function insertInitialData(db) {
  console.log('插入初始数据...');
  const queries = [];
  
  for (const { table, data } of DATABASE_SCHEMA.initialData) {
    if (table === 'system_config') {
      for (const [key, value, desc] of data) {
        queries.push(
          db.prepare('INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)')
            .bind(key, value, desc)
        );
      }
    } else if (table === 'categories') {
      for (const [name, color, desc] of data) {
        queries.push(
          db.prepare('INSERT OR IGNORE INTO categories (name, color, description) VALUES (?, ?, ?)')
            .bind(name, color, desc)
        );
      }
    }
  }
  
  await db.batch(queries);
}

async function verifyDatabaseStructure(db) {
  const expectedTables = DATABASE_SCHEMA.tables.map(t => t.name);
  const verificationResult = {
    success: true,
    tables: [],
    errors: [],
    indexes: []
  };

  try {
    // 检查表是否存在
    for (const tableName of expectedTables) {
      try {
        const result = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .bind(tableName)
          .first();
        
        if (result) {
          verificationResult.tables.push(tableName);
        } else {
          verificationResult.errors.push(`表 ${tableName} 不存在`);
          verificationResult.success = false;
        }
      } catch (error) {
        verificationResult.errors.push(`检查表 ${tableName} 时出错: ${error.message}`);
        verificationResult.success = false;
      }
    }

    // 检查索引
    try {
      const indexes = await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
      verificationResult.indexes = indexes.results?.map(idx => idx.name) || [];
    } catch (error) {
      verificationResult.errors.push(`检查索引时出错: ${error.message}`);
    }

    // 检查初始数据
    try {
      const configCount = await db.prepare('SELECT COUNT(*) as count FROM system_config').first();
      const categoryCount = await db.prepare('SELECT COUNT(*) as count FROM categories').first();
      
      verificationResult.initialData = {
        configCount: configCount?.count || 0,
        categoryCount: categoryCount?.count || 0
      };
    } catch (error) {
      verificationResult.errors.push(`检查初始数据时出错: ${error.message}`);
    }

  } catch (error) {
    verificationResult.success = false;
    verificationResult.errors.push(`验证过程出错: ${error.message}`);
  }

  return verificationResult;
}
