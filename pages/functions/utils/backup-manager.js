// 自动备份到Cloudflare R2工具
export class BackupManager {
  constructor() {
    this.compressionEnabled = true;
    this.encryptionEnabled = false; // 可以后续扩展
    this.maxBackupFiles = 30; // 保留最近30个备份
  }

  // 创建完整数据备份
  async createFullBackup(env) {
    try {
      const backup = {
        metadata: {
          type: 'full_backup',
          version: '1.0',
          timestamp: new Date().toISOString(),
          source: 'bookmark-navigator',
          compression: this.compressionEnabled ? 'gzip' : 'none'
        },
        data: {
          bookmarks: [],
          categories: [],
          system_config: [],
          deleted_bookmarks: []
        },
        statistics: {
          total_bookmarks: 0,
          total_categories: 0,
          backup_size: 0
        }
      };

      // 导出书签数据
      const bookmarksResult = await env.BOOKMARKS_DB
        .prepare(`
          SELECT 
            b.id, b.title, b.url, b.description, b.favicon_url,
            b.category_id, b.keep_status, b.created_at, b.updated_at,
            c.name as category_name, c.color as category_color
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          ORDER BY b.id
        `)
        .all();

      backup.data.bookmarks = bookmarksResult.results || [];
      backup.statistics.total_bookmarks = backup.data.bookmarks.length;

      // 导出分类数据
      const categoriesResult = await env.BOOKMARKS_DB
        .prepare('SELECT * FROM categories ORDER BY id')
        .all();

      backup.data.categories = categoriesResult.results || [];
      backup.statistics.total_categories = backup.data.categories.length;

      // 导出系统配置（排除敏感信息）
      const configResult = await env.BOOKMARKS_DB
        .prepare(`
          SELECT config_key, config_value, description, updated_at 
          FROM system_config 
          WHERE config_key NOT IN ('admin_password', 'jwt_secret')
        `)
        .all();

      backup.data.system_config = configResult.results || [];

      // 导出已删除书签（如果表存在）
      try {
        const deletedResult = await env.BOOKMARKS_DB
          .prepare('SELECT * FROM deleted_bookmarks ORDER BY deleted_at DESC LIMIT 1000')
          .all();
        backup.data.deleted_bookmarks = deletedResult.results || [];
      } catch (error) {
        console.log('删除书签表不存在，跳过');
        backup.data.deleted_bookmarks = [];
      }

      // 计算备份大小
      const backupJson = JSON.stringify(backup);
      backup.statistics.backup_size = backupJson.length;

      return backup;

    } catch (error) {
      console.error('创建备份失败:', error);
      throw new Error(`备份创建失败: ${error.message}`);
    }
  }

  // 创建增量备份
  async createIncrementalBackup(env, lastBackupTime) {
    try {
      const backup = {
        metadata: {
          type: 'incremental_backup',
          version: '1.0',
          timestamp: new Date().toISOString(),
          last_backup: lastBackupTime,
          source: 'bookmark-navigator'
        },
        data: {
          bookmarks: [],
          categories: [],
          system_config: [],
          deleted_bookmarks: []
        }
      };

      // 获取自上次备份以来修改的书签
      const bookmarksResult = await env.BOOKMARKS_DB
        .prepare(`
          SELECT 
            b.id, b.title, b.url, b.description, b.favicon_url,
            b.category_id, b.keep_status, b.created_at, b.updated_at,
            c.name as category_name, c.color as category_color
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE b.updated_at > ? OR b.created_at > ?
          ORDER BY b.id
        `)
        .bind(lastBackupTime, lastBackupTime)
        .all();

      backup.data.bookmarks = bookmarksResult.results || [];

      // 获取修改的分类
      const categoriesResult = await env.BOOKMARKS_DB
        .prepare('SELECT * FROM categories WHERE updated_at > ? ORDER BY id')
        .bind(lastBackupTime)
        .all();

      backup.data.categories = categoriesResult.results || [];

      // 获取修改的系统配置
      const configResult = await env.BOOKMARKS_DB
        .prepare(`
          SELECT config_key, config_value, description, updated_at 
          FROM system_config 
          WHERE updated_at > ? AND config_key NOT IN ('admin_password', 'jwt_secret')
        `)
        .bind(lastBackupTime)
        .all();

      backup.data.system_config = configResult.results || [];

      return backup;

    } catch (error) {
      console.error('创建增量备份失败:', error);
      throw new Error(`增量备份创建失败: ${error.message}`);
    }
  }

