// 绯荤粺閰嶇疆API
import { authenticateRequest } from "../auth/verify.js";

const CONFIG_DESCRIPTIONS = {
  ai_api_endpoint: "AI 鎺ュ彛鍦板潃锛岃┍鍔ㄩ噸鍐?ENV 閰嶇疆",
  ai_model: "AI 妯″潡鍚嶇О锛岃嫢涓虹┖鍒欐敮鎸乶NV 鍙傛暟",
};

// 鑾峰彇绯荤粺閰嶇疆
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // 楠岃瘉绠＄悊鍛樻潈闄?
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "闇€瑕佺鐞嗗憳鏉冮檺",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 鑾峰彇绯荤粺閰嶇疆
    const configs = await env.BOOKMARKS_DB.prepare(
      "SELECT config_key, config_value, description FROM system_config ORDER BY config_key",
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
    console.error("鑾峰彇绯荤粺閰嶇疆澶辫触:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "鑾峰彇绯荤粺閰嶇疆澶辫触",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// 鏇存柊绯荤粺閰嶇疆
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 楠岃瘉绠＄悊鍛樻潈闄?
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "闇€瑕佺鐞嗗憳鏉冮檺",
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
          error: "閰嶇疆閿笉鑳戒负绌?",
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
        message: "閰嶇疆鏇存柊鎴愬姛",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("鏇存柊绯荤粺閰嶇疆澶辫触:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "鏇存柊绯荤粺閰嶇疆澶辫触",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
