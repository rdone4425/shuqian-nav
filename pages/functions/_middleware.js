// 全局中间件 - 处理CORS和基础安全
import { getNavVersion, renderNavPage } from "./nav/render.js";

function getHostname(value = "") {
  return String(value || "")
    .split(":")[0]
    .toLowerCase();
}

function isLocalHostname(hostname = "") {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function parseOrigin(origin) {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function addHeaders(headers, values) {
  for (const [key, value] of Object.entries(values)) {
    headers.set(key, value);
  }
}

function stripAccessControlHeaders(headers) {
  for (const key of Array.from(headers.keys())) {
    if (key.toLowerCase().startsWith("access-control-")) {
      headers.delete(key);
    }
  }
}

async function renderHome(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const noCache = url.searchParams.get("nocache") === "1";
  const version = await getNavVersion(env);
  const cache =
    typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cacheKey =
    cache && version !== "unavailable" && !noCache
      ? new Request(
          `${url.origin}/__nav_cache?version=${encodeURIComponent(version)}`,
        )
      : null;

  if (cache && cacheKey) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch (error) {
      console.warn("Nav page cache read failed:", error);
    }
  }

  const html = await renderNavPage({ env, origin: url.origin });
  const response = new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": noCache
        ? "no-store"
        : "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    },
  });

  if (cache && cacheKey) {
    const put = cache
      .put(cacheKey, response.clone())
      .catch((error) => console.warn("Nav page cache write failed:", error));

    if (typeof waitUntil === "function") {
      waitUntil(put);
    } else {
      await put;
    }
  }

  return response;
}

export async function onRequest(context) {
  const { request, next } = context;

  // 获取请求来源
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  const originUrl = parseOrigin(origin);

  // 如果是本地开发环境，允许localhost和127.0.0.1的所有端口
  const isLocalDev = isLocalHostname(getHostname(host));
  const isValidOrigin = originUrl
    ? isLocalDev
      ? isLocalHostname(originUrl.hostname)
      : originUrl.protocol === "chrome-extension:" ||
        (originUrl.protocol === "https:" && originUrl.host === host)
    : false;

  const securityHeaders = {
    // 安全头
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  // CORS 配置：只对合法跨域请求写入 CORS 头，避免和静态 _headers 叠加出非法值。
  const corsHeaders = {
    ...securityHeaders,
    Vary: "Origin",
  };

  if (origin && isValidOrigin) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Methods"] =
      "GET, POST, PUT, DELETE, OPTIONS";
    corsHeaders["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, X-API-Token";
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
    corsHeaders["Access-Control-Max-Age"] = "86400";
  }

  // 处理 OPTIONS 预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // 安全检查：拒绝可疑的请求
  const userAgent = request.headers.get("User-Agent") || "";
  const isSuspicious = userAgent.includes("curl") && !isLocalDev; // 生产环境拒绝curl请求

  if (isSuspicious) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "访问被拒绝",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  // 处理实际请求
  try {
    if (request.method === "GET") {
      const pathname = new URL(request.url).pathname;

      if (pathname === "/") {
        try {
          const rendered = await renderHome(context);
          const renderedHeaders = new Headers(rendered.headers);
          stripAccessControlHeaders(renderedHeaders);
          addHeaders(renderedHeaders, corsHeaders);

          return new Response(rendered.body, {
            status: rendered.status,
            statusText: rendered.statusText,
            headers: renderedHeaders,
          });
        } catch (error) {
          // Fall through to the static fallback page on a render failure.
          console.error("Navigation homepage render failed:", error);
        }
      }
    }

    const response = await next();
    const responseHeaders = new Headers(response.headers);
    stripAccessControlHeaders(responseHeaders);
    addHeaders(responseHeaders, corsHeaders);

    // 为所有响应添加安全头和CORS头
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    return newResponse;
  } catch (error) {
    console.error("中间件错误:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "服务器内部错误",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
}