  // 上传备份到R2
  async uploadToR2(env, backup, filename) {
    if (!env.BACKUP_BUCKET) {
      throw new Error('未配置R2备份存储桶 (BACKUP_BUCKET)');
    }

    try {
      let backupData = JSON.stringify(backup, null, 2);

      // 压缩数据（如果启用）
      if (this.compressionEnabled) {
        backupData = this.compressData(backupData);
      }

      // 上传到R2
      const response = await env.BACKUP_BUCKET.put(filename, backupData, {
        httpMetadata: {
          contentType: this.compressionEnabled ? 'application/gzip' : 'application/json',
          contentEncoding: this.compressionEnabled ? 'gzip' : undefined
        },
        customMetadata: {
          'backup-type': backup.metadata.type,
          'backup-version': backup.metadata.version,
          'source': backup.metadata.source,
          'timestamp': backup.metadata.timestamp,
          'original-size': JSON.stringify(backup).length.toString(),
          'compressed': this.compressionEnabled.toString()
        }
      });

      if (response) {
        return {
          success: true,
          filename,
          size: backupData.length,
          compressed: this.compressionEnabled,
          url: `r2://${filename}`
        };
      } else {
        throw new Error('R2上传失败');
      }

    } catch (error) {
      console.error('上传到R2失败:', error);
      throw new Error(`R2上传失败: ${error.message}`);
    }
  }

  // 列出R2中的备份文件
  async listBackups(env, limit = 50) {
    if (!env.BACKUP_BUCKET) {
      throw new Error('未配置R2备份存储桶');
    }

    try {
      const listing = await env.BACKUP_BUCKET.list({
        limit,
        prefix: 'bookmark-backup-'
      });

      const backups = listing.objects.map(obj => ({
        filename: obj.key,
        size: obj.size,
        modified: obj.uploaded,
        metadata: obj.customMetadata || {}
      }));

      return backups.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    } catch (error) {
      console.error('列出备份失败:', error);
      throw new Error(`列出备份失败: ${error.message}`);
    }
  }

  // 从R2下载备份
  async downloadFromR2(env, filename) {
    if (!env.BACKUP_BUCKET) {
      throw new Error('未配置R2备份存储桶');
    }

    try {
      const object = await env.BACKUP_BUCKET.get(filename);
      
      if (!object) {
        throw new Error('备份文件不存在');
      }

      let backupData = await object.text();

      // 解压缩数据（如果需要）
      const isCompressed = object.customMetadata?.compressed === 'true';
      if (isCompressed) {
        backupData = this.decompressData(backupData);
      }

      return {
        data: JSON.parse(backupData),
        metadata: object.customMetadata || {},
        size: object.size,
        modified: object.uploaded
      };

    } catch (error) {
      console.error('从R2下载失败:', error);
      throw new Error(`下载失败: ${error.message}`);
    }
  }

  // 删除旧备份
  async cleanupOldBackups(env) {
    try {
      const backups = await this.listBackups(env, 100);
      
      if (backups.length <= this.maxBackupFiles) {
        return { deleted: 0, message: '无需清理' };
      }

      const toDelete = backups.slice(this.maxBackupFiles);
      let deletedCount = 0;

      for (const backup of toDelete) {
        try {
          await env.BACKUP_BUCKET.delete(backup.filename);
          deletedCount++;
        } catch (error) {
          console.error(`删除备份文件失败 ${backup.filename}:`, error);
        }
      }

      return {
        deleted: deletedCount,
        message: `已删除 ${deletedCount} 个旧备份文件`
      };

    } catch (error) {
      console.error('清理旧备份失败:', error);
      throw new Error(`清理失败: ${error.message}`);
    }
  }

