// app/actividad/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Database,
  Filter,
  ShieldCheck,
  User,
} from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
};

type ActivityProfile = {
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type RawActivityLog = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  profiles?: ActivityProfile | ActivityProfile[] | null;
};

type ActivityLog = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  profiles: ActivityProfile | null;
};

type SearchParams = {
  user?: string;
  module?: string;
  action?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

const moduleLabels: Record<string, string> = {
  clients: "Clientes",
  leads: "Leads",
  affiliates: "Afiliados",
  referrals: "Referidos",
  tasks: "Tareas",
  tickets: "Tickets",
  service_requests: "Solicitudes",
  commissions: "Comisiones",
  documents: "Documentos",
  sales: "Ventas",
  payments: "Pagos",
  quotes: "Cotizaciones",
  profiles: "Usuarios",
};

const actionLabels: Record<string, string> = {
  create: "Creó",
  insert: "Creó",
  update: "Modificó",
  delete: "Eliminó",
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getModuleLabel(module: string) {
  return moduleLabels[module] || module.replaceAll("_", " ");
}

function getActionLabel(action: string) {
  return actionLabels[action] || action;
}

function getActionClass(action: string) {
  const clean = action.toLowerCase();

  if (["create", "insert"].includes(clean)) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }

  if (clean === "update") {
    return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  }

  if (clean === "delete") {
    return "border-red-400/20 bg-red-500/10 text-red-200";
  }

  return "border-slate-400/20 bg-slate-500/10 text-slate-200";
}

function normalizeProfile(
  profile?: ActivityProfile | ActivityProfile[] | null
): ActivityProfile | null {
  if (!profile) return null;

  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function normalizeLogs(logsData: unknown): ActivityLog[] {
  const rawLogs = (Array.isArray(logsData) ? logsData : []) as RawActivityLog[];

  return rawLogs.map((log) => ({
    id: String(log.id),
    user_id: log.user_id ? String(log.user_id) : null,
    action: String(log.action || ""),
    table_name: String(log.table_name || ""),
    record_id: log.record_id ? String(log.record_id) : null,
    old_data: log.old_data || null,
    new_data: log.new_data || null,
    created_at: String(log.created_at || ""),
    profiles: normalizeProfile(log.profiles),
  }));
}

function getRecordTitle(data?: Record<string, unknown> | null) {
  if (!data) return "Registro sin detalle";

  return String(
    data.name ||
      data.full_name ||
      data.title ||
      data.subject ||
      data.email ||
      data.code ||
      data.id ||
      "Registro sin título"
  );
}

function getChangedFields(
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null
) {
  if (!oldData || !newData) return [];

  const ignoredFields = new Set(["updated_at"]);
  const keys = Array.from(
    new Set([...Object.keys(oldData), ...Object.keys(newData)])
  );

  return keys
    .filter((key) => !ignoredFields.has(key))
    .filter(
      (key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
    )
    .slice(0, 8);
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default async function ActividadPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const selectedUser = params?.user || "todos";
  const selectedModule = params?.module || "todos";
  const selectedAction = params?.action || "todos";

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

  if (
    currentProfile?.role !== "admin" ||
    !["activo", "active"].includes(String(currentProfile?.status))
  ) {
    redirect("/");
  }

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .order("full_name", { ascending: true });

  let query = supabase
    .from("activity_logs")
    .select(
      `
        id,
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        created_at,
        profiles:user_id (
          full_name,
          email,
          role
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (selectedUser !== "todos") {
    query = query.eq("user_id", selectedUser);
  }

  if (selectedModule !== "todos") {
    query = query.eq("table_name", selectedModule);
  }

  if (selectedAction !== "todos") {
    query = query.eq("action", selectedAction);
  }

  const { data: logsData, error } = await query;

  const profiles = ((profilesData || []) as unknown as Profile[]).filter(
    Boolean
  );

  const logs = normalizeLogs(logsData);

  const totalCreates = logs.filter((log) =>
    ["create", "insert"].includes(log.action)
  ).length;

  const totalUpdates = logs.filter((log) => log.action === "update").length;
  const totalDeletes = logs.filter((log) => log.action === "delete").length;

  const modules = Array.from(
    new Set(logs.map((log) => log.table_name).filter(Boolean))
  ).sort();

  const actions = Array.from(
    new Set(logs.map((log) => log.action).filter(Boolean))
  ).sort();

  const topUsers = profiles
    .map((profile) => {
      const count = logs.filter((log) => log.user_id === profile.id).length;

      return {
        profile,
        count,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (error) {
    return (
      <main className="space-y-6 p-6">
        <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-red-200" size={22} />

            <div>
              <h1 className="text-2xl font-black text-white">
                No se pudo cargar Actividad
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-red-100">
                Esta página necesita la tabla{" "}
                <strong>public.activity_logs</strong>. Ejecuta primero el SQL
                de auditoría/activity logs en Supabase.
              </p>

              <p className="mt-3 rounded-2xl border border-red-300/10 bg-red-950/30 p-3 font-mono text-xs text-red-100">
                {error.message}
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-300/10 bg-indigo-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              <ShieldCheck size={14} />
              Centro de control
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white">
              Actividad del CRM
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Aquí ves qué hizo cada usuario: registros creados, cambios,
              eliminaciones, módulo afectado y detalle del movimiento.
            </p>
          </div>

          <Link
            href="/sesiones"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/[0.1]"
          >
            Ver sesiones
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Movimientos"
          value={logs.length}
          description="Acciones encontradas con los filtros actuales."
        />

        <StatCard
          label="Creados"
          value={totalCreates}
          description="Registros nuevos creados por usuarios."
        />

        <StatCard
          label="Modificados"
          value={totalUpdates}
          description="Cambios hechos en registros existentes."
        />

        <StatCard
          label="Eliminados"
          value={totalDeletes}
          description="Registros eliminados del sistema."
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
        <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-400">
          <Filter size={16} />
          Filtros
        </div>

        <form className="grid gap-4 md:grid-cols-3">
          <select
            name="user"
            defaultValue={selectedUser}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-100 outline-none focus:border-indigo-400/60"
          >
            <option value="todos">Todos los usuarios</option>

            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name || profile.email || "Sin nombre"} ·{" "}
                {profile.role || "sin rol"}
              </option>
            ))}
          </select>

          <select
            name="module"
            defaultValue={selectedModule}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-100 outline-none focus:border-indigo-400/60"
          >
            <option value="todos">Todos los módulos</option>

            {modules.map((module) => (
              <option key={module} value={module}>
                {getModuleLabel(module)}
              </option>
            ))}
          </select>

          <select
            name="action"
            defaultValue={selectedAction}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-100 outline-none focus:border-indigo-400/60"
          >
            <option value="todos">Todas las acciones</option>

            {actions.map((action) => (
              <option key={action} value={action}>
                {getActionLabel(action)}
              </option>
            ))}
          </select>

          <div className="flex gap-3 md:col-span-3">
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-950/30"
            >
              Aplicar filtros
            </button>

            <Link
              href="/actividad"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/[0.1]"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <User size={20} />
            Usuarios más activos
          </h2>

          <div className="mt-5 space-y-3">
            {topUsers.length === 0 ? (
              <p className="text-sm text-slate-500">Sin actividad todavía.</p>
            ) : (
              topUsers.map((item) => (
                <Link
                  key={item.profile.id}
                  href={`/actividad?user=${item.profile.id}`}
                  className="block rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:bg-white/[0.06]"
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

                    <div className="text-right">
                      <p className="text-2xl font-black text-indigo-200">
                        {item.count}
                      </p>

                      <p className="text-xs text-slate-500">acciones</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <Database size={20} />
            Módulos con movimiento
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {modules.length === 0 ? (
              <p className="text-sm text-slate-500">Sin módulos todavía.</p>
            ) : (
              modules.map((module) => {
                const count = logs.filter(
                  (log) => log.table_name === module
                ).length;

                return (
                  <Link
                    key={module}
                    href={`/actividad?module=${module}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:bg-white/[0.06]"
                  >
                    <p className="font-black capitalize text-white">
                      {getModuleLabel(module)}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {count} movimientos
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-6">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <Activity size={20} />
            Registro de actividad
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Historial ordenado del más reciente al más antiguo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04]">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Usuario
                </th>

                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Acción
                </th>

                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Módulo
                </th>

                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Registro
                </th>

                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Cambios
                </th>

                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Fecha
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No hay actividad con esos filtros.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const displayData = log.new_data || log.old_data;
                  const changedFields = getChangedFields(
                    log.old_data,
                    log.new_data
                  );

                  return (
                    <tr
                      key={log.id}
                      className="align-top hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-4">
                        <p className="font-black text-white">
                          {log.profiles?.full_name || "Sin nombre"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {log.profiles?.email || "Sin correo"}
                        </p>

                        <p className="mt-1 text-xs uppercase text-indigo-200">
                          {log.profiles?.role || "sin rol"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase",
                            getActionClass(log.action),
                          ].join(" ")}
                        >
                          {getActionLabel(log.action)}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-bold capitalize text-slate-300">
                        {getModuleLabel(log.table_name)}
                      </td>

                      <td className="max-w-xs px-4 py-4">
                        <p className="truncate font-bold text-slate-200">
                          {getRecordTitle(displayData)}
                        </p>

                        <p className="mt-1 truncate font-mono text-xs text-slate-500">
                          {log.record_id || "—"}
                        </p>
                      </td>

                      <td className="max-w-sm px-4 py-4">
                        {log.action === "update" &&
                        changedFields.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {changedFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-200"
                              >
                                {field.replaceAll("_", " ")}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock size={14} />
                          {formatDate(log.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}