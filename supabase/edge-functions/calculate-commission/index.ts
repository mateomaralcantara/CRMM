// Supabase Edge Function placeholder.
// Aquí puedes calcular comisiones según venta, afiliado, nivel y reglas.


Deno.serve(async (req: Request) => {
  const payload = await req.json().catch(() => ({}));

  return new Response(
    JSON.stringify({
      ok: true,
      message: "calculate-commission placeholder",
      payload
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});