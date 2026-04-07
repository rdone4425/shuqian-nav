// 每周定时链接检查
// 这个API可以通过Cloudflare Cron触发器或外部定时服务调用

// 检查单个URL的可访问性
async function checkUrl(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BookmarkNavigator/1.0 Weekly Checker'
      }
    });
    
    clearTimeout(timeoutId);
    
    return {
      url,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      error: null,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      url,
      accessible: false,
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      checkedAt: new Date().toISOString()
    };
  }
}

// 发送通知邮件（如果配置了邮件服务）
async function sendNotification(env, deletedBookmarks, inaccessibleBookmarks) {
  try {
    // 这里可以集成邮件服务，比如SendGrid、Mailgun等
    // 目前只记录到系统配置中
    const notification = {
      type: 'weekly_check_notification',
      timestamp: new Date().toISOString(),
      deletedCount: 0, // 定时任务不删除
      inaccessibleCount: inaccessibleBookmarks.length,
      message: '发现无法访问的链接，请手动检查处理',
      inaccessibleBookmarks: inaccessibleBookmarks.slice(0, 10) // 只保存前10个
    };

    await env.BOOKMARKS_DB
      .prepare(`INSERT INTO system_config (config_key, config_value, description) 
                VALUES (?, ?, ?)`)
      .bind(
        `weekly_notification_${Date.now()}`,
        JSON.stringify(notification),
        `每周检查通知 - ${new Date().toLocaleString()}`
      )
      .run();

    console.log('通知已记录到数据库');
  } catch (error) {
    console.error('发送通知失败:', error);
  }
}

// 每周定时检查处理器
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 验证请求来源（可以添加密钥验证）
    const authHeader = request.headers.get('Authorization');
    const cronSecret = env.CRON_SECRET || 'default-cron-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({
        success: false,
        error: '未授权的请求'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('开始每周链接检查...');

    // 获取所有书签
    const bookmarks = await env.BOOKMARKS_DB
      .prepare('SELECT id, title, url, category_id, created_at FROM bookmarks ORDER BY id')
      .all();

    if (!bookmarks.results.length) {
      return new Response(JSON.stringify({
        success: true,
        message: '没有书签需要检查'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    const inaccessibleBookmarks = [];
    let checkedCount = 0;
    let accessibleCount = 0;
    let inaccessibleCount = 0;

    // 分批检查，每批5个，避免过载
    const batchSize = 5;
    for (let i = 0; i < bookmarks.results.length; i += batchSize) {
      const batch = bookmarks.results.slice(i, i + batchSize);
      
      const batchPromises = batch.map(bookmark => 
        checkUrl(bookmark.url).then(result => ({
          ...result,
          bookmarkId: bookmark.id,
          title: bookmark.title,
          categoryId: bookmark.category_id,
          createdAt: bookmark.created_at
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 统计结果
      batchResults.forEach(result => {
        checkedCount++;
        if (result.accessible) {
          accessibleCount++;
        } else {
          inaccessibleCount++;
          inaccessibleBookmarks.push(result);
        }
      });

      // 添加延迟，避免过于频繁的请求
      if (i + batchSize < bookmarks.results.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 定时任务只检查，不自动删除
    // 用户可以通过手动链接检查功能来删除无效链接

    // 记录检查结果
    const checkRecord = {
      type: 'weekly_auto_check',
      checkedAt: new Date().toISOString(),
      total: bookmarks.results.length,
      accessible: accessibleCount,
      inaccessible: inaccessibleCount,
      autoDelete: false, // 定时任务不自动删除
      results: JSON.stringify(results.slice(0, 50)) // 只保存前50个结果
    };

    await env.BOOKMARKS_DB
      .prepare(`INSERT INTO system_config (config_key, config_value, description) 
                VALUES (?, ?, ?)`)
      .bind(
        `weekly_check_${Date.now()}`,
        JSON.stringify(checkRecord),
        `每周自动检查 - ${new Date().toLocaleString()}`
      )
      .run();

    // 发送通知（仅当有无效链接时）
    if (inaccessibleCount > 0) {
      await sendNotification(env, [], inaccessibleBookmarks);
    }

    console.log(`每周检查完成: 检查${checkedCount}个, ${accessibleCount}个可访问, ${inaccessibleCount}个无法访问`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        total: bookmarks.results.length,
        checked: checkedCount,
        accessible: accessibleCount,
        inaccessible: inaccessibleCount,
        inaccessibleBookmarks: inaccessibleBookmarks.slice(0, 10), // 只返回前10个
        checkTime: new Date().toISOString()
      },
      message: `每周检查完成: ${accessibleCount}个可访问, ${inaccessibleCount}个无法访问（需手动处理）`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('每周链接检查失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '每周链接检查失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取每周检查通知
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 获取最近的通知记录
    const notifications = await env.BOOKMARKS_DB
      .prepare(`SELECT config_key, config_value, description, created_at 
                FROM system_config 
                WHERE config_key LIKE 'weekly_notification_%' 
                   OR config_key LIKE 'weekly_check_%'
                ORDER BY created_at DESC 
                LIMIT 10`)
      .all();

    const history = notifications.results.map(record => {
      try {
        const data = JSON.parse(record.config_value);
        return {
          id: record.config_key,
          ...data,
          createdAt: record.created_at
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      data: history
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取通知记录失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取通知记录失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
