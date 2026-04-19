// Supabase Edge Function placeholder.
// Conecta aquí WhatsApp Cloud API.

Deno.serve(async (req) => {
  const payload = await req.json().catch(() => ({}));

  return new Response(
    JSON.stringify({
      ok: true,
      message: "send-whatsapp-message placeholder",
      payload
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
