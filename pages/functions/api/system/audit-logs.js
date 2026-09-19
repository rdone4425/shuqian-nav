import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

export async function recordAuditLog(env, action, details = {}) {
  if (!env?.BOOKMARKS_DB || !action) {
    return false;
  }

  const key = `audit_log_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const value = JSON.stringify({
    action,
    details,
    loggedAt: new Date().toISOString(),
  });

  const result = await env.BOOKMARKS_DB.prepare(
    `INSERT INTO system_config (config_key, config_value, description)
     VALUES (?, ?, ?)`,
  )
    .bind(key, value, `Audit log: ${action}`)
    .run();

  return Boolean(result?.success);
}

export async function getAuditLogs(env, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const result = await env.BOOKMARKS_DB.prepare(
    `SELECT config_key, config_value, description, created_at
     FROM system_config
     WHERE config_key LIKE ?
     ORDER BY config_key DESC
     LIMIT ?`,
  )
    .bind("audit_log_%", safeLimit)
    .all();

  return (result.results || [])
    .map((record) => {
      try {
        const data = JSON.parse(record.config_value);
        return {
          id: record.config_key,
          ...data,
          createdAt: record.created_at,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || 50;
    const logs = await getAuditLogs(env, limit);
    return ResponseHelper.success(logs);
  } catch (error) {
    console.error("Failed to load audit logs:", error);
    return ResponseHelper.serverError("获取操作日志失败", error.message);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const { action, details = {} } = await request.json();
    if (!action) {
      return ResponseHelper.validationError("action 是必填的");
    }

    const recorded = await recordAuditLog(env, action, details);
    return ResponseHelper.success({ recorded });
  } catch (error) {
    console.error("Failed to record audit log:", error);
    return ResponseHelper.serverError("记录操作日志失败", error.message);
  }
}
