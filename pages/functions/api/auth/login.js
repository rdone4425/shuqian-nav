export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Authentication is disabled in public mode.",
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  );
}
