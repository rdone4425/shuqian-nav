import { authenticateRequest } from "./verify.js";

async function readAdminPassword(env = {}) {
  if (env.ADMIN_PASSWORD) {
    return env.ADMIN_PASSWORD;
  }

  if (typeof env.BOOKMARKS_DB?.prepare === "function") {
    try {
      const row = await env.BOOKMARKS_DB.prepare(
        "SELECT config_value FROM system_config WHERE config_key = ?",
      )
        .bind("admin_password")
        .first();
      if (row?.config_value) {
        return row.config_value;
      }
    } catch (error) {
      console.warn("Falling back to default admin password:", error.message);
    }
  }

  return "admin123";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return json({ success: false, error: auth.error }, 401);
  }

  const { currentPassword, newPassword } = await request.json();
  const adminPassword = await readAdminPassword(env);

  if (!currentPassword || currentPassword !== adminPassword) {
    return json({ success: false, error: "当前密码不正确。" }, 400);
  }

  if (!newPassword || newPassword.length < 6) {
    return json({ success: false, error: "新密码至少需要 6 位。" }, 400);
  }

  if (env.ADMIN_PASSWORD) {
    return json(
      {
        success: false,
        error: "当前密码来自环境变量 ADMIN_PASSWORD，请在部署配置中修改。",
      },
      409,
    );
  }

  if (typeof env.BOOKMARKS_DB?.prepare !== "function") {
    return json({ success: false, error: "数据库不可用，无法修改密码。" }, 500);
  }

  await env.BOOKMARKS_DB.prepare(
    "INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
  )
    .bind("admin_password", newPassword, "Administrator password")
    .run();

  return json({ success: true, message: "密码已更新。" });
}
