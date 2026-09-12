import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
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
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
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

function normalize(value?: unknown) {
  return String(value || "").toLowerCase().trim();
}

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

function isOpenRow(row: CrmRow) {
  const status = normalize(row.status || row.payment_status);

  if (!status || status === "—") return true;
  if (closedStatuses.has(status)) return false;
  if (openStatuses.has(status)) return true;

  return true;
}

function priorityScore(row: CrmRow) {
  const priority = normalize(row.priority || row.status);

  if (["urgente", "critical", "crítica", "critica"].includes(priority)) return 4;
  if (["alta", "high"].includes(priority)) return 3;
  if (["media", "medium"].includes(priority)) return 2;
  if (["baja", "low"].includes(priority)) return 1;

  return 0;
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

function getPriorityDot(row: CrmRow) {
  const score = priorityScore(row);

  if (score >= 4) return "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.7)]";
  if (score === 3) return "bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.6)]";
  if (score === 2) return "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.5)]";

  return "bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.45)]";
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
  accent = "indigo",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  accent?: "indigo" | "cyan" | "emerald" | "amber";
}) {
  const accents = {
    indigo: {
      icon: "border-indigo-400/20 bg-indigo-500/10 text-indigo-200",
      glow: "from-indigo-500/20 via-indigo-500/5 to-transparent",
    },
    cyan: {
      icon: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
      glow: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    },
    emerald: {
      icon: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      glow: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    },
    amber: {
      icon: "border-amber-400/20 bg-amber-500/10 text-amber-200",
      glow: "from-amber-500/20 via-amber-500/5 to-transparent",
    },
  } as const;

  const style = accents[accent];

  return (
    <article className="group relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-slate-900/70">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${style.glow} opacity-70 blur-2xl transition group-hover:opacity-100`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">
            {value}
          </p>
        </div>

        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${style.icon} shadow-lg`}
        >
          <Icon size={21} strokeWidth={2.2} />
        </div>
      </div>

      <p className="relative mt-4 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

function PipelineStep({
  label,
  value,
  index,
}: {
  label: string;
  value: number;
  index: number;
}) {
  const width = Math.max(18, 100 - index * 14);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-xs font-bold text-slate-400">{label}</span>
        <span className="text-sm font-black text-white">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.045]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 shadow-[0_0_18px_rgba(99,102,241,0.28)]"
          style={{ width: `${width}%` }}
        />
      </div>
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
  const canManage = isAdmin || isSupervisor;

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

  const getModuleRows = (table: string) =>
    moduleResults.find((module) => module.table === table)?.rows || [];

  const clientsRows = getModuleRows("clients");
  const leadsRows = getModuleRows("leads");
  const serviceRows = getModuleRows("service_requests");

  const recentRows = [...allRows]
    .sort((a, b) => {
      const dateA = new Date(getRecordDate(a) || 0).getTime();
      const dateB = new Date(getRecordDate(b) || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 10);

  const pendingRows = allRows
    .filter((row) =>
      ["tasks", "tickets", "leads", "service_requests"].includes(String(row.table))
    )
    .filter(isOpenRow)
    .sort((a, b) => {
      const priorityDifference = priorityScore(b) - priorityScore(a);
      if (priorityDifference !== 0) return priorityDifference;

      const dateA = new Date(getRecordDate(a) || 0).getTime();
      const dateB = new Date(getRecordDate(b) || 0).getTime();
      return dateB - dateA;
    });

  const priorityRows = pendingRows.slice(0, 6);

  const totalRecords = moduleResults.reduce(
    (total, module) => total + module.rows.length,
    0
  );

  const totalErrors = moduleResults.filter((module) => module.error).length;
  const healthyModules = moduleResults.length - totalErrors;

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
    .slice(0, 6);

  const leadStatusCounts = {
    nuevos: leadsRows.filter((row) => ["nuevo", "nueva"].includes(normalize(row.status))).length,
    contactados: leadsRows.filter((row) => normalize(row.status) === "contactado").length,
    cotizados: leadsRows.filter((row) => normalize(row.status) === "cotizado").length,
    proceso: leadsRows.filter((row) => ["en_proceso", "proceso"].includes(normalize(row.status))).length,
    cerrados: leadsRows.filter((row) => closedStatuses.has(normalize(row.status))).length,
  };

  const pipeline = [
    { label: "Nuevos", value: leadStatusCounts.nuevos },
    { label: "Contactados", value: leadStatusCounts.contactados },
    { label: "Cotizados", value: leadStatusCounts.cotizados },
    { label: "En proceso", value: leadStatusCounts.proceso },
    { label: "Cerrados", value: leadStatusCounts.cerrados },
  ];

  const displayName =
    currentProfile.full_name?.trim().split(/\s+/)[0] ||
    currentProfile.email?.split("@")[0] ||
    "Equipo";

  const roleLabel = currentProfile.role || "usuario";
  const systemHealthy = totalErrors === 0;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-[110px]" />
      <div className="pointer-events-none absolute right-0 top-40 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="crm-hero relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-indigo-500/15 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />

          <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
                  <Sparkles size={13} />
                  Command Center
                </span>

                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                    systemHealthy
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      systemHealthy
                        ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.7)]"
                        : "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,.6)]"
                    }`}
                  />
                  {systemHealthy ? "Sistema operativo" : `${totalErrors} módulo(s) con alerta`}
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {roleLabel}
                </span>
              </div>

              <p className="text-sm font-bold text-slate-400">Bienvenido, {displayName}</p>

              <h1 className="crm-gradient-title mt-2 max-w-5xl text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl xl:text-6xl">
                {canManage ? "Tu operación, bajo control." : "Tu trabajo, en una sola vista."}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                {canManage
                  ? "Clientes, oportunidades, solicitudes, tareas, equipo y actividad crítica organizados como un centro de mando comercial."
                  : "Tus registros, responsables y pendientes más importantes reunidos para que ejecutes sin perder foco."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/leads" className="crm-button-primary">
                  <UserPlus size={17} />
                  Abrir leads
                </Link>

                <Link href="/clientes" className="crm-button-secondary">
                  <Users size={17} />
                  Clientes
                </Link>

                <Link href="/solicitudes" className="crm-button-secondary">
                  <FileText size={17} />
                  Solicitudes
                </Link>

                {canManage && (
                  <Link href="/actividad" className="crm-button-secondary">
                    <Activity size={17} />
                    Actividad
                  </Link>
                )}
              </div>
            </div>

            <div className="grid min-w-[280px] gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Clientes
                  </span>
                  <Users size={15} className="text-indigo-300" />
                </div>
                <p className="mt-1 text-2xl font-black text-white">{clientsRows.length}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Leads
                  </span>
                  <Target size={15} className="text-cyan-300" />
                </div>
                <p className="mt-1 text-2xl font-black text-white">{leadsRows.length}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Solicitudes
                  </span>
                  <FileText size={15} className="text-emerald-300" />
                </div>
                <p className="mt-1 text-2xl font-black text-white">{serviceRows.length}</p>
              </div>
            </div>
          </div>
        </section>

        {totalErrors > 0 && (
          <section className="rounded-[1.7rem] border border-amber-400/20 bg-amber-500/[0.07] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-200">
                <AlertTriangle size={19} />
              </div>
              <div>
                <h2 className="font-black text-amber-100">Hay módulos que requieren atención</h2>
                <p className="mt-1 text-sm leading-6 text-amber-100/70">
                  Revisa existencia de tablas y políticas RLS. El resto del dashboard continúa operativo.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <StatCard
            title="Registros visibles"
            value={totalRecords}
            description="Volumen cargado desde los módulos principales del CRM."
            icon={Database}
            accent="indigo"
          />
          <StatCard
            title="Usuarios activos"
            value={activeUsers}
            description="Miembros activos actualmente disponibles en profiles."
            icon={Users}
            accent="emerald"
          />
          <StatCard
            title="Pendientes abiertos"
            value={pendingRows.length}
            description="Tareas, tickets, leads y solicitudes que siguen requiriendo acción."
            icon={Clock}
            accent="amber"
          />
          <StatCard
            title="Módulos operativos"
            value={`${healthyModules}/${moduleResults.length}`}
            description="Salud general de los módulos consultados por el dashboard."
            icon={BarChart3}
            accent="cyan"
          />
        </section>

        <section className="grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-indigo-200">
                  <Zap size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Acceso operativo
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">Módulos del negocio</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Entra directamente a cada área sin perder contexto.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-400">
                <Search size={14} />
                {moduleResults.length} áreas conectadas
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {moduleResults.map((module) => {
                const Icon = module.icon;

                return (
                  <Link
                    key={module.table}
                    href={module.href}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-300 hover:-translate-y-1 hover:border-indigo-400/25 hover:bg-indigo-500/[0.055] hover:shadow-xl hover:shadow-indigo-950/20"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent opacity-0 transition group-hover:opacity-100" />

                    <div className="flex items-center justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition group-hover:border-indigo-400/20 group-hover:bg-indigo-500/10 group-hover:text-indigo-200">
                        <Icon size={18} />
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-300"
                      />
                    </div>

                    <p className="mt-5 text-xs font-black uppercase tracking-[0.13em] text-slate-500">
                      {module.label}
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                      {module.rows.length}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-slate-600">
                      {module.error ? "Requiere revisión" : "Operativo"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <Target size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Pipeline
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">Estado de leads</h2>
                <p className="mt-1 text-sm text-slate-500">Lectura rápida del flujo comercial.</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.07] px-3 py-2 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300/70">
                  Total
                </p>
                <p className="text-xl font-black text-cyan-100">{leadsRows.length}</p>
              </div>
            </div>

            <div className="space-y-4">
              {pipeline.map((step, index) => (
                <PipelineStep
                  key={step.label}
                  label={step.label}
                  value={step.value}
                  index={index}
                />
              ))}
            </div>

            <Link
              href="/leads"
              className="mt-6 inline-flex items-center gap-2 text-xs font-black text-indigo-200 transition hover:text-white"
            >
              Abrir pipeline comercial
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 2xl:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-slate-950/50 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-amber-200">
                  <Clock size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Prioridad de hoy
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">Pendientes importantes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lo que merece atención antes de convertirse en ruido operativo.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-black text-slate-400">
                {pendingRows.length} abiertos
              </span>
            </div>

            <div className="divide-y divide-white/[0.07]">
              {priorityRows.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                    <CheckSquare size={20} />
                  </div>
                  <p className="mt-4 font-black text-white">Sin pendientes visibles</p>
                  <p className="mt-1 text-sm text-slate-500">La bandeja crítica está limpia.</p>
                </div>
              ) : (
                priorityRows.map((row) => (
                  <div
                    key={`${row.table}-${row.id}`}
                    className="group grid gap-4 px-5 py-4 transition hover:bg-white/[0.025] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${getPriorityDot(row)}`} />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={String(row.moduleHref)}
                            className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-300 hover:text-white"
                          >
                            {String(row.moduleLabel)}
                          </Link>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${getBadgeClass(
                              getStatus(row)
                            )}`}
                          >
                            {getStatus(row).replaceAll("_", " ")}
                          </span>
                        </div>

                        <p className="mt-1 truncate font-black text-slate-100">
                          {getRecordTitle(row)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Responsable: {getUserName(
                            row.assigned_to || row.responsible_id || row.validated_by,
                            profilesMap
                          )}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={String(row.moduleHref)}
                      className="inline-flex items-center gap-2 text-xs font-black text-slate-500 transition group-hover:text-indigo-200"
                    >
                      Abrir
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-emerald-200">
                  <Activity size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Equipo
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">Actividad por usuario</h2>
                <p className="mt-1 text-sm text-slate-500">Carga creada y asignada.</p>
              </div>

              {isAdmin && (
                <Link
                  href="/usuarios"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-200 transition hover:bg-indigo-500/20"
                  title="Usuarios y roles"
                >
                  <ShieldCheck size={17} />
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {userStats.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Sin usuarios para mostrar.</p>
              ) : (
                userStats.map((item, index) => (
                  <div
                    key={item.profile.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-cyan-500/10 text-sm font-black text-indigo-100">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-white">
                            {item.profile.full_name || "Sin nombre"}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {item.profile.email || "Sin correo"}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full border border-indigo-400/15 bg-indigo-500/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-indigo-200">
                        {item.profile.role || "sin rol"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white/[0.025] p-2 text-center">
                        <p className="text-lg font-black text-white">{item.created}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Creados</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.025] p-2 text-center">
                        <p className="text-lg font-black text-white">{item.assigned}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Asignados</p>
                      </div>
                      <div className="rounded-xl border border-indigo-400/10 bg-indigo-500/[0.045] p-2 text-center">
                        <p className="text-lg font-black text-indigo-100">{item.total}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/50">Total</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-slate-950/50 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-indigo-200">
                <LayoutDashboard size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Live feed
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">Últimos movimientos visibles</h2>
              <p className="mt-1 text-sm text-slate-500">
                Una lectura compacta de los cambios más recientes en la operación.
              </p>
            </div>

            {canManage && (
              <Link href="/actividad" className="crm-button-secondary">
                Ver actividad completa
                <ArrowRight size={14} />
              </Link>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 sm:px-6">
                    Módulo
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 sm:px-6">
                    Registro
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 sm:px-6">
                    Creado por
                  </th>
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 sm:px-6">
                    Fecha
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.07]">
                {recentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-14 text-center text-slate-500">
                      Todavía no hay movimientos visibles.
                    </td>
                  </tr>
                ) : (
                  recentRows.map((row) => (
                    <tr
                      key={`${row.table}-${row.id}`}
                      className="transition hover:bg-indigo-500/[0.025]"
                    >
                      <td className="px-5 py-4 sm:px-6">
                        <Link
                          href={String(row.moduleHref)}
                          className="inline-flex items-center gap-2 font-black text-indigo-200 hover:text-white"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,.6)]" />
                          {String(row.moduleLabel)}
                        </Link>
                      </td>

                      <td className="max-w-xs truncate px-5 py-4 font-bold text-slate-200 sm:px-6">
                        {getRecordTitle(row)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-400 sm:px-6">
                        {getUserName(row.created_by || row.user_id, profilesMap)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500 sm:px-6">
                        {formatDate(getRecordDate(row))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col justify-between gap-4 rounded-[1.7rem] border border-white/10 bg-gradient-to-r from-indigo-500/[0.07] via-white/[0.025] to-cyan-500/[0.06] p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-200">
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="font-black text-white">CRM Command Center</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {systemHealthy
                  ? "Todos los módulos consultados respondieron correctamente."
                  : "El dashboard está operativo, pero existen módulos que conviene revisar."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5">
              {totalRecords} registros
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5">
              {activeUsers} usuarios activos
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5">
              {healthyModules} módulos online
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
