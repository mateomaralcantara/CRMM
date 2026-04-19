import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckSquare,
  Clock,
  Database,
  FileText,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
};

type CrmRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  full_name?: string;
  title?: string;
  subject?: string;
  email?: string;
  code?: string;
  status?: string;
  payment_status?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  assigned_to?: string;
  responsible_id?: string;
  user_id?: string;
  validated_by?: string;
};

type ModuleResult = {
  table: string;
  label: string;
  href: string;
  icon: LucideIcon;
  rows: CrmRow[];
  error: string | null;
};

const modules = [
  {
    table: "clients",
    label: "Clientes",
    href: "/clientes",
    icon: Users,
  },
  {
    table: "leads",
    label: "Leads",
    href: "/leads",
    icon: UserPlus,
  },
  {
    table: "affiliates",
    label: "Afiliados",
    href: "/afiliados",
    icon: Handshake,
  },
  {
    table: "referrals",
    label: "Referidos",
    href: "/referidos",
    icon: TrendingUp,
  },
  {
    table: "tasks",
    label: "Tareas",
    href: "/tareas",
    icon: CheckSquare,
  },
  {
    table: "tickets",
    label: "Tickets",
    href: "/tickets",
    icon: LifeBuoy,
  },
  {
    table: "service_requests",
    label: "Solicitudes",
    href: "/solicitudes",
    icon: FileText,
  },
  {
    table: "commissions",
    label: "Comisiones",
    href: "/comisiones",
    icon: BadgeDollarSign,
  },
] as const;

const openStatuses = new Set([
  "pendiente",
  "nuevo",
  "nueva",
  "abierto",
  "abierta",
  "en_proceso",
  "proceso",
  "urgente",
  "alta",
  "media",
]);

const closedStatuses = new Set([
  "cerrado",
  "cerrada",
  "completado",
  "completada",
  "cancelado",
  "cancelada",
  "pagado",
  "pagada",
  "rechazado",
  "rechazada",
]);

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRecordDate(row: CrmRow) {
  return String(row.updated_at || row.created_at || "");
}

function getRecordTitle(row: CrmRow) {
  return String(
    row.name ||
      row.full_name ||
      row.title ||
      row.subject ||
      row.email ||
      row.code ||
      row.id ||
      "Registro sin título"
  );
}

function getStatus(row: CrmRow) {
  return String(row.status || row.payment_status || "—");
}

function normalize(value?: unknown) {
  return String(value || "").toLowerCase().trim();
}

function isOpenRow(row: CrmRow) {
  const status = normalize(row.status || row.payment_status);

  if (!status || status === "—") return true;
  if (closedStatuses.has(status)) return false;
  if (openStatuses.has(status)) return true;

  return true;
}

function getUserName(userId: unknown, profilesMap: Map<string, Profile>) {
  if (!userId) return "—";

  const profile = profilesMap.get(String(userId));

  if (!profile) return "Usuario no encontrado";

  return profile.full_name || profile.email || "Sin nombre";
}

function getBadgeClass(value?: unknown) {
  const clean = normalize(value);

  if (
    [
      "activo",
      "activa",
      "completado",
      "completada",
      "pagado",
      "pagada",
      "ganada",
      "validado",
      "aprobado",
      "aprobada",
    ].includes(clean)
  ) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }

  if (
    [
      "pendiente",
      "nuevo",
      "nueva",
      "abierto",
      "abierta",
      "media",
      "borrador",
      "parcial",
    ].includes(clean)
  ) {
    return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  }

  if (
    [
      "urgente",
      "alta",
      "vencido",
      "vencida",
      "cancelado",
      "cancelada",
      "rechazado",
      "rechazada",
      "suspendido",
      "suspendida",
    ].includes(clean)
  ) {
    return "border-red-400/20 bg-red-500/10 text-red-200";
  }

  if (["en_proceso", "contactado", "cotizado", "enviada"].includes(clean)) {
    return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  }

  return "border-slate-400/20 bg-slate-500/10 text-slate-200";
}

