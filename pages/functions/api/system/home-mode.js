// Home display mode: "bookmarks" (default, full management grid) or "nav" (curated navigation)
import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const CONFIG_KEY = "home_mode";
const VALID_MODES = ["bookmarks", "nav"];

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const row = await env.BOOKMARKS_DB.prepare(
      "SELECT config_value FROM system_config WHERE config_key = ?",
    )
      .bind(CONFIG_KEY)
      .first();
    const mode =
      row && VALID_MODES.includes(row.config_value)
        ? row.config_value
        : "bookmarks";
    return ResponseHelper.success({ mode });
  } catch (error) {
    return ResponseHelper.success({ mode: "bookmarks" });
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }

  try {
    const { mode } = await request.json();
    if (!VALID_MODES.includes(mode)) {
      return ResponseHelper.validationError([
        "无效的首页模式，仅支持 bookmarks 或 nav",
      ]);
    }
    await env.BOOKMARKS_DB.prepare(
      `INSERT INTO system_config (config_key, config_value, description, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(config_key) DO UPDATE SET config_value = ?, updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(
        CONFIG_KEY,
        mode,
        "首页展示模式: bookmarks=书签管理, nav=精选导航",
        mode,
      )
      .run();
    return ResponseHelper.success({ mode }, "首页模式已更新");
  } catch (error) {
    return ResponseHelper.serverError("更新首页模式失败", error.message);
  }
}
