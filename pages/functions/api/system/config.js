import { authenticateRequest } from "../auth/verify.js";

const CONFIG_DESCRIPTIONS = {
  ai_api_endpoint: "AI endpoint URL. Falls back to AI_API_ENDPOINT when empty.",
  ai_model: "Default AI model. Falls back to AI_MODEL when empty.",
};

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Admin access is required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const configs = await env.BOOKMARKS_DB.prepare(
      "SELECT config_key, config_value, description, created_at, updated_at FROM system_config ORDER BY config_key",
    ).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: configs.results || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Failed to read system config:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to read system config",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Admin access is required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { config_key, config_value } = await request.json();
    if (!config_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing config key",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const normalizedValue =
      typeof config_value === "string"
        ? config_value
        : config_value === null || config_value === undefined
          ? ""
          : String(config_value);

    const existing = await env.BOOKMARKS_DB.prepare(
      "SELECT description FROM system_config WHERE config_key = ?",
    )
      .bind(config_key)
      .first();

    const description =
      existing?.description ?? CONFIG_DESCRIPTIONS[config_key] ?? "";

    await env.BOOKMARKS_DB.prepare(
      `
        INSERT INTO system_config (config_key, config_value, description, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(config_key) DO UPDATE SET
          config_value = excluded.config_value,
          description = excluded.description,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
      .bind(config_key, normalizedValue, description)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Config saved",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Failed to save system config:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to save system config",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
