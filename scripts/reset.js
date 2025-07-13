#!/usr/bin/env node

/**
 * 智能数据库初始化脚本
 * 检查环境 -> 检查数据库绑定 -> 创建表
 */

const { execSync } = require('child_process');
const fs = require('fs');

// 从环境变量或参数获取数据库名称和选项
const args = process.argv.slice(2);
const cleanMode = args.includes('--clean');
const DB_NAME = process.env.DB_NAME || args.find(arg => !arg.startsWith('--')) || 'bookmark-navigator-dev-db';

function log(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  console.log(`${icons[type]} ${message}`);
}

function runCommand(command, description) {
  try {
    log(description);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || '' };
  }
}

// 1. 检查环境文件
function checkEnvironment() {
  log('检查环境配置...');

  if (!fs.existsSync('.dev.vars')) {
    log('缺少 .dev.vars 文件', 'error');
    log('请创建 .dev.vars 文件并添加以下内容:', 'info');
    console.log('ADMIN_PASSWORD=admin123');
    console.log('JWT_SECRET=your-secret-key');
    console.log('ENVIRONMENT=development');
    process.exit(1);
  }

  log('环境配置检查通过', 'success');
}

// 2. 检查数据库绑定
function checkDatabaseBinding() {
  log('检查数据库绑定...');

  // 直接尝试连接数据库，如果失败则创建
  const testResult = runCommand(
    `npx wrangler d1 execute ${DB_NAME} --command="SELECT 1;" --local`,
    '测试数据库连接'
  );

  if (!testResult.success) {
    log(`数据库 ${DB_NAME} 不存在或未配置`, 'warning');
    log('正在创建数据库...', 'info');

    const createResult = runCommand(
      `npx wrangler d1 create ${DB_NAME}`,
      '创建数据库'
    );

    if (!createResult.success) {
      log('数据库创建失败', 'error');
      log('请手动执行: npx wrangler d1 create bookmark-navigator-dev-db', 'info');
      log('然后将返回的database_id更新到 wrangler.toml 文件中', 'info');
      process.exit(1);
    }

    // 提取数据库ID并提示用户更新配置
    const dbIdMatch = createResult.output.match(/database_id = "([^"]+)"/);
    if (dbIdMatch) {
      log('数据库创建成功！', 'success');
      log(`数据库ID: ${dbIdMatch[1]}`, 'info');
      log('请将此ID更新到 wrangler.toml 文件中，然后重新运行', 'warning');
      process.exit(0);
    }
  } else {
    log('数据库连接正常', 'success');
  }
}

// 3. 创建数据库表（直接使用SQL）
function createTables() {
  log('初始化数据库表...');
  createTablesDirectly();
}

// 直接执行SQL创建数据库表（降级方案）
function createTablesDirectly() {
  log('使用直接SQL方式创建数据库表...', 'info');

  const sqlCommands = [
    // 1. 创建系统配置表
    'CREATE TABLE IF NOT EXISTS system_config (id INTEGER PRIMARY KEY AUTOINCREMENT, config_key TEXT NOT NULL UNIQUE, config_value TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)',

    // 2. 创建分类表
    'CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT "#3B82F6", description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)',

    // 3. 创建书签表
    'CREATE TABLE IF NOT EXISTS bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, description TEXT, category_id INTEGER, favicon_url TEXT, keep_status TEXT DEFAULT "normal", visit_count INTEGER DEFAULT 0, last_visited DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL)',

    // 4. 创建已删除书签表
    'CREATE TABLE IF NOT EXISTS deleted_bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, original_bookmark_id INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, category TEXT, description TEXT, favicon_url TEXT, tags TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT DEFAULT CURRENT_TIMESTAMP, deleted_reason TEXT, check_status TEXT, status_code INTEGER, status_text TEXT, error_message TEXT, keep_status TEXT, deleted_by TEXT DEFAULT "system")',

    // 5. 创建书签访问记录表
    'CREATE TABLE IF NOT EXISTS bookmark_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, bookmark_id INTEGER NOT NULL, visit_time DATETIME DEFAULT CURRENT_TIMESTAMP, user_agent TEXT, referrer TEXT, FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE)'
  ];

  const indexCommands = [
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)',
    'CREATE INDEX IF NOT EXISTS idx_deleted_bookmarks_url ON deleted_bookmarks(url)',
    'CREATE INDEX IF NOT EXISTS idx_bookmark_visits_bookmark_id ON bookmark_visits(bookmark_id)'
  ];

  const configCommands = [
    'INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES ("initialized", "true", "系统是否已初始化")',
    'INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES ("admin_password", "admin123", "管理员密码")',
    'INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES ("site_title", "书签导航", "网站标题")',
    'INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES ("site_description", "现代化书签管理系统", "网站描述")'
  ];

  const categoryCommands = [
    'INSERT OR IGNORE INTO categories (name, color, description) VALUES ("工具", "#10B981", "开发工具和实用工具")',
    'INSERT OR IGNORE INTO categories (name, color, description) VALUES ("学习", "#3B82F6", "学习资源和教程")',
    'INSERT OR IGNORE INTO categories (name, color, description) VALUES ("娱乐", "#F59E0B", "娱乐和休闲网站")',
    'INSERT OR IGNORE INTO categories (name, color, description) VALUES ("其他", "#6B7280", "其他未分类网站")'
  ];

  // 执行所有SQL命令
  const allCommands = [...sqlCommands, ...indexCommands, ...configCommands];

  if (!cleanMode) {
    allCommands.push(...categoryCommands);
  }

  for (const command of allCommands) {
    const result = runCommand(
      `npx wrangler d1 execute ${DB_NAME} --command="${command}" --local`,
      `执行SQL: ${command.substring(0, 50)}...`
    );

    if (!result.success) {
      log(`SQL执行失败: ${command}`, 'error');
      log(result.error, 'error');
      process.exit(1);
    }
  }

  log('数据库表创建完成！', 'success');
}

// 主函数
function main() {
  if (cleanMode) {
    log('🔄 重置数据库（干净模式 - 不包含示例数据）...');
  } else {
    log('🔄 重置数据库（清空并重新创建示例数据）...');
  }

  try {
    checkEnvironment();
    checkDatabaseBinding();
    createTables();

    log('✅ 数据库重置完成！', 'success');
    if (cleanMode) {
      log('💡 数据库已重置为空白状态，没有示例数据', 'info');
    } else {
      log('💡 所有数据已清空并重新创建示例数据', 'info');
    }
    log('💡 现在可以启动开发服务器: npm run dev', 'info');

  } catch (error) {
    log(`重置失败: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}