import { jwtVerify } from "jose";
import { JWTKeyManager } from "../../utils/jwt-manager.js";
import { ResponseHelper } from "../../utils/response-helper.js";

function getBearerToken(request) {
  const header = request?.headers?.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

export async function verifyToken(request = null, env = {}) {
  const token = getBearerToken(request);
  if (!token) {
    return { valid: false, error: "缺少登录令牌。" };
  }

  try {
    const secret = await JWTKeyManager.getJWTSecret(env);
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );

    if (payload.type !== "web-session") {
      return { valid: false, error: "令牌类型无效。" };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message || "登录令牌无效。" };
  }
}

export async function authenticateRequest(request = null, env = {}) {
  const verification = await verifyToken(request, env);
  if (!verification.valid) {
    return {
      authenticated: false,
      error: verification.error || "需要登录。",
    };
  }

  return {
    authenticated: true,
    payload: verification.payload,
    user: {
      role: verification.payload.role || "admin",
      sub: verification.payload.sub || "admin",
    },
  };
}

export async function onRequestPost(context) {
  const request = context?.request ?? null;
  const env = context?.env ?? {};
  const auth = await authenticateRequest(request, env);

  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }

  return ResponseHelper.success({ user: auth.user });
}
