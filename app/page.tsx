import Link from "next/link";
import { redirect } from "next/navigation";
import { FinancialDashboard } from "@/components/financial-dashboard";
import { Reto111Dashboard } from "@/components/reto111-dashboard";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  Activity,
  ArrowRight,
  CheckSquare,
  Database,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: typeof Users;
}) {
  return (
    <article className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{value}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-200">
          <Icon size={21} strokeWidth={2.2} />
        </div>
      </div>
    </article>
  );
}

export default async function DashboardPage() {
  const [supabase, user, profile] = await Promise.all([
    createClient(),
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!user) redirect("/login");
  if (!profile || !["activo", "active"].includes(String(profile.status))) {
    redirect("/login");
  }

  const role = String(profile.role || "").toLowerCase();
  const privileged = ["super_admin", "admin"].includes(role);

  if (!privileged) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1600px]">
          <FinancialDashboard />
        </div>
      </main>
    );
  }

  const settled = await Promise.allSettled([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }),
    supabase.from("tickets").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("status", ["activo", "active"]),
    supabase
      .from("leads")
      .select("id,name,email,status,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const countAt = (index: number) => {
    const result = settled[index];
    if (!result || result.status === "rejected" || result.value.error) return 0;
    return result.value.count || 0;
  };

  const recentResult = settled[5];
  const recentLeads =
    recentResult && recentResult.status === "fulfilled" && !recentResult.value.error
      ? recentResult.value.data || []
      : [];

  const hasPartialFailure = settled.some(
    (result) => result.status === "rejected" || Boolean(result.value.error)
  );

  const displayName =
    profile.full_name?.trim().split(/\s+/)[0] ||
    profile.email?.split("@")[0] ||
    "Equipo";

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-[110px]" />
      <div className="pointer-events-none absolute right-0 top-40 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="mx-auto max-w-[1600px] space-y-6">
        {hasPartialFailure ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            Una métrica no respondió a tiempo. El dashboard cargó el resto de la información disponible.
          </section>
        ) : null}

        <section className="crm-hero p-6 lg:p-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                <span className="crm-status-dot" />
                Control global · {role === "super_admin" ? "Super Admin" : "Admin"}
              </div>
              <h1 className="crm-gradient-title text-4xl font-black tracking-tight lg:text-5xl">
                Hola, {displayName}.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                Esta vista global está reservada a admin y super_admin. Responsables, vendedores y afiliados reciben un dashboard privado filtrado por RLS.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/finanzas" className="crm-button-primary">
                <Zap size={17} />
                Centro financiero
              </Link>
              <Link href="/oportunidades" className="crm-button-secondary">
                <Target size={17} />
                Pipeline
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Clientes" value={countAt(0)} description="Clientes registrados." icon={Users} />
          <StatCard title="Leads" value={countAt(1)} description="Prospectos comerciales." icon={UserPlus} />
          <StatCard title="Tareas" value={countAt(2)} description="Tareas en el sistema." icon={CheckSquare} />
          <StatCard title="Tickets" value={countAt(3)} description="Tickets registrados." icon={LifeBuoy} />
          <StatCard title="Usuarios activos" value={countAt(4)} description="Usuarios habilitados." icon={ShieldCheck} />
        </section>

        <FinancialDashboard compact />

        <Reto111Dashboard />

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="crm-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Actividad reciente</p>
                <h2 className="mt-2 text-2xl font-black text-white">Últimos leads</h2>
              </div>
              <Activity className="text-cyan-300" size={22} />
            </div>

            <div className="mt-5 space-y-3">
              {recentLeads.length ? (
                recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href="/leads"
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 hover:bg-white/[0.05]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{lead.name || lead.email || "Lead"}</p>
                      <p className="mt-1 text-xs text-slate-500">{lead.status || "sin estado"}</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-600 group-hover:text-white" />
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">
                  No hay leads recientes para mostrar.
                </p>
              )}
            </div>
          </div>

          <div className="crm-card p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-200">
                <Database size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">Accesos rápidos</p>
                <h2 className="mt-1 text-2xl font-black text-white">Operación diaria</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Clientes", "/clientes"],
                ["Leads", "/leads"],
                ["Oportunidades", "/oportunidades"],
                ["Ventas", "/ventas"],
                ["Pagos", "/pagos"],
                ["Finanzas", "/finanzas"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm font-black text-slate-200 hover:bg-white/[0.05]">
                  <span className="flex items-center justify-between gap-3">
                    {label}
                    <ArrowRight size={15} className="text-slate-600" />
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <Sparkles size={14} className="text-indigo-300" />
              El ingreso real proviene de pagos contabilizados; las vistas privadas dependen de RLS.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
