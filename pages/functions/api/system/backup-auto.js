import { authenticateRequest } from "../auth/verify.js";
import { backupManager } from "../../utils/backup-manager.js";
import { ResponseHelper } from "../../utils/response-helper.js";

async function requireAdminAccess(request, env) {
  const auth = await authenticateRequest(request, env);
  return auth.authenticated ? null : ResponseHelper.unauthorized(auth.error);
}

function withDownloadHeader(response, filename) {
  const headers = new Headers(response.headers);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const {
      type = "full",
      uploadToR2 = true,
      lastBackupTime = null,
      autoCleanup = true,
    } = await request.json();

    const isIncremental = type === "incremental" && lastBackupTime;
    const backup = isIncremental
      ? await backupManager.createIncrementalBackup(env, lastBackupTime)
      : await backupManager.createFullBackup(env);
    const filename = backupManager.generateBackupFilename(
      isIncremental ? "incremental" : "full",
    );

    const result = {
      backup: {
        type: backup.metadata.type,
        timestamp: backup.metadata.timestamp,
        statistics: backup.statistics,
      },
      filename,
      local: true,
      r2: false,
    };

    if (uploadToR2) {
      try {
        result.r2 = await backupManager.uploadToR2(env, backup, filename);

        if (autoCleanup) {
          result.cleanup = await backupManager.cleanupOldBackups(env);
        }
      } catch (error) {
        console.error(
          "R2 backup upload failed, local backup is available:",
          error,
        );
        result.r2Error = error.message;
      }
    }

    if (!uploadToR2 || !result.r2) {
      result.backupData = backup;
    }

    const response = ResponseHelper.success(
      result,
      "Backup created successfully.",
    );

    return uploadToR2 ? response : withDownloadHeader(response, filename);
  } catch (error) {
    console.error("Failed to create backup:", error);
    return ResponseHelper.serverError(
      "Failed to create backup.",
      error.message,
    );
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "list";

    switch (action) {
      case "list": {
        let backups = [];
        let r2Available = false;

        try {
          backups = await backupManager.listBackups(env);
          r2Available = true;
        } catch (error) {
          console.warn("Unable to access R2 backups:", error.message);
        }

        return ResponseHelper.success({
          backups,
          r2Available,
          totalBackups: backups.length,
          oldestBackup:
            backups.length > 0 ? backups[backups.length - 1].modified : null,
          newestBackup: backups.length > 0 ? backups[0].modified : null,
        });
      }

      case "download": {
        const filename = url.searchParams.get("filename");
        if (!filename) {
          return ResponseHelper.validationError(
            "filename is required",
            "Missing filename parameter.",
          );
        }

        const backup = await backupManager.downloadFromR2(env, filename);
        return withDownloadHeader(
          ResponseHelper.success({
            backup: backup.data,
            metadata: backup.metadata,
          }),
          filename,
        );
      }

      case "status": {
        const status = {
          r2Configured: !!env.BACKUP_BUCKET,
          compressionEnabled: backupManager.compressionEnabled,
          maxBackupFiles: backupManager.maxBackupFiles,
          lastBackupCheck: new Date().toISOString(),
        };

        try {
          status.databaseStats = await env.BOOKMARKS_DB.prepare(
            `
              SELECT
                (SELECT COUNT(*) FROM bookmarks) as total_bookmarks,
                (SELECT COUNT(*) FROM categories) as total_categories,
                (SELECT COUNT(*) FROM system_config) as total_configs
            `,
          ).first();
        } catch {
          status.databaseStats = { error: "Unable to load database stats." };
        }

        return ResponseHelper.success(status);
      }

      default:
        return ResponseHelper.validationError(
          `Unsupported backup action: ${action}`,
          "Unsupported backup action.",
        );
    }
  } catch (error) {
    console.error("Backup operation failed:", error);
    return ResponseHelper.serverError(
      "Backup operation failed.",
      error.message,
    );
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const { source, filename, backupData, options = {} } = await request.json();

    let backup;
    if (source === "r2" && filename) {
      const downloadResult = await backupManager.downloadFromR2(env, filename);
      backup = downloadResult.data;
    } else if (source === "upload" && backupData) {
      backup = backupData;
    } else {
      return ResponseHelper.validationError(
        "source and backup data are required",
        "Missing backup source or data.",
      );
    }

    const validation = backupManager.validateBackup(backup);
    if (!validation.valid) {
      return ResponseHelper.validationError(
        validation.errors,
        "Backup data validation failed.",
      );
    }

    const restoreResult = await backupManager.restoreBackup(
      env,
      backup,
      options,
    );

    return ResponseHelper.success(
      restoreResult,
      "Backup restored successfully.",
    );
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return ResponseHelper.serverError(
      "Failed to restore backup.",
      error.message,
    );
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const blocked = await requireAdminAccess(request, env);
    if (blocked) return blocked;

    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const action = url.searchParams.get("action") || "single";

    if (action === "cleanup") {
      const cleanupResult = await backupManager.cleanupOldBackups(env);
      return ResponseHelper.success(cleanupResult, "Backup cleanup completed.");
    }

    if (action === "single" && filename) {
      await env.BACKUP_BUCKET.delete(filename);
      return ResponseHelper.success(null, "Backup file deleted successfully.");
    }

    return ResponseHelper.validationError(
      "filename is required for single backup deletion",
      "Missing required backup parameters.",
    );
  } catch (error) {
    console.error("Failed to delete backup:", error);
    return ResponseHelper.serverError(
      "Failed to delete backup.",
      error.message,
    );
  }
}
