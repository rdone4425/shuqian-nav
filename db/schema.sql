CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
    session_id TEXT,
    user_agent TEXT,
    referrer TEXT,
    ip_address TEXT,
    device_type TEXT,
    browser_name TEXT,
    os_name TEXT,
    duration_seconds INTEGER DEFAULT 0,
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_key TEXT NOT NULL UNIQUE,
    total_visits INTEGER DEFAULT 0,
    unique_bookmarks INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    hourly_distribution TEXT,
    category_distribution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_term TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    session_id TEXT,
    user_agent TEXT,
    search_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    clicked_bookmark_id INTEGER,
    ip_address TEXT,
    FOREIGN KEY (clicked_bookmark_id) REFERENCES bookmarks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    browser_name TEXT,
    os_name TEXT,
    first_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_visits INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS popularity_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookmark_id INTEGER NOT NULL UNIQUE,
    popularity_score REAL DEFAULT 0,
    visit_score REAL DEFAULT 0,
    recency_score REAL DEFAULT 0,
    regularity_score REAL DEFAULT 0,
    freshness_score REAL DEFAULT 0,
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
    cache_key TEXT,
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS category_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    category_name TEXT NOT NULL,
    total_visits INTEGER DEFAULT 0,
    unique_bookmarks INTEGER DEFAULT 0,
    avg_visits_per_bookmark REAL DEFAULT 0,
    last_visit DATETIME,
    popularity_rank INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
CREATE INDEX IF NOT EXISTS idx_bookmarks_visit_count ON bookmarks(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_last_visited ON bookmarks(last_visited DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_popularity_score ON bookmarks(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_keep_status ON bookmarks(keep_status);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_favorite ON bookmarks(is_favorite);
CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON bookmarks(tags);

CREATE INDEX IF NOT EXISTS idx_bookmark_visits_bookmark_id ON bookmark_visits(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_visits_visit_time ON bookmark_visits(visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_bookmark_visits_session_id ON bookmark_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_visits_device_type ON bookmark_visits(device_type);
CREATE INDEX IF NOT EXISTS idx_bookmark_visits_ip_address ON bookmark_visits(ip_address);

CREATE INDEX IF NOT EXISTS idx_daily_analytics_date_key ON daily_analytics(date_key);
CREATE INDEX IF NOT EXISTS idx_daily_analytics_total_visits ON daily_analytics(total_visits DESC);
CREATE INDEX IF NOT EXISTS idx_daily_analytics_created_at ON daily_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_logs_search_term ON search_logs(search_term);
CREATE INDEX IF NOT EXISTS idx_search_logs_search_time ON search_logs(search_time DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_session_id ON search_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_clicked_bookmark_id ON search_logs(clicked_bookmark_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_result_count ON search_logs(result_count);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_type ON user_sessions(device_type);

CREATE INDEX IF NOT EXISTS idx_popularity_cache_bookmark_id ON popularity_cache(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_popularity_cache_popularity_score ON popularity_cache(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_popularity_cache_last_calculated ON popularity_cache(last_calculated);
CREATE INDEX IF NOT EXISTS idx_popularity_cache_cache_key ON popularity_cache(cache_key);

CREATE INDEX IF NOT EXISTS idx_category_analytics_category_id ON category_analytics(category_id);
CREATE INDEX IF NOT EXISTS idx_category_analytics_total_visits ON category_analytics(total_visits DESC);
CREATE INDEX IF NOT EXISTS idx_category_analytics_popularity_rank ON category_analytics(popularity_rank);
CREATE INDEX IF NOT EXISTS idx_category_analytics_last_visit ON category_analytics(last_visit DESC);

CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_url ON deleted_bookmarks(url);
CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_at ON deleted_bookmarks(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_original_bookmark_id ON deleted_bookmarks(original_bookmark_id);
CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_deleted_by ON deleted_bookmarks(deleted_by);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at ON system_config(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_created_at ON categories(created_at DESC);

INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES
    ('initialized', 'true', 'Database schema has been applied'),
    ('admin_password', 'admin123', 'Default admin password, change after first login'),
    ('site_title', '书签导航', 'Site title'),
    ('site_description', '现代化书签管理系统', 'Site description'),
    ('ai_api_endpoint', '', 'AI API endpoint, can be overridden by env'),
    ('ai_model', '', 'AI model name');

INSERT OR IGNORE INTO categories (name, color, description) VALUES
    ('工具', '#10B981', '开发工具和实用工具'),
    ('学习', '#3B82F6', '学习资源和教程'),
    ('娱乐', '#F59E0B', '娱乐和休闲网站'),
    ('其他', '#6B7280', '其他未分类网站');
