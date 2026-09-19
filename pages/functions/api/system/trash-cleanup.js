import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";
import { recordAuditLog } from "./audit-logs.js";

export const TRASH_CLEANUP_CONFIG_KEYS = Object.freeze({
  enabled: "trash_auto_cleanup_enabled",
  retentionDays: "trash_retention_days",
  lastRunAt: "trash_cleanup_last_run",
  lastDeleted: "trash_cleanup_last_deleted",
  lastSource: "trash_cleanup_last_source",
  lastError: "trash_cleanup_last_error",
});

export const TRASH_RETENTION_DAYS = Object.freeze([7, 14, 30, 90, 180, 365]);
export const DEFAULT_TRASH_RETENTION_DAYS = 30;

function toSqlTimestamp(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 19).replace("T", " ");
}

function normalizeRetentionDays(value, fallback = false) {
  const parsed = Number.parseInt(value, 10);
  if (TRASH_RETENTION_DAYS.includes(parsed)) {
    return parsed;
  }

  if (fallback) {
    return DEFAULT_TRASH_RETENTION_DAYS;
  }

  return null;
}

async function getTrashCleanupValues(env) {
  const keys = Object.values(TRASH_CLEANUP_CONFIG_KEYS);
  const placeholders = keys.map(() => "?").join(", ");
  const result = await env.BOOKMARKS_DB.prepare(
    `SELECT config_key, config_value FROM system_config WHERE config_key IN (${placeholders})`,
  )
    .bind(...keys)
    .all();

  const values = {};
  for (const record of result.results || []) {
    values[record.config_key] = record.config_value || "";
  }

  return values;
}

async function upsertTrashCleanupConfig(env, entries) {
  for (const [configKey, configValue, description] of entries) {
    const result = await env.BOOKMARKS_DB.prepare(
      `
      INSERT INTO system_config (config_key, config_value, description, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `,
    )
      .bind(configKey, configValue, description)
      .run();

    if (!result.success) {
      throw new Error(`保存 ${configKey} 失败`);
    }
  }
}

export async function getTrashCleanupConfig(env) {
  const values = await getTrashCleanupValues(env);
  const enabled = values[TRASH_CLEANUP_CONFIG_KEYS.enabled] === "true";
  const retentionDays = normalizeRetentionDays(
    values[TRASH_CLEANUP_CONFIG_KEYS.retentionDays],
    true,
  );
  const cutoff = toSqlTimestamp(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );

  const totalResult = await env.BOOKMARKS_DB.prepare(
    "SELECT COUNT(*) AS total FROM deleted_bookmarks",
  ).first();
  const eligibleResult = await env.BOOKMARKS_DB.prepare(
    "SELECT COUNT(*) AS total FROM deleted_bookmarks WHERE deleted_at < ?",
  )
    .bind(cutoff)
    .first();

  return {
    enabled,
    retentionDays,
    cutoff,
    totalDeleted: totalResult?.total || 0,
    eligibleDeleted: eligibleResult?.total || 0,
    lastRunAt: values[TRASH_CLEANUP_CONFIG_KEYS.lastRunAt] || null,
    lastDeleted:
      Number.parseInt(
        values[TRASH_CLEANUP_CONFIG_KEYS.lastDeleted] || "0",
        10,
      ) || 0,
    lastSource: values[TRASH_CLEANUP_CONFIG_KEYS.lastSource] || null,
    lastError: values[TRASH_CLEANUP_CONFIG_KEYS.lastError] || null,
  };
}

export async function runTrashCleanup(
  env,
  { force = false, source = "manual" } = {},
) {
  const values = await getTrashCleanupValues(env);
  const enabled = values[TRASH_CLEANUP_CONFIG_KEYS.enabled] === "true";

  if (!force && !enabled) {
    return {
      action: "skip",
      source,
      deleted: 0,
      reason: "disabled",
      timestamp: new Date().toISOString(),
    };
  }

  const retentionDays = normalizeRetentionDays(
    values[TRASH_CLEANUP_CONFIG_KEYS.retentionDays],
    true,
  );
  const cutoff = toSqlTimestamp(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );

  const result = await env.BOOKMARKS_DB.prepare(
    "DELETE FROM deleted_bookmarks WHERE deleted_at < ?",
  )
    .bind(cutoff)
    .run();

  if (!result.success) {
    throw new Error("回收站自动清理失败");
  }

  const deleted = result.meta?.changes ?? 0;
  const nowIso = new Date().toISOString();
  await upsertTrashCleanupConfig(env, [
    [
      TRASH_CLEANUP_CONFIG_KEYS.lastRunAt,
      nowIso,
      "Trash auto-cleanup last run at",
    ],
    [
      TRASH_CLEANUP_CONFIG_KEYS.lastDeleted,
      String(deleted),
      "Trash auto-cleanup last deleted count",
    ],
    [
      TRASH_CLEANUP_CONFIG_KEYS.lastSource,
      source,
      "Trash auto-cleanup last source",
    ],
    [TRASH_CLEANUP_CONFIG_KEYS.lastError, "", "Trash auto-cleanup last error"],
  ]);

  await recordAuditLog(env, "trash_cleanup", {
    source,
    deleted,
    retentionDays,
    cutoff,
  });

  return {
    action: "cleanup",
    source,
    deleted,
    retentionDays,
    cutoff,
    timestamp: nowIso,
  };
}

export async function saveTrashCleanupConfig(env, { enabled, retentionDays }) {
  const normalizedEnabled = Boolean(enabled);
  const normalizedRetentionDays = normalizeRetentionDays(retentionDays);

  if (!normalizedRetentionDays) {
    return {
      response: ResponseHelper.validationError(
        "保留天数无效",
        "保留天数必须是 7、14、30、90、180 或 365",
      ),
      config: null,
    };
  }

  await upsertTrashCleanupConfig(env, [
    [
      TRASH_CLEANUP_CONFIG_KEYS.enabled,
      normalizedEnabled ? "true" : "false",
      "Trash auto-cleanup enabled",
    ],
    [
      TRASH_CLEANUP_CONFIG_KEYS.retentionDays,
      String(normalizedRetentionDays),
      "Trash retention days",
    ],
  ]);

  const config = await getTrashCleanupConfig(env);
  return {
    response: ResponseHelper.success(config, "回收站清理策略已保存"),
    config,
  };
}

export async function previewTrashCleanup(env) {
  const config = await getTrashCleanupConfig(env);
  return ResponseHelper.success(
    {
      ...config,
      wouldDelete: config.eligibleDeleted,
    },
    "回收站清理预览完成",
  );
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    return ResponseHelper.success(await getTrashCleanupConfig(env));
  } catch (error) {
    console.error("Failed to load trash cleanup config:", error);
    return ResponseHelper.serverError("获取回收站清理策略失败", error.message);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || "save";

    if (action === "save") {
      const { response, config } = await saveTrashCleanupConfig(env, body);
      if (!config) {
        return response;
      }
      return response;
    }

    if (action === "preview") {
      return await previewTrashCleanup(env);
    }

    if (action === "cleanup") {
      const result = await runTrashCleanup(env, { force: true });
      return ResponseHelper.success(result, "回收站清理完成");
    }

    return ResponseHelper.validationError(
      "无效操作",
      "action 必须是 save、preview 或 cleanup",
    );
  } catch (error) {
    console.error("Failed to update trash cleanup:", error);
    return ResponseHelper.serverError("回收站清理操作失败", error.message);
  }
}
