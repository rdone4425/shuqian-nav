import { authenticateRequest } from "./verify.js";
import {
  readAdminPassword,
  updateAdminPassword,
} from "../../utils/admin-password.js";
import { ResponseHelper } from "../../utils/response-helper.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }

  const { currentPassword, newPassword } = await request.json();
  const adminPassword = await readAdminPassword(env);

  if (!currentPassword || currentPassword !== adminPassword) {
    return ResponseHelper.error("当前密码不正确。", 400);
  }

  if (!newPassword || newPassword.length < 6) {
    return ResponseHelper.error("新密码至少需要 6 位。", 400);
  }

  if (typeof env.BOOKMARKS_DB?.prepare !== "function") {
    return ResponseHelper.error("数据库不可用，无法修改密码。", 500);
  }

  await updateAdminPassword(env, newPassword);

  return ResponseHelper.success(null, "密码已更新。");
}
