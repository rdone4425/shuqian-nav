const REQUIRED_TABLES = [
  'system_config',
  'categories',
  'bookmarks',
  'deleted_bookmarks',
  'bookmark_visits',
  'daily_analytics',
  'search_logs',
  'user_sessions',
  'popularity_cache',
  'category_analytics'
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function pushCheck(checks, name, status, message, details) {
  checks.push({ name, status, message, details });
}

export async function onRequestGet(context) {
  const { env } = context;
  const checks = [];
  const diagnosis = {
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    checks
  };

  if (!env.BOOKMARKS_DB) {
    pushCheck(
      checks,
      'D1 绑定',
      'FAIL',
      '未检测到 BOOKMARKS_DB 绑定',
      '请检查 Cloudflare Pages 项目配置，以及 CI 是否已把 D1 绑定写入 production / preview 环境。'
    );

    diagnosis.summary = {
      overallStatus: 'NEEDS_ATTENTION',
      tablesExist: false,
      failedChecks: 1,
      totalChecks: checks.length
    };

    return json(
      {
        success: false,
        error: 'BOOKMARKS_DB 未绑定',
        recommendation: '请先检查 Cloudflare Pages 的 D1 绑定是否存在，然后重新部署。',
        diagnosis
      },
      500
    );
  }

  const db = env.BOOKMARKS_DB;

  try {
    const probe = await db.prepare('SELECT 1 AS ok').first();
    pushCheck(
      checks,
      '数据库连接',
      probe?.ok === 1 ? 'PASS' : 'FAIL',
      probe?.ok === 1 ? '数据库连接正常' : '数据库连接返回了异常结果',
      probe?.ok === 1 ? '已成功执行 SELECT 1 探针查询。' : JSON.stringify(probe)
    );
  } catch (error) {
    pushCheck(checks, '数据库连接', 'FAIL', '数据库连接失败', error.message);
  }

  const tableStatus = {};
  for (const tableName of REQUIRED_TABLES) {
    try {
      const row = await db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .bind(tableName)
        .first();

      tableStatus[tableName] = Boolean(row);
      pushCheck(
        checks,
        `表结构: ${tableName}`,
        row ? 'PASS' : 'FAIL',
        row ? '表已存在' : '表不存在',
        row
          ? `表 ${tableName} 已就绪。`
          : `表 ${tableName} 缺失，请检查 CI 中的 db/schema.sql 是否已执行。`
      );
    } catch (error) {
      tableStatus[tableName] = false;
      pushCheck(checks, `表结构: ${tableName}`, 'ERROR', '表检查失败', error.message);
    }
  }

  if (tableStatus.system_config) {
    try {
      const configRows = await db
        .prepare('SELECT config_key, config_value FROM system_config ORDER BY config_key')
        .all();
      const configs = configRows.results || [];
      const initialized = configs.some(
        (item) => item.config_key === 'initialized' && item.config_value === 'true'
      );

      pushCheck(
        checks,
        '系统配置',
        initialized ? 'PASS' : 'FAIL',
        initialized ? '已检测到 initialized 标记' : '未检测到 initialized 标记',
        `system_config 当前共有 ${configs.length} 条配置记录。`
      );

      diagnosis.systemConfigCount = configs.length;
    } catch (error) {
      pushCheck(checks, '系统配置', 'ERROR', '系统配置读取失败', error.message);
    }
  }

  if (tableStatus.bookmarks) {
    try {
      const bookmarkCount = await db.prepare('SELECT COUNT(*) AS count FROM bookmarks').first();
      pushCheck(
        checks,
        '书签数据',
        'INFO',
        '书签统计完成',
        `当前共有 ${bookmarkCount?.count || 0} 条书签记录。`
      );
      diagnosis.bookmarkCount = bookmarkCount?.count || 0;
    } catch (error) {
      pushCheck(checks, '书签数据', 'ERROR', '书签统计失败', error.message);
    }
  }

  if (tableStatus.categories) {
    try {
      const categoryCount = await db.prepare('SELECT COUNT(*) AS count FROM categories').first();
      pushCheck(
        checks,
        '分类数据',
        'INFO',
        '分类统计完成',
        `当前共有 ${categoryCount?.count || 0} 条分类记录。`
      );
      diagnosis.categoryCount = categoryCount?.count || 0;
    } catch (error) {
      pushCheck(checks, '分类数据', 'ERROR', '分类统计失败', error.message);
    }
  }

  const failedChecks = checks.filter((item) => item.status === 'FAIL' || item.status === 'ERROR');
  const allTablesExist = REQUIRED_TABLES.every((name) => tableStatus[name]);

  diagnosis.summary = {
    overallStatus: failedChecks.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION',
    tablesExist: allTablesExist,
    failedChecks: failedChecks.length,
    totalChecks: checks.length
  };

  return json({
    success: true,
    recommendation: allTablesExist
      ? '数据库绑定和表结构看起来正常。'
      : '有表缺失。请优先检查 D1 绑定，以及 GitHub Actions 中执行 db/schema.sql 的步骤是否成功。',
    diagnosis
  });
}