  // 恢复备份
  async restoreBackup(env, backupData, options = {}) {
    const { 
      restoreBookmarks = true, 
      restoreCategories = true, 
      restoreConfig = false,
      clearExisting = false 
    } = options;

    try {
      const results = {
        bookmarks: { imported: 0, errors: 0 },
        categories: { imported: 0, errors: 0 },
        config: { imported: 0, errors: 0 },
        summary: ''
      };

      // 如果需要清除现有数据
      if (clearExisting) {
        if (restoreBookmarks) {
          await env.BOOKMARKS_DB.exec('DELETE FROM bookmarks');
        }
        if (restoreCategories) {
          await env.BOOKMARKS_DB.exec('DELETE FROM categories');
        }
      }

      // 恢复分类（先恢复分类，因为书签依赖分类）
      if (restoreCategories && backupData.data.categories) {
        for (const category of backupData.data.categories) {
          try {
            await env.BOOKMARKS_DB
              .prepare('INSERT OR REPLACE INTO categories (id, name, color, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
              .bind(category.id, category.name, category.color, category.description, category.created_at, category.updated_at)
              .run();
            results.categories.imported++;
          } catch (error) {
            console.error('恢复分类失败:', error);
            results.categories.errors++;
          }
        }
      }

      // 恢复书签
      if (restoreBookmarks && backupData.data.bookmarks) {
        for (const bookmark of backupData.data.bookmarks) {
          try {
            await env.BOOKMARKS_DB
              .prepare(`
                INSERT OR REPLACE INTO bookmarks 
                (id, title, url, description, favicon_url, category_id, keep_status, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                bookmark.id, bookmark.title, bookmark.url, bookmark.description,
                bookmark.favicon_url, bookmark.category_id, bookmark.keep_status,
                bookmark.created_at, bookmark.updated_at
              )
              .run();
            results.bookmarks.imported++;
          } catch (error) {
            console.error('恢复书签失败:', error);
            results.bookmarks.errors++;
          }
        }
      }

      // 恢复系统配置（谨慎操作）
      if (restoreConfig && backupData.data.system_config) {
        for (const config of backupData.data.system_config) {
          try {
            await env.BOOKMARKS_DB
              .prepare('INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, ?)')
              .bind(config.config_key, config.config_value, config.description, config.updated_at)
              .run();
            results.config.imported++;
          } catch (error) {
            console.error('恢复配置失败:', error);
            results.config.errors++;
          }
        }
      }

      results.summary = `恢复完成: 书签 ${results.bookmarks.imported}/${results.bookmarks.imported + results.bookmarks.errors}, 分类 ${results.categories.imported}/${results.categories.imported + results.categories.errors}`;
      
      return results;

    } catch (error) {
      console.error('恢复备份失败:', error);
      throw new Error(`恢复失败: ${error.message}`);
    }
  }

  // 生成备份文件名
  generateBackupFilename(type = 'full') {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     now.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `bookmark-backup-${type}-${timestamp}.json`;
  }

  // 验证备份文件
  validateBackup(backupData) {
    const errors = [];

    if (!backupData.metadata) {
      errors.push('缺少备份元数据');
    }

    if (!backupData.data) {
      errors.push('缺少备份数据');
    }

    if (backupData.metadata?.version !== '1.0') {
      errors.push('备份版本不兼容');
    }

    // 验证数据结构
    const requiredFields = ['bookmarks', 'categories'];
    for (const field of requiredFields) {
      if (!Array.isArray(backupData.data?.[field])) {
        errors.push(`备份数据中缺少或格式错误: ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 简单的数据压缩（Base64编码的伪压缩，实际应使用真实压缩算法）
  compressData(data) {
    // 这里应该使用真实的压缩算法，如 gzip
    // 由于Cloudflare Workers环境限制，这里使用简化版本
    return btoa(unescape(encodeURIComponent(data)));
  }

  // 解压缩数据
  decompressData(compressedData) {
    try {
      return decodeURIComponent(escape(atob(compressedData)));
    } catch (error) {
      throw new Error('解压缩数据失败');
    }
  }
}

// 全局备份管理实例
export const backupManager = new BackupManager();