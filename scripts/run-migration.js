#!/usr/bin/env node

// 数据库迁移脚本：添加访问统计字段
// 使用方法：node scripts/run-migration.js

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库路径
const DB_PATH = join(__dirname, '../local-database.db');
const MIGRATION_SQL = join(__dirname, 'migrate-add-visit-stats.sql');

async function runMigration() {
  console.log('🚀 开始数据库迁移...');
  
  try {
    // 连接数据库
    const db = new Database(DB_PATH);
    console.log('✅ 数据库连接成功');
    
    // 检查是否已经有访问统计字段
    const tableInfo = db.prepare("PRAGMA table_info(bookmarks)").all();
    const hasVisitCount = tableInfo.some(col => col.name === 'visit_count');
    const hasLastVisited = tableInfo.some(col => col.name === 'last_visited');
    
    if (hasVisitCount && hasLastVisited) {
      console.log('⚠️  访问统计字段已存在，跳过迁移');
      db.close();
      return;
    }
    
    // 读取迁移SQL
    const migrationSQL = readFileSync(MIGRATION_SQL, 'utf8');
    console.log('📄 读取迁移脚本成功');
    
    // 执行迁移
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));
    
    db.transaction(() => {
      for (const statement of statements) {
        if (statement) {
          try {
            db.exec(statement);
            console.log(`✅ 执行: ${statement.substring(0, 50)}...`);
          } catch (error) {
            if (!error.message.includes('duplicate column name')) {
              throw error;
            }
            console.log(`⚠️  跳过已存在的字段: ${statement.substring(0, 50)}...`);
          }
        }
      }
    })();
    
    // 验证迁移结果
    const newTableInfo = db.prepare("PRAGMA table_info(bookmarks)").all();
    const newHasVisitCount = newTableInfo.some(col => col.name === 'visit_count');
    const newHasLastVisited = newTableInfo.some(col => col.name === 'last_visited');
    
    if (newHasVisitCount && newHasLastVisited) {
      console.log('✅ 迁移成功！访问统计字段已添加');
      
      // 显示字段信息
      console.log('\n📊 书签表结构:');
      newTableInfo.forEach(col => {
        if (['visit_count', 'last_visited'].includes(col.name)) {
          console.log(`  - ${col.name}: ${col.type} (${col.dflt_value || 'NULL'})`);
        }
      });
      
      // 统计现有数据
      const bookmarkCount = db.prepare("SELECT COUNT(*) as count FROM bookmarks").get();
      console.log(`\n📈 现有书签数量: ${bookmarkCount.count}`);
      
    } else {
      console.error('❌ 迁移失败：字段未正确添加');
    }
    
    db.close();
    console.log('🎉 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

// 运行迁移
runMigration();
