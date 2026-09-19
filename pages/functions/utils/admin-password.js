const DEFAULT_ADMIN_PASSWORD = "admin123";

export async function readAdminPassword(env = {}) {
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
      console.warn("Falling back to the configured admin password:", error);
    }
  }

  if (storedPassword && storedPassword !== DEFAULT_ADMIN_PASSWORD) {
    return storedPassword;
  }

  if (env.ADMIN_PASSWORD) {
    return env.ADMIN_PASSWORD;
  }

  return storedPassword || DEFAULT_ADMIN_PASSWORD;
}

export async function updateAdminPassword(env, newPassword) {
  await env.BOOKMARKS_DB.prepare(
    "INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
  )
    .bind("admin_password", newPassword, "Administrator password")
    .run();
}
