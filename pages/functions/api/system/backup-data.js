/**
 * 数据库备份API
 * 在数据库升级前备份现有数据
 */

export async function onRequestPost(context) {
  try {
    console.log('=== 开始数据库备份 ===');
    
    const db = context.env.BOOKMARKS_DB;
    
    if (!db) {
      return new Response(JSON.stringify({
        success: false,
        error: '数据库未配置'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      tables: {}
    };

    // 备份核心表数据
    const tablesToBackup = [
      'system_config',
      'categories', 
      'bookmarks',
      'deleted_bookmarks',
      'bookmark_visits'
    ];

    for (const tableName of tablesToBackup) {
      try {
        console.log(`备份表: ${tableName}`);
        
        // 检查表是否存在
        const tableExists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .bind(tableName)
          .first();
        
        if (!tableExists) {
          console.log(`表 ${tableName} 不存在，跳过备份`);
          continue;
        }

        // 获取表结构
        const schema = await db.prepare(`PRAGMA table_info(${tableName})`).all();
        
        // 获取所有数据
        const data = await db.prepare(`SELECT * FROM ${tableName}`).all();
        
        backupData.tables[tableName] = {
          schema: schema.results || [],
          data: data.results || [],
          count: (data.results || []).length
        };
        
        console.log(`表 ${tableName} 备份完成，共 ${backupData.tables[tableName].count} 条记录`);
        
      } catch (error) {
        console.error(`备份表 ${tableName} 失败:`, error);
        backupData.tables[tableName] = {
          error: error.message,
          schema: [],
          data: [],
          count: 0
        };
      }
    }

    // 计算总统计
    const totalRecords = Object.values(backupData.tables)
      .reduce((sum, table) => sum + (table.count || 0), 0);

    const summary = {
      success: true,
      message: '数据备份完成',
      timestamp: backupData.timestamp,
      totalTables: Object.keys(backupData.tables).length,
      totalRecords: totalRecords,
      tables: Object.keys(backupData.tables).map(name => ({
        name,
        records: backupData.tables[name].count || 0,
        hasError: !!backupData.tables[name].error
      }))
    };

    console.log('备份完成:', summary);

    return new Response(JSON.stringify({
      ...summary,
      backupData: backupData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bookmark-backup-${new Date().toISOString().split('T')[0]}.json"`
      }
    });

  } catch (error) {
    console.error('数据备份失败:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: '数据备份失败: ' + error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  try {
    const db = context.env.BOOKMARKS_DB;
    
    if (!db) {
      return new Response(JSON.stringify({
        success: false,
        error: '数据库未配置'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查数据库状态
    const status = {
      tables: {},
      totalRecords: 0
    };

    const tablesToCheck = [
      'system_config', 'categories', 'bookmarks', 
      'deleted_bookmarks', 'bookmark_visits'
    ];

    for (const tableName of tablesToCheck) {
      try {
        const tableExists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .bind(tableName)
          .first();
        
        if (tableExists) {
          const count = await db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
          status.tables[tableName] = count?.count || 0;
          status.totalRecords += count?.count || 0;
        } else {
          status.tables[tableName] = 0;
        }
      } catch (error) {
        status.tables[tableName] = -1; // 表示错误
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: '数据库状态检查完成',
      ...status,
      canBackup: status.totalRecords > 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}