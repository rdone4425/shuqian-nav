function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Token",
  };
}

function hasDatabaseBinding(env) {
  return typeof env?.BOOKMARKS_DB?.prepare === "function";
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    let dbStatus = "missing";
    let dbError = null;

    if (hasDatabaseBinding(env)) {
      try {
        const result =
          await env.BOOKMARKS_DB.prepare("SELECT 1 as test").first();
        dbStatus = result ? "connected" : "error";
      } catch (error) {
        dbStatus = "error";
        dbError = error.message;
      }
    } else {
      dbError = "BOOKMARKS_DB binding is missing.";
    }

    const healthData = {
      success: true,
      status: dbStatus === "connected" ? "healthy" : "warning",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      database: {
        status: dbStatus,
        error: dbError,
      },
      config: {
        adminPassword: Boolean(env?.ADMIN_PASSWORD),
        jwtSecret: Boolean(env?.JWT_SECRET),
        database: hasDatabaseBinding(env),
      },
      environment: env?.ENVIRONMENT || "development",
    };

    if (dbStatus !== "connected") {
      healthData.message =
        dbStatus === "missing"
          ? "Database binding is missing."
          : "Database connectivity check failed.";
    }

    return new Response(JSON.stringify(healthData), {
      status: dbStatus === "connected" ? 200 : 503,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("Health check error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Health check failed.",
        message: error.message,
      }),
      {
        status: 500,
        headers: corsHeaders(),
      },
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Token",
      "Access-Control-Max-Age": "86400",
    },
  });
}
