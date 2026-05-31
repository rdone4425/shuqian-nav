import { SignJWT } from "jose";
import { JWTKeyManager } from "../../utils/jwt-manager.js";

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();
    const adminPassword = await readAdminPassword(env);

    if (!password || password !== adminPassword) {
      return json({ success: false, error: "密码不正确。" }, 401);
    }

    const secret = await JWTKeyManager.getJWTSecret(env);
    const key = new TextEncoder().encode(secret);
    const token = await new SignJWT({
      role: "admin",
      type: "web-session",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(key);

    return json({
      success: true,
      token,
      user: { role: "admin" },
      message: "登录成功。",
    });
  } catch (error) {
    console.error("Login failed:", error);
    const isDevelopment =
      String(env?.ENVIRONMENT || "").toLowerCase() === "development";
    return json(
      {
        success: false,
        error: isDevelopment ? `登录失败：${error.message}` : "登录失败。",
      },
      500,
    );
  }
}
