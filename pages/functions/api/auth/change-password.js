import { authenticateRequest } from "./verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

async function readAdminPassword(env = {}) {
  let storedPassword = null;

  if (typeof env.BOOKMARKS_DB?.prepare === "function") {
    try {
      const row = await env.BOOKMARKS_DB.prepare(
        "SELECT config_value FROM system_config WHERE config_key = ?",
      )
        .bind("admin_password")
        .first();
      if (row?.config_value) {
        storedPassword = row.config_value;
      }
    } catch (error) {
      console.warn("Falling back to default admin password:", error.message);
    }
  }

  if (storedPassword && storedPassword !== "admin123") {
    return storedPassword;
  }

  if (env.ADMIN_PASSWORD) {
    return env.ADMIN_PASSWORD;
  }

  return storedPassword || "admin123";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }

  const { currentPassword, newPassword } = await request.json();
  const adminPassword = await readAdminPassword(env);

  if (!currentPassword || currentPassword !== adminPassword) {
    return ResponseHelper.error("当前密码不正确。", 400);
  }

  if (!newPassword || newPassword.length < 6) {
    return ResponseHelper.error("新密码至少需要 6 位。", 400);
  }

  if (typeof env.BOOKMARKS_DB?.prepare !== "function") {
    return ResponseHelper.error("数据库不可用，无法修改密码。", 500);
  }

  await env.BOOKMARKS_DB.prepare(
    "INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
  )
    .bind("admin_password", newPassword, "Administrator password")
    .run();

  return ResponseHelper.success(null, "密码已更新。");
}
