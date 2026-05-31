import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";
import {
  getMissingCoreTables,
  initializeDatabase,
} from "../../utils/schema-manager.js";

function canInitialize(env = {}) {
  const environment = String(env.ENVIRONMENT || "").toLowerCase();
  return environment === "development" || environment === "test";
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!canInitialize(env)) {
      return ResponseHelper.forbidden(
        "数据库初始化只允许在开发或测试环境执行。",
      );
    }

    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    if (typeof env.BOOKMARKS_DB?.prepare !== "function") {
      return ResponseHelper.serverError("BOOKMARKS_DB binding is missing.");
    }

    await initializeDatabase(env.BOOKMARKS_DB);
    const missingTables = await getMissingCoreTables(env.BOOKMARKS_DB);

    if (missingTables.length) {
      return ResponseHelper.serverError("数据库初始化未完成。", {
        missingTables,
      });
    }

    return ResponseHelper.success(
      { initialized: true, missingTables },
      "数据库初始化完成。",
    );
  } catch (error) {
    console.error("Database initialization failed:", error);
    return ResponseHelper.serverError("数据库初始化失败。", error.message);
  }
}
