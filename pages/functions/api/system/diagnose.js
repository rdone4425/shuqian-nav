/**
 * 数据库诊断API
 * 详细检查数据库绑定和表结构状态
 */

export async function onRequestGet(context) {
  const diagnosis = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    checks: []
  };

  try {
    // 1. 检查数据库绑定
    diagnosis.checks.push({
      name: '数据库绑定检查',
      status: context.env.BOOKMARKS_DB ? 'PASS' : 'FAIL',
      message: context.env.BOOKMARKS_DB ? '数据库已绑定' : '数据库未绑定',
      details: context.env.BOOKMARKS_DB ? 'BOOKMARKS_DB 环境变量存在' : 'BOOKMARKS_DB 环境变量不存在'
    });

    if (!context.env.BOOKMARKS_DB) {
      return new Response(JSON.stringify({
        success: false,
        error: '数据库未绑定',
        diagnosis
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = context.env.BOOKMARKS_DB;

    // 2. 检查数据库基本连接
    try {
      await db.prepare('SELECT 1 as test').first();
      diagnosis.checks.push({
        name: '数据库连接测试',
        status: 'PASS',
        message: '数据库连接正常',
        details: '成功执行简单查询'
      });
    } catch (error) {
      diagnosis.checks.push({
        name: '数据库连接测试',
        status: 'FAIL',
        message: '数据库连接失败',
        details: error.message
      });
    }

    // 3. 检查表是否存在
    const tables = ['categories', 'bookmarks', 'system_config', 'deleted_bookmarks', 'bookmark_visits'];
    const tableStatus = {};

    for (const tableName of tables) {
      try {
        const result = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
          .bind(tableName)
          .first();
        
        tableStatus[tableName] = !!result;
        
        diagnosis.checks.push({
          name: `表检查: ${tableName}`,
          status: result ? 'PASS' : 'FAIL',
          message: result ? '表存在' : '表不存在',
          details: result ? `表 ${tableName} 已创建` : `表 ${tableName} 需要创建`
        });
      } catch (error) {
        tableStatus[tableName] = false;
        diagnosis.checks.push({
          name: `表检查: ${tableName}`,
          status: 'ERROR',
          message: '检查失败',
          details: error.message
        });
      }
    }

    // 4. 检查系统配置
    if (tableStatus.system_config) {
      try {
        const configResult = await db.prepare('SELECT config_key, config_value FROM system_config')
          .all();
        
        const configs = configResult.results || [];
        const hasInitialized = configs.find(c => c.config_key === 'initialized' && c.config_value === 'true');
        
        diagnosis.checks.push({
          name: '系统配置检查',
          status: hasInitialized ? 'PASS' : 'FAIL',
          message: hasInitialized ? '系统已初始化' : '系统未初始化',
          details: `找到 ${configs.length} 个配置项`
        });

        diagnosis.systemConfig = configs;
      } catch (error) {
        diagnosis.checks.push({
          name: '系统配置检查',
          status: 'ERROR',
          message: '配置检查失败',
          details: error.message
        });
      }
    }

    // 5. 检查数据统计
    if (tableStatus.bookmarks && tableStatus.categories) {
      try {
        const bookmarkCount = await db.prepare('SELECT COUNT(*) as count FROM bookmarks').first();
        const categoryCount = await db.prepare('SELECT COUNT(*) as count FROM categories').first();
        
        diagnosis.checks.push({
          name: '数据统计',
          status: 'INFO',
          message: '数据统计完成',
          details: `书签: ${bookmarkCount.count} 个, 分类: ${categoryCount.count} 个`
        });

        diagnosis.dataStats = {
          bookmarks: bookmarkCount.count,
          categories: categoryCount.count
        };
      } catch (error) {
        diagnosis.checks.push({
          name: '数据统计',
          status: 'ERROR',
          message: '统计失败',
          details: error.message
        });
      }
    }

    // 6. 总体状态评估
    const failedChecks = diagnosis.checks.filter(c => c.status === 'FAIL' || c.status === 'ERROR');
    const allTablesExist = Object.values(tableStatus).every(exists => exists);
    
    diagnosis.summary = {
      overallStatus: failedChecks.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION',
      tablesExist: allTablesExist,
      needsInitialization: !allTablesExist,
      failedChecks: failedChecks.length,
      totalChecks: diagnosis.checks.length
    };

    return new Response(JSON.stringify({
      success: true,
      diagnosis,
      recommendation: allTablesExist ? 
        '数据库状态正常，可以正常使用' : 
        '数据库需要初始化，请访问 /init.html 进行初始化'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    diagnosis.checks.push({
      name: '诊断过程',
      status: 'ERROR',
      message: '诊断失败',
      details: error.message
    });

    return new Response(JSON.stringify({
      success: false,
      error: '诊断失败: ' + error.message,
      diagnosis
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
