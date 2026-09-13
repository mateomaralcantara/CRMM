import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

export default async function MiCuentaPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("*")
    .or(`user_id.eq.${profile.id},created_by.eq.${profile.id}`)
    .maybeSingle();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false });

  const { data: commissions } = await supabase
    .from("commissions")
    .select(`
      *,
      affiliates!inner (
        id,
        user_id,
        created_by
      )
    `)
    .or(`user_id.eq.${profile.id},created_by.eq.${profile.id}`, {
      foreignTable: "affiliates"
    });

  return (
    <main className="space-y-6 p-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
          Mi cuenta
        </p>

        <h1 className="mt-2 text-3xl font-black text-white">
          Hola, {profile.full_name || profile.email}
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Aquí puedes ver tus datos, tus leads y tus comisiones.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-slate-400">Tipo de usuario</p>
          <p className="mt-2 text-2xl font-black capitalize text-white">
            {profile.role}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-slate-400">Mis leads</p>
          <p className="mt-2 text-2xl font-black text-white">
            {leads?.length || 0}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-slate-400">Mis comisiones</p>
          <p className="mt-2 text-2xl font-black text-white">
            {commissions?.length || 0}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-xl font-black text-white">Mis datos de afiliado</h2>

        {!affiliate ? (
          <p className="mt-4 text-sm text-slate-400">
            Todavía no tienes un registro de afiliado vinculado.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <p>
              <span className="font-bold text-white">Nombre:</span>{" "}
              {String(affiliate.name || "—")}
            </p>
            <p>
              <span className="font-bold text-white">Código:</span>{" "}
              {String(affiliate.code || "—")}
            </p>
            <p>
              <span className="font-bold text-white">Estado:</span>{" "}
              {String(affiliate.status || "—")}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-xl font-black text-white">Mis leads</h2>

        <div className="mt-4 space-y-3">
          {(leads || []).length === 0 ? (
            <p className="text-sm text-slate-400">No tienes leads todavía.</p>
          ) : (
            leads?.map((lead) => (
              <div
                key={lead.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300"
              >
                <p className="font-bold text-white">
                  {String(lead.name || lead.title || "Lead sin nombre")}
                </p>
                <p>{String(lead.email || "")}</p>
                <p>{String(lead.phone || "")}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}