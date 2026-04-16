import { SignJWT, jwtVerify } from "jose";
import { authenticateRequest } from "./verify.js";

function isTokenManagementEnabled(env = {}) {
  return env.PUBLIC_API_TOKEN_MANAGEMENT === "enabled";
}

function createJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createDisabledResponse() {
  return createJsonResponse(
    {
      success: false,
      error:
        "API token management is disabled in public mode. Set PUBLIC_API_TOKEN_MANAGEMENT=enabled to manage tokens from the web UI.",
    },
    403,
  );
}

async function ensureTokenManagement(context) {
  const { request, env } = context;

  if (!isTokenManagementEnabled(env)) {
    return createDisabledResponse();
  }

  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return createJsonResponse(
      {
        success: false,
        error: "Administrator access is required.",
      },
      401,
    );
  }

  if (!env.BOOKMARKS_DB) {
    return createJsonResponse(
      {
        success: false,
        error: "BOOKMARKS_DB binding is missing.",
      },
      503,
    );
  }

  return null;
}

export async function onRequestPost(context) {
  const guardResponse = await ensureTokenManagement(context);
  if (guardResponse) {
    return guardResponse;
  }

  const { request, env } = context;

  try {
    const requestData = await request.json();

    if (requestData.action === "delete") {
      return await handleDeleteToken(requestData, env);
    }

    const { name, description, expiresIn } = requestData;

    if (!name) {
      return createJsonResponse(
        {
          success: false,
          error: "Token name is required.",
        },
        400,
      );
    }

    const expireDays = expiresIn || 30;
    const expirationTime =
      Math.floor(Date.now() / 1000) + expireDays * 24 * 60 * 60;

    const secret = new TextEncoder().encode(
      env.JWT_SECRET || "default-secret-key",
    );
    const token = await new SignJWT({
      sub: "api-access",
      type: "api-token",
      name,
      description: description || "",
      iat: Math.floor(Date.now() / 1000),
      exp: expirationTime,
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    try {
      await env.BOOKMARKS_DB.prepare(
        "INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)",
      )
        .bind(
          `api_token_${Date.now()}`,
          JSON.stringify({
            name,
            description: description || "",
            created: new Date().toISOString(),
            expires: new Date(expirationTime * 1000).toISOString(),
          }),
          `API token: ${name}`,
        )
        .run();
    } catch (dbError) {
      console.error("Failed to persist API token metadata:", dbError);
    }

    return createJsonResponse({
      success: true,
      data: {
        token,
        name,
        description: description || "",
        expiresAt: new Date(expirationTime * 1000).toISOString(),
        expiresIn: `${expireDays} days`,
      },
      message: "API token created successfully.",
    });
  } catch (error) {
    console.error("Failed to create API token:", error);
    return createJsonResponse(
      {
        success: false,
        error: "Failed to create API token.",
        message: error.message,
      },
      500,
    );
  }
}

export async function verifyApiToken(token, env) {
  try {
    const secret = new TextEncoder().encode(
      env.JWT_SECRET || "default-secret-key",
    );
    const { payload } = await jwtVerify(token, secret);

    if (payload.type !== "api-token") {
      return { valid: false, error: "Invalid token type." };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export async function onRequestGet(context) {
  const guardResponse = await ensureTokenManagement(context);
  if (guardResponse) {
    return guardResponse;
  }

  const { env } = context;

  try {
    const tokens = await env.BOOKMARKS_DB.prepare(
      "SELECT config_key, config_value, description, created_at FROM system_config WHERE config_key LIKE 'api_token_%' ORDER BY created_at DESC",
    ).all();

    const tokenList = tokens.results
      .map((row) => {
        try {
          const tokenInfo = JSON.parse(row.config_value);
          return {
            id: row.config_key,
            name: tokenInfo.name,
            description: tokenInfo.description,
            created: tokenInfo.created,
            expires: tokenInfo.expires,
            createdAt: row.created_at,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return createJsonResponse({
      success: true,
      data: tokenList,
    });
  } catch (error) {
    console.error("Failed to load API token metadata:", error);
    return createJsonResponse(
      {
        success: false,
        error: "Failed to load API token metadata.",
        message: error.message,
      },
      500,
    );
  }
}

async function handleDeleteToken(requestData, env) {
  try {
    const { tokenId } = requestData;

    if (!tokenId) {
      return createJsonResponse(
        {
          success: false,
          error: "Token ID is required.",
        },
        400,
      );
    }

    if (!tokenId.startsWith("api_token_")) {
      return createJsonResponse(
        {
          success: false,
          error: "Invalid token ID.",
        },
        400,
      );
    }

    const tokenInfo = await env.BOOKMARKS_DB.prepare(
      "SELECT config_value FROM system_config WHERE config_key = ?",
    )
      .bind(tokenId)
      .first();

    if (!tokenInfo) {
      return createJsonResponse(
        {
          success: false,
          error: "Token not found.",
        },
        404,
      );
    }

    const result = await env.BOOKMARKS_DB.prepare(
      "DELETE FROM system_config WHERE config_key = ?",
    )
      .bind(tokenId)
      .run();

    if (result.changes === 0) {
      return createJsonResponse(
        {
          success: false,
          error: "Token could not be deleted because it no longer exists.",
        },
        404,
      );
    }

    let deletedTokenName = "Unknown";
    try {
      const parsedInfo = JSON.parse(tokenInfo.config_value);
      deletedTokenName = parsedInfo.name || "Unknown";
    } catch (error) {
      console.warn("Failed to parse deleted token metadata:", error);
    }

    return createJsonResponse({
      success: true,
      message: `API token "${deletedTokenName}" deleted successfully.`,
      data: {
        deletedTokenId: tokenId,
        deletedTokenName,
      },
    });
  } catch (error) {
    console.error("Failed to delete API token:", error);
    return createJsonResponse(
      {
        success: false,
        error: "Failed to delete API token.",
        message: error.message,
      },
      500,
    );
  }
}
