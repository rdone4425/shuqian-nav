const LOCAL_HOST_PATTERNS = ["localhost", "127.0.0.1", "::1"];

function isLocalOrigin(value = "") {
  return LOCAL_HOST_PATTERNS.some((pattern) => value.includes(pattern));
}

function isLocalDevelopment(request, env = {}) {
  if (env.ALLOW_PUBLIC_WRITE === "enabled") {
    return true;
  }

  const environment = String(env.ENVIRONMENT || "").toLowerCase();
  if (["development", "local", "dev", "test"].includes(environment)) {
    return true;
  }

  if (!request) {
    return false;
  }

  try {
    const url = new URL(request.url);
    if (isLocalOrigin(url.hostname)) {
      return true;
    }
  } catch {}

  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const host = request.headers.get("Host") || "";

  return [origin, referer, host].some((value) => isLocalOrigin(value));
}

function buildPublicPayload(mode) {
  return {
    sub: mode === "local-dev" ? "local-dev" : "public",
    mode,
    role: mode === "local-dev" ? "admin" : "public",
  };
}

export async function verifyToken(request = null, env = {}) {
  if (isLocalDevelopment(request, env)) {
    return { valid: true, payload: buildPublicPayload("local-dev") };
  }

  return { valid: true, payload: buildPublicPayload("public-readonly") };
}

export async function authenticateRequest(request = null, env = {}) {
  if (isLocalDevelopment(request, env)) {
    return {
      authenticated: true,
      payload: buildPublicPayload("local-dev"),
    };
  }

  return {
    authenticated: false,
    error:
      "Public read-only mode is active. Administrative changes are only enabled in local development or when ALLOW_PUBLIC_WRITE=enabled is set.",
    payload: buildPublicPayload("public-readonly"),
  };
}

export async function onRequestPost(context) {
  const request = context?.request ?? null;
  const env = context?.env ?? {};
  const local = isLocalDevelopment(request, env);
  const mode = local ? "local-dev" : "public-readonly";

  return new Response(
    JSON.stringify({
      success: true,
      message: local
        ? "Local development mode is active. Administrative changes are enabled on this machine."
        : "Public read-only mode is active. Administrative changes are disabled.",
      user: buildPublicPayload(mode),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
