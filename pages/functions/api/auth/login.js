import { SignJWT } from "jose";
import { JWTKeyManager } from "../../utils/jwt-manager.js";

const DEFAULT_ADMIN_PASSWORD = "admin123";

async function resolveAdminPassword(env) {
  if (env?.ADMIN_PASSWORD) {
    return {
      password: env.ADMIN_PASSWORD,
      source: "environment",
      canChangePassword: false,
    };
  }

  if (typeof env?.BOOKMARKS_DB?.prepare !== "function") {
    console.warn(
      "BOOKMARKS_DB binding is missing during login. Falling back to the default admin password.",
    );
    return {
      password: DEFAULT_ADMIN_PASSWORD,
      source: "fallback",
      canChangePassword: false,
      warning: "database_binding_missing",
    };
  }

  try {
    const configResult = await env.BOOKMARKS_DB.prepare(
      "SELECT config_value FROM system_config WHERE config_key = ?",
    )
      .bind("admin_password")
      .first();

    return {
      password: configResult?.config_value || DEFAULT_ADMIN_PASSWORD,
      source: "database",
      canChangePassword: true,
    };
  } catch (error) {
    console.error("Failed to read admin password from D1:", error);
    return {
      password: DEFAULT_ADMIN_PASSWORD,
      source: "fallback",
      canChangePassword: false,
      warning: "database_unavailable",
    };
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();
    const jwtSecret = await JWTKeyManager.getJWTSecret(env);
    const passwordInfo = await resolveAdminPassword(env);
    const correctPassword = passwordInfo.password;
    const isDefaultPassword = correctPassword === DEFAULT_ADMIN_PASSWORD;

    if (!password || password !== correctPassword) {
      return jsonResponse(
        {
          success: false,
          error: "Password is incorrect.",
          passwordSource: passwordInfo.source,
          isDefaultPassword,
        },
        401,
      );
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      sub: "admin",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      passwordSource: passwordInfo.source,
      isDefaultPassword,
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    return jsonResponse(
      {
        success: true,
        token,
        message: isDefaultPassword
          ? "Login succeeded. Change the default password as soon as possible."
          : "Login succeeded.",
        passwordSource: passwordInfo.source,
        isDefaultPassword,
        canChangePassword: passwordInfo.canChangePassword,
        jwtSource: env?.JWT_SECRET ? "environment" : "runtime",
        warning: passwordInfo.warning || null,
      },
      200,
    );
  } catch (error) {
    console.error("Login error:", error);
    return jsonResponse(
      {
        success: false,
        error: "Login failed.",
        details: "The server could not complete the login request.",
      },
      500,
    );
  }
}
