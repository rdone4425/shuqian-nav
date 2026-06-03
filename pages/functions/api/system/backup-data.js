import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const TABLES = [
  "system_config",
  "categories",
  "bookmarks",
  "deleted_bookmarks",
  "bookmark_visits",
];

async function requireAdminAccess(context) {
  const auth = await authenticateRequest(context.request, context.env);
  return auth.authenticated ? null : ResponseHelper.unauthorized(auth.error);
}

function getDatabase(context) {
  return context.env?.BOOKMARKS_DB || null;
}

async function tableExists(db, tableName) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .bind(tableName)
    .first();
}

export async function onRequestPost(context) {
  try {
    const blocked = await requireAdminAccess(context);
    if (blocked) {
      return blocked;
    }

    const db = getDatabase(context);
    if (!db) {
      return ResponseHelper.databaseError("Database is not configured.");
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      tables: {},
    };

    for (const tableName of TABLES) {
      try {
        const exists = await tableExists(db, tableName);
        if (!exists) {
          continue;
        }

        const schema = await db
          .prepare(`PRAGMA table_info(${tableName})`)
          .all();
        const data = await db.prepare(`SELECT * FROM ${tableName}`).all();

        backupData.tables[tableName] = {
          schema: schema.results || [],
          data: data.results || [],
          count: (data.results || []).length,
        };
      } catch (error) {
        console.error(`Failed to back up table ${tableName}:`, error);
        backupData.tables[tableName] = {
          error: error.message,
          schema: [],
          data: [],
          count: 0,
        };
      }
    }

    const totalRecords = Object.values(backupData.tables).reduce(
      (sum, table) => sum + (table.count || 0),
      0,
    );
    const payload = {
      backupData,
      totalTables: Object.keys(backupData.tables).length,
      totalRecords,
      tables: Object.keys(backupData.tables).map((name) => ({
        name,
        records: backupData.tables[name].count || 0,
        hasError: Boolean(backupData.tables[name].error),
      })),
    };

    const response = ResponseHelper.success(
      payload,
      "Database backup completed.",
    );
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="bookmark-backup-${new Date().toISOString().split("T")[0]}.json"`,
    );
    return response;
  } catch (error) {
    console.error("Database backup failed:", error);
    return ResponseHelper.serverError(
      `Database backup failed: ${error.message}`,
    );
  }
}

export async function onRequestGet(context) {
  try {
    const blocked = await requireAdminAccess(context);
    if (blocked) {
      return blocked;
    }

    const db = getDatabase(context);
    if (!db) {
      return ResponseHelper.databaseError("Database is not configured.");
    }

    const status = {
      tables: {},
      totalRecords: 0,
    };

    for (const tableName of TABLES) {
      try {
        const exists = await tableExists(db, tableName);
        if (!exists) {
          status.tables[tableName] = 0;
          continue;
        }

        const count = await db
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .first();
        const records = count?.count || 0;
        status.tables[tableName] = records;
        status.totalRecords += records;
      } catch (error) {
        console.error(`Failed to inspect table ${tableName}:`, error);
        status.tables[tableName] = -1;
      }
    }

    return ResponseHelper.success(
      {
        ...status,
        canBackup: status.totalRecords > 0,
      },
      "Database status check completed.",
    );
  } catch (error) {
    console.error("Database backup status failed:", error);
    return ResponseHelper.serverError(error.message);
  }
}
