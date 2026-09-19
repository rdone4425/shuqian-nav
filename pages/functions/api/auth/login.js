import { SignJWT } from "jose";
import { readAdminPassword } from "../../utils/admin-password.js";
import { JWTKeyManager } from "../../utils/jwt-manager.js";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
} from "../../utils/login-rate-limiter.js";
import { ResponseHelper } from "../../utils/response-helper.js";

function loginSuccess(token) {
  const user = { role: "admin" };
  const response = ResponseHelper.success({ token, user }, "Login successful.");
  const headers = new Headers(response.headers);

  return new Response(
    JSON.stringify({
      success: true,
      token,
      user,
      data: { token, user },
      message: "Login successful.",
      timestamp: new Date().toISOString(),
    }),
    {
      status: response.status,
      headers,
    },
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const rateLimit = checkLoginRateLimit(request);
    if (!rateLimit.allowed) {
      return ResponseHelper.error(
        "Too many failed login attempts. Try again later.",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds },
      );
    }

    const { password } = await request.json();
    const adminPassword = await readAdminPassword(env);

    if (!password || password !== adminPassword) {
      recordLoginFailure(request);
      return ResponseHelper.unauthorized("Incorrect password.");
    }

    recordLoginSuccess(request);

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

    return loginSuccess(token);
  } catch (error) {
    console.error("Login failed:", error);
    const isDevelopment =
      String(env?.ENVIRONMENT || "").toLowerCase() === "development";
    return ResponseHelper.serverError(
      isDevelopment ? `Login failed: ${error.message}` : "Login failed.",
    );
  }
}
