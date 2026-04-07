import { jwtVerify } from "jose";
import { JWTKeyManager } from "../../utils/jwt-manager.js";

const DEFAULT_ADMIN_PASSWORD = "admin123";

function hasDatabaseBinding(env) {
  return typeof env?.BOOKMARKS_DB?.prepare === "function";
}

export async function verifyToken(token, env) {
  try {
    const secret = await JWTKeyManager.getJWTSecret(env);
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function resolveAdminPassword(env) {
  if (env?.ADMIN_PASSWORD) {
    return env.ADMIN_PASSWORD;
  }

  if (!hasDatabaseBinding(env)) {
    return DEFAULT_ADMIN_PASSWORD;
  }

  try {
    const configResult = await env.BOOKMARKS_DB.prepare(
      "SELECT config_value FROM system_config WHERE config_key = ?",
    )
      .bind("admin_password")
      .first();

    return configResult?.config_value || DEFAULT_ADMIN_PASSWORD;
  } catch (error) {
    console.error("Failed to read admin password from D1:", error);
    return DEFAULT_ADMIN_PASSWORD;
  }
}

export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get("Authorization");
  let token = authHeader?.replace("Bearer ", "");

  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get("token");

    if (!token) {
      const password = url.searchParams.get("password");
      if (password) {
        const adminPassword = await resolveAdminPassword(env);
        if (password === adminPassword) {
          return {
            authenticated: true,
            payload: { sub: "admin", type: "password-auth" },
          };
        }

        return { authenticated: false, error: "Password is incorrect." };
      }
    }
  }

  if (!token) {
    return { authenticated: false, error: "Missing authentication token." };
  }

  const verification = await verifyToken(token, env);
  if (!verification.valid) {
    return { authenticated: false, error: "Authentication token is invalid." };
  }

  return { authenticated: true, payload: verification.payload };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: auth.error,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Authentication token is valid.",
        user: auth.payload,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Verify error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Token verification failed.",
        details: "The server could not verify the authentication token.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
