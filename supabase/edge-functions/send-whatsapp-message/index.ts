// Supabase Edge Function placeholder.
// Conecta aquí WhatsApp Cloud API.

declare const Deno: {
  serve: (
    handler: (req: Request) => Response | Promise<Response>
  ) => void;
};

Deno.serve(async (req: Request) => {
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