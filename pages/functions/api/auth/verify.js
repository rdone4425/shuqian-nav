export async function verifyToken() {
  return { valid: true, payload: { sub: "public", mode: "public" } };
}

export async function authenticateRequest() {
  return {
    authenticated: true,
    payload: { sub: "public", mode: "public" },
  };
}

export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Authentication is disabled in public mode.",
      user: { sub: "public", mode: "public" },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}