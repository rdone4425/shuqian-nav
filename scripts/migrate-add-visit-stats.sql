-- 数据库迁移脚本：添加访问统计字段
-- 执行时间：2025-07-13

-- 为书签表添加访问统计字段
ALTER TABLE bookmarks ADD COLUMN visit_count INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN last_visited DATETIME;

-- 创建访问统计相关索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_visit_count ON bookmarks(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_last_visited ON bookmarks(last_visited DESC);

-- 更新现有书签的访问统计（可选，设置一些默认值）
UPDATE bookmarks SET visit_count = 0 WHERE visit_count IS NULL;

-- 验证迁移结果
-- SELECT name FROM pragma_table_info('bookmarks') WHERE name IN ('visit_count', 'last_visited');
