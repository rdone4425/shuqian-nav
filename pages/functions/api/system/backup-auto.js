// 自动备份API端点
import { authenticateRequest } from '../auth/verify.js';
import { backupManager } from '../../utils/backup-manager.js';

// 创建备份
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { 
      type = 'full', 
      uploadToR2 = true, 
      lastBackupTime = null,
      autoCleanup = true 
    } = await request.json();

    let backup;
    let filename;

    // 创建备份
    if (type === 'incremental' && lastBackupTime) {
      backup = await backupManager.createIncrementalBackup(env, lastBackupTime);
      filename = backupManager.generateBackupFilename('incremental');
    } else {
      backup = await backupManager.createFullBackup(env);
      filename = backupManager.generateBackupFilename('full');
    }

    const result = {
      backup: {
        type: backup.metadata.type,
        timestamp: backup.metadata.timestamp,
        statistics: backup.statistics
      },
      filename,
      local: true,
      r2: false
    };

    // 上传到R2（如果配置且请求）
    if (uploadToR2) {
      try {
        const uploadResult = await backupManager.uploadToR2(env, backup, filename);
        result.r2 = uploadResult;
        
        // 自动清理旧备份
        if (autoCleanup) {
          const cleanupResult = await backupManager.cleanupOldBackups(env);
          result.cleanup = cleanupResult;
        }
      } catch (error) {
        console.error('R2上传失败，但本地备份成功:', error);
        result.r2Error = error.message;
      }
    }

    // 如果不上传到R2，直接返回备份数据
    if (!uploadToR2 || !result.r2) {
      result.backupData = backup;
    }

    return new Response(JSON.stringify({
      success: true,
      message: '备份创建成功',
      data: result
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': uploadToR2 ? undefined : `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('创建备份失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '创建备份失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取备份列表和状态
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';

    switch (action) {
      case 'list':
        // 列出R2中的备份文件
        let backups = [];
        let r2Available = false;
        
        try {
          backups = await backupManager.listBackups(env);
          r2Available = true;
        } catch (error) {
          console.warn('无法访问R2备份:', error.message);
        }

        return new Response(JSON.stringify({
          success: true,
          data: {
            backups,
            r2Available,
            totalBackups: backups.length,
            oldestBackup: backups.length > 0 ? backups[backups.length - 1].modified : null,
            newestBackup: backups.length > 0 ? backups[0].modified : null
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'download':
        // 下载指定备份文件
        const filename = url.searchParams.get('filename');
        if (!filename) {
          return new Response(JSON.stringify({
            success: false,
            error: '缺少filename参数'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const backup = await backupManager.downloadFromR2(env, filename);
        return new Response(JSON.stringify({
          success: true,
          data: backup.data,
          metadata: backup.metadata
        }), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });

      case 'status':
        // 获取备份系统状态
        const status = {
          r2Configured: !!env.BACKUP_BUCKET,
          compressionEnabled: backupManager.compressionEnabled,
          maxBackupFiles: backupManager.maxBackupFiles,
          lastBackupCheck: new Date().toISOString()
        };

        // 获取数据库统计
        try {
          const stats = await env.BOOKMARKS_DB
            .prepare(`
              SELECT 
                (SELECT COUNT(*) FROM bookmarks) as total_bookmarks,
                (SELECT COUNT(*) FROM categories) as total_categories,
                (SELECT COUNT(*) FROM system_config) as total_configs
            `)
            .first();
          status.databaseStats = stats;
        } catch (error) {
          status.databaseStats = { error: '无法获取数据库统计' };
        }

        return new Response(JSON.stringify({
          success: true,
          data: status
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          error: '不支持的操作'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('备份操作失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '备份操作失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 恢复备份
export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { 
      source, 
      filename, 
      backupData,
      options = {} 
    } = await request.json();

    let backup;

    if (source === 'r2' && filename) {
      // 从R2恢复
      const downloadResult = await backupManager.downloadFromR2(env, filename);
      backup = downloadResult.data;
    } else if (source === 'upload' && backupData) {
      // 从上传的数据恢复
      backup = backupData;
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少备份源或数据'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证备份数据
    const validation = backupManager.validateBackup(backup);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: '备份数据验证失败',
        details: validation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 执行恢复
    const restoreResult = await backupManager.restoreBackup(env, backup, options);

    return new Response(JSON.stringify({
      success: true,
      message: '数据恢复成功',
      data: restoreResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('恢复备份失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '恢复备份失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 删除备份
export async function onRequestDelete(context) {
  const { request, env } = context;
  
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    const action = url.searchParams.get('action') || 'single';

    if (action === 'cleanup') {
      // 清理旧备份
      const cleanupResult = await backupManager.cleanupOldBackups(env);
      return new Response(JSON.stringify({
        success: true,
        message: '清理完成',
        data: cleanupResult
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'single' && filename) {
      // 删除单个备份文件
      await env.BACKUP_BUCKET.delete(filename);
      return new Response(JSON.stringify({
        success: true,
        message: '备份文件删除成功'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('删除备份失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除备份失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}