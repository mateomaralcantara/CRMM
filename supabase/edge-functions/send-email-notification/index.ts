// Supabase Edge Function placeholder.
// Conecta aquí Resend, SendGrid o SMTP transaccional.


Deno.serve(async (req: Request) => {
  const payload = await req.json().catch(() => ({}));

  return new Response(
    JSON.stringify({
      ok: true,
      message: "send-email-notification placeholder",
      payload
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});