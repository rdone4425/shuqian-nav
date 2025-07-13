-- 本地开发数据库初始化脚本

-- 创建分类表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#007bff',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建书签表
CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    favicon_url TEXT,
    category_id INTEGER,
    keep_status TEXT DEFAULT 'normal',
    visit_count INTEGER DEFAULT 0,
    last_visited DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建已删除书签表（可选）
CREATE TABLE IF NOT EXISTS deleted_bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_id INTEGER,
    title TEXT,
    url TEXT,
    description TEXT,
    category_name TEXT,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_reason TEXT
);

-- 创建索引以提升性能
CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
CREATE INDEX IF NOT EXISTS idx_bookmarks_visit_count ON bookmarks(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_last_visited ON bookmarks(last_visited DESC);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- 插入默认数据
INSERT OR IGNORE INTO categories (id, name, color, description) VALUES 
(1, '工作学习', '#007bff', '工作和学习相关网站'),
(2, '娱乐休闲', '#28a745', '娱乐和休闲网站'),
(3, '工具软件', '#ffc107', '实用工具和软件'),
(4, '技术开发', '#dc3545', '编程和技术开发资源'),
(5, '新闻资讯', '#6f42c1', '新闻和资讯网站');

-- 插入示例书签
INSERT OR IGNORE INTO bookmarks (title, url, description, category_id, favicon_url) VALUES 
('GitHub', 'https://github.com', '全球最大的代码托管平台', 4, 'https://www.google.com/s2/favicons?domain=github.com&sz=32'),
('Stack Overflow', 'https://stackoverflow.com', '程序员问答社区', 4, 'https://www.google.com/s2/favicons?domain=stackoverflow.com&sz=32'),
('MDN Web Docs', 'https://developer.mozilla.org', 'Web开发文档', 4, 'https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32'),
('Google', 'https://www.google.com', '搜索引擎', 3, 'https://www.google.com/s2/favicons?domain=google.com&sz=32'),
('YouTube', 'https://www.youtube.com', '视频分享网站', 2, 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32');