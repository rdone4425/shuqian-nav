// 删除记录管理工具函数
// 提供去重的删除记录插入功能

/**
 * 安全插入删除记录（带去重检查）
 * @param {Object} env - Cloudflare环境对象
 * @param {Object} bookmark - 书签信息
 * @param {Object} options - 删除选项
 * @returns {Promise<boolean>} 是否成功插入新记录
 */
export async function insertDeletedBookmarkSafe(env, bookmark, options = {}) {
  try {
    const {
      deleteReason = 'manual',
      checkStatus = null,
      statusCode = null,
      statusText = null,
      errorMessage = null,
      keepStatus = null,
      deletedBy = 'user'
    } = options;

    // 检查是否已存在相同的删除记录
    const existingRecord = await env.BOOKMARKS_DB.prepare(`
      SELECT id FROM deleted_bookmarks 
      WHERE url = ? AND original_bookmark_id = ?
    `).bind(bookmark.url, bookmark.id).first();

    if (existingRecord) {
      console.log(`删除记录已存在 (URL: ${bookmark.url}, ID: ${bookmark.id})，跳过重复插入`);
      return false; // 记录已存在，未插入新记录
    }

    // 插入新的删除记录
    const result = await env.BOOKMARKS_DB.prepare(`
      INSERT INTO deleted_bookmarks (
        original_bookmark_id, title, url, category, description,
        favicon_url, created_at, updated_at, deleted_reason,
        check_status, status_code, status_text, error_message,
        keep_status, deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      bookmark.id,
      bookmark.title,
      bookmark.url,
      bookmark.category_name || bookmark.category || null,
      bookmark.description || null,
      bookmark.favicon_url || null,
      bookmark.created_at || new Date().toISOString(),
      bookmark.updated_at || new Date().toISOString(),
      deleteReason,
      checkStatus,
      statusCode,
      statusText,
      errorMessage,
      keepStatus || bookmark.keep_status || null,
      deletedBy
    ).run();

    if (result.success) {
      console.log(`成功插入删除记录 (URL: ${bookmark.url}, ID: ${bookmark.id})`);
      return true; // 成功插入新记录
    } else {
      throw new Error('数据库插入失败');
    }

  } catch (error) {
    // 如果是唯一约束冲突，说明记录已存在
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      console.log(`删除记录已存在 (唯一约束冲突): ${bookmark.url}`);
      return false;
    }
    
    console.error('插入删除记录失败:', error);
    throw error;
  }
}

/**
 * 批量插入删除记录（带去重检查）
 * @param {Object} env - Cloudflare环境对象
 * @param {Array} bookmarks - 书签数组
 * @param {Object} options - 删除选项
 * @returns {Promise<Object>} 插入结果统计
 */
export async function insertDeletedBookmarksBatch(env, bookmarks, options = {}) {
  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const bookmark of bookmarks) {
    try {
      const inserted = await insertDeletedBookmarkSafe(env, bookmark, options);
      if (inserted) {
        insertedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      errorCount++;
      errors.push({
        bookmark: bookmark.title || bookmark.url,
        error: error.message
      });
    }
  }

  return {
    total: bookmarks.length,
    inserted: insertedCount,
    skipped: skippedCount,
    errors: errorCount,
    errorDetails: errors
  };
}

/**
 * 检查删除记录是否已存在
 * @param {Object} env - Cloudflare环境对象
 * @param {string} url - 书签URL
 * @param {number} originalBookmarkId - 原始书签ID
 * @returns {Promise<boolean>} 是否已存在
 */
export async function checkDeletedRecordExists(env, url, originalBookmarkId) {
  try {
    const record = await env.BOOKMARKS_DB.prepare(`
      SELECT id FROM deleted_bookmarks 
      WHERE url = ? AND original_bookmark_id = ?
    `).bind(url, originalBookmarkId).first();
    
    return !!record;
  } catch (error) {
    console.error('检查删除记录失败:', error);
    return false;
  }
}

/**
 * 清理重复的删除记录
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Object>} 清理结果
 */
export async function cleanupDuplicateDeletedRecords(env) {
  try {
    // 查找重复记录（保留最新的）
    const duplicates = await env.BOOKMARKS_DB.prepare(`
      SELECT url, original_bookmark_id, COUNT(*) as count
      FROM deleted_bookmarks 
      GROUP BY url, original_bookmark_id 
      HAVING COUNT(*) > 1
    `).all();

    let cleanedCount = 0;

    for (const duplicate of duplicates.results || []) {
      // 获取该URL的所有记录，按删除时间排序
      const records = await env.BOOKMARKS_DB.prepare(`
        SELECT id FROM deleted_bookmarks 
        WHERE url = ? AND original_bookmark_id = ?
        ORDER BY deleted_at DESC
      `).bind(duplicate.url, duplicate.original_bookmark_id).all();

      // 保留最新的记录，删除其他的
      const recordsToDelete = (records.results || []).slice(1);
      
      for (const record of recordsToDelete) {
        await env.BOOKMARKS_DB.prepare(
          'DELETE FROM deleted_bookmarks WHERE id = ?'
        ).bind(record.id).run();
        cleanedCount++;
      }
    }

    return {
      duplicateGroups: duplicates.results?.length || 0,
      recordsCleaned: cleanedCount
    };

  } catch (error) {
    console.error('清理重复记录失败:', error);
    throw error;
  }
}