async function loadModule(
  supabase: ReturnType<typeof createClient>,
  module: (typeof modules)[number]
) {
  const base = {
    table: module.table,
    label: module.label,
    href: module.href,
    icon: module.icon,
  };

  const ordered = await supabase
    .from(module.table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!ordered.error) {
    return {
      ...base,
      rows: (ordered.data || []) as CrmRow[],
      error: null,
    } satisfies ModuleResult;
  }

  const fallback = await supabase.from(module.table).select("*").limit(200);

  if (!fallback.error) {
    return {
      ...base,
      rows: (fallback.data || []) as CrmRow[],
      error: null,
    } satisfies ModuleResult;
  }

  return {
    ...base,
    rows: [],
    error: fallback.error.message || ordered.error.message,
  } satisfies ModuleResult;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black text-white">{value}</p>
        </div>

        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-200">
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", user.id)
    .single();

  if (!currentProfile || !["activo", "active"].includes(String(currentProfile.status))) {
    redirect("/login");
  }

  const isAdmin = currentProfile.role === "admin";
  const isSupervisor = currentProfile.role === "supervisor";

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .order("created_at", { ascending: false });

  const profiles = ((profilesData || []) as unknown as Profile[]).filter(Boolean);

  const profilesMap = new Map<string, Profile>(
    profiles.map((profile) => [profile.id, profile])
  );

  const moduleResults = await Promise.all(
    modules.map((module) => loadModule(supabase, module))
  );

  const allRows = moduleResults.flatMap((module) =>
    module.rows.map((row) => ({
      ...row,
      moduleLabel: module.label,
      moduleHref: module.href,
      table: module.table,
    }))
  );

  const recentRows = [...allRows]
    .sort((a, b) => {
      const dateA = new Date(getRecordDate(a) || 0).getTime();
      const dateB = new Date(getRecordDate(b) || 0).getTime();

      return dateB - dateA;
    })
    .slice(0, 12);

  const pendingRows = allRows
    .filter((row) =>
      ["tasks", "tickets", "leads", "service_requests"].includes(String(row.table))
    )
    .filter(isOpenRow)
    .sort((a, b) => {
      const dateA = new Date(getRecordDate(a) || 0).getTime();
      const dateB = new Date(getRecordDate(b) || 0).getTime();

      return dateB - dateA;
    })
    .slice(0, 10);

  const totalRecords = moduleResults.reduce(
    (total, module) => total + module.rows.length,
    0
  );

  const totalErrors = moduleResults.filter((module) => module.error).length;

  const activeUsers = profiles.filter((profile) =>
    ["activo", "active"].includes(String(profile.status))
  ).length;

  const userStats = profiles
    .map((profile) => {
      let created = 0;
      let assigned = 0;

      for (const row of allRows) {
        if (row.created_by === profile.id || row.user_id === profile.id) {
          created++;
        }

        if (
          row.assigned_to === profile.id ||
          row.responsible_id === profile.id ||
          row.validated_by === profile.id
        ) {
          assigned++;
        }
      }

      return {
        profile,
        created,
        assigned,
        total: created + assigned,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <main className="space-y-6 p-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-300/10 bg-indigo-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              <LayoutDashboard size={14} />
              Dashboard
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white">
              {isAdmin || isSupervisor ? "Vista general del CRM" : "Mi panel de trabajo"}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {isAdmin || isSupervisor
                ? "Controla clientes, leads, afiliados, tareas, tickets, solicitudes, comisiones y usuarios desde una sola pantalla."
                : "Aquí ves los registros que tienes disponibles según tu rol y permisos."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {(isAdmin || isSupervisor) && (
              <Link
                href="/actividad"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/[0.1]"
              >
                Ver actividad
                <ArrowRight size={16} />
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/usuarios"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-950/30"
              >
                Usuarios y roles
                <ShieldCheck size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {totalErrors > 0 ? (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-amber-200" size={20} />

            <div>
              <h2 className="font-black text-amber-100">Algunos módulos no cargaron</h2>
              <p className="mt-1 text-sm leading-6 text-amber-100/80">
                Revisa si esas tablas existen o si las políticas RLS permiten lectura para tu rol.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Registros visibles"
          value={totalRecords}
          description="Total cargado desde los módulos principales."
          icon={Database}
        />

        <StatCard
          title="Usuarios activos"
          value={activeUsers}
          description="Usuarios con estado activo en profiles."
          icon={Users}
        />

        <StatCard
          title="Pendientes"
          value={pendingRows.length}
          description="Tareas, tickets, leads y solicitudes abiertas."
          icon={Clock}
        />

        <StatCard
          title="Módulos"
          value={moduleResults.length - totalErrors}
          description="Módulos cargados correctamente."
          icon={BarChart3}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moduleResults.map((module) => {
          const Icon = module.icon;

          return (
            <Link
              key={module.table}
              href={module.href}
              className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 transition hover:bg-white/[0.08]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-300">{module.label}</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {module.rows.length}
                  </p>
                </div>

                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-slate-300 transition group-hover:bg-indigo-500/10 group-hover:text-indigo-200">
                  <Icon size={22} />
                </div>
              </div>

              <p className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-slate-300">
                {module.error ? "No cargó este módulo" : "Abrir módulo"}
                <ArrowRight size={13} />
              </p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-6">
            <h2 className="text-xl font-black text-white">Pendientes importantes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tareas, tickets, leads y solicitudes que siguen abiertas.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04]">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Módulo
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Registro
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Estado
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Responsable
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {pendingRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                      No hay pendientes visibles.
                    </td>
                  </tr>
                ) : (
                  pendingRows.map((row) => (
                    <tr key={`${row.table}-${row.id}`} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <Link
                          href={String(row.moduleHref)}
                          className="font-black text-indigo-200 hover:text-white"
                        >
                          {String(row.moduleLabel)}
                        </Link>
                      </td>

                      <td className="max-w-xs truncate px-4 py-4 font-bold text-slate-200">
                        {getRecordTitle(row)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase",
                            getBadgeClass(getStatus(row)),
                          ].join(" ")}
                        >
                          {getStatus(row).replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-400">
                        {getUserName(
                          row.assigned_to || row.responsible_id || row.validated_by,
                          profilesMap
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <h2 className="text-xl font-black text-white">Actividad por usuario</h2>
          <p className="mt-1 text-sm text-slate-500">
            Resumen de registros creados o asignados.
          </p>

          <div className="mt-5 space-y-3">
            {userStats.length === 0 ? (
              <p className="text-sm text-slate-500">Sin usuarios para mostrar.</p>
            ) : (
              userStats.map((item) => (
                <div
                  key={item.profile.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">
                        {item.profile.full_name || "Sin nombre"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.profile.email || "Sin correo"}
                      </p>
                    </div>

                    <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-black uppercase text-indigo-200">
                      {item.profile.role || "sin rol"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/[0.04] p-2">
                      <p className="text-lg font-black text-white">{item.created}</p>
                      <p className="text-[11px] text-slate-500">creados</p>
                    </div>

                    <div className="rounded-xl bg-white/[0.04] p-2">
                      <p className="text-lg font-black text-white">{item.assigned}</p>
                      <p className="text-[11px] text-slate-500">asignados</p>
                    </div>

                    <div className="rounded-xl bg-white/[0.04] p-2">
                      <p className="text-lg font-black text-white">{item.total}</p>
                      <p className="text-[11px] text-slate-500">total</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-6">
          <h2 className="text-xl font-black text-white">Últimos movimientos visibles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Registros recientes cargados desde los módulos principales.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04]">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Módulo
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Registro
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Creado por
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Fecha
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {recentRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    Todavía no hay registros visibles.
                  </td>
                </tr>
              ) : (
                recentRows.map((row) => (
                  <tr key={`${row.table}-${row.id}`} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <Link
                        href={String(row.moduleHref)}
                        className="font-black text-indigo-200 hover:text-white"
                      >
                        {String(row.moduleLabel)}
                      </Link>
                    </td>

                    <td className="max-w-xs truncate px-4 py-4 font-bold text-slate-200">
                      {getRecordTitle(row)}
                    </td>

                    <td className="px-4 py-4 text-slate-400">
                      {getUserName(row.created_by || row.user_id, profilesMap)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                      {formatDate(getRecordDate(row))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}