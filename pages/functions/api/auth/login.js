import { SignJWT } from "jose";
import { JWTKeyManager } from "../../utils/jwt-manager.js";
import { ResponseHelper } from "../../utils/response-helper.js";

const DEFAULT_ADMIN_PASSWORD = "admin123";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();

    let jwtSecret;
    try {
      jwtSecret = await JWTKeyManager.getJWTSecret(env);
    } catch (error) {
      console.error("Failed to resolve JWT secret:", error);
      return ResponseHelper.serverError(
        "系统初始化失败",
        "无法获取或生成 JWT 密钥",
      );
    }

    let correctPassword = DEFAULT_ADMIN_PASSWORD;
    let passwordSource = "database";

    if (env.ADMIN_PASSWORD) {
      correctPassword = env.ADMIN_PASSWORD;
      passwordSource = "environment";
    } else {
      try {
        const configResult = await env.BOOKMARKS_DB.prepare(
          "SELECT config_value FROM system_config WHERE config_key = ?",
        )
          .bind("admin_password")
          .first();

        correctPassword = configResult?.config_value || DEFAULT_ADMIN_PASSWORD;
      } catch (dbError) {
        console.error("Failed to read admin password from D1:", dbError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "数据库连接失败",
            details: "无法验证身份，请检查数据库配置",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    if (!password || password !== correctPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "密码错误",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const isDefaultPassword = correctPassword === DEFAULT_ADMIN_PASSWORD;
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      sub: "admin",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      passwordSource,
      isDefaultPassword,
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        message: isDefaultPassword
          ? "登录成功，建议尽快修改默认密码"
          : "登录成功",
        passwordSource,
        isDefaultPassword,
        canChangePassword: passwordSource === "database",
        jwtSource: env.JWT_SECRET ? "environment" : "database",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "登录失败",
        details: "服务器内部错误",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
