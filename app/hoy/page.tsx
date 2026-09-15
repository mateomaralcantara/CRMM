import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Banknote,
  FileSignature,
  Flame,
  PhoneCall,
  Target,
  UserCheck,
} from "lucide-react";

type Row = Record<string, unknown>;

function s(value: unknown) {
  return String(value || "").trim();
}

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

function titleOf(row: Row) {
  return s(row.title || row.name || row.email || "Registro");
}

function formatDate(value: unknown) {
  if (!value) return "Sin fecha";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Flame;
  children: React.ReactNode;
}) {
  return (
    <section className="crm-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/10 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-200">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="font-black text-white">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

function RowLink({
  href,
  eyebrow,
  title,
  detail,
}: {
  href: string;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 hover:bg-white/[0.05]"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-300">{eyebrow}</p>
        <p className="mt-1 truncate font-black text-white">{title}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
      </div>
      <ArrowRight size={16} className="shrink-0 text-slate-600 group-hover:text-white" />
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
      {children}
    </div>
  );
}

export default async function TodayPage() {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) redirect("/login");

  const settled = await Promise.allSettled([
    supabase
      .from("leads")
      .select("id,name,email,status,next_action,next_action_at,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("opportunities")
      .select("id,title,stage,next_action,next_action_at,opportunity_value,outstanding_balance,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("sales")
      .select("id,title,amount,outstanding_balance,status,payment_status,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("quotes")
      .select("id,title,total,status,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("service_requests")
      .select("id,title,status,priority,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const rowsAt = (index: number): Row[] => {
    const result = settled[index];
    if (!result || result.status === "rejected" || result.value.error) return [];
    return (result.value.data || []) as unknown as Row[];
  };

  const leads = rowsAt(0);
  const opportunities = rowsAt(1);
  const sales = rowsAt(2);
  const quotes = rowsAt(3);
  const requests = rowsAt(4);

  const hasPartialFailure = settled.some(
    (result) => result.status === "rejected" || Boolean(result.value.error)
  );

  const now = Date.now();
  const pipeline = opportunities.length ? opportunities : leads;

  const followups = pipeline
    .filter((row) => {
      const stage = s(row.stage || row.status).toLowerCase();
      if (["finalizado", "referido_upsell", "perdido"].includes(stage)) return false;
      const raw = s(row.next_action_at);
      return raw && new Date(raw).getTime() <= now;
    })
    .sort(
      (a, b) =>
        new Date(s(a.next_action_at)).getTime() - new Date(s(b.next_action_at)).getTime()
    )
    .slice(0, 10);

  const collections = sales
    .map((sale) => ({ sale, balance: Math.max(n(sale.outstanding_balance), 0) }))
    .filter((item) => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const proposals = quotes
    .filter((quote) => ["borrador", "enviada"].includes(s(quote.status).toLowerCase()))
    .slice(0, 10);

  const service = requests
    .filter((request) => !["completado", "cancelado"].includes(s(request.status).toLowerCase()))
    .sort((a, b) => {
      const score = (row: Row) => {
        const priority = s(row.priority).toLowerCase();
        if (priority === "urgente") return 4;
        if (priority === "alta") return 3;
        if (priority === "media") return 2;
        return 1;
      };
      return score(b) - score(a);
    })
    .slice(0, 10);

  return (
    <AppShell>
      <div className="space-y-6">
        {hasPartialFailure ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            Parte de la información no respondió. El CRM cargó el resto de los datos disponibles; puedes actualizar para completar la vista.
          </div>
        ) : null}

        <section className="crm-hero p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-300/15 bg-orange-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-orange-200">
                <Flame size={14} />
                HOY
              </div>
              <h1 className="crm-gradient-title text-4xl font-black">Agenda comercial de hoy</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                A quién llamar, cobrar, seguir y atender. La vista prioriza lo urgente sin descargar miles de registros.
              </p>
            </div>
            <Link href="/oportunidades" className="crm-button-primary">
              <Target size={17} />
              Ver pipeline
            </Link>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Seguimientos" subtitle={`${followups.length} acciones vencidas o para ahora`} icon={PhoneCall}>
            {followups.length ? (
              followups.map((row) => (
                <RowLink
                  key={s(row.id)}
                  href={opportunities.length ? "/oportunidades" : "/leads"}
                  eyebrow="Seguimiento"
                  title={titleOf(row)}
                  detail={`${s(row.next_action) || "Dar seguimiento"} · ${formatDate(row.next_action_at)}`}
                />
              ))
            ) : (
              <Empty>No hay seguimientos vencidos.</Empty>
            )}
          </Section>

          <Section title="Cobros" subtitle={`${collections.length} ventas con saldo pendiente`} icon={Banknote}>
            {collections.length ? (
              collections.map(({ sale, balance }) => (
                <RowLink
                  key={s(sale.id)}
                  href="/ventas"
                  eyebrow="Cobro"
                  title={titleOf(sale)}
                  detail={`Saldo pendiente ${money(balance)}`}
                />
              ))
            ) : (
              <Empty>No hay cobros pendientes detectados.</Empty>
            )}
          </Section>

          <Section title="Propuestas" subtitle={`${proposals.length} propuestas abiertas`} icon={FileSignature}>
            {proposals.length ? (
              proposals.map((quote) => (
                <RowLink
                  key={s(quote.id)}
                  href="/cotizaciones"
                  eyebrow="Propuesta"
                  title={titleOf(quote)}
                  detail={`${money(n(quote.total))} · ${s(quote.status) || "sin estado"}`}
                />
              ))
            ) : (
              <Empty>No hay propuestas pendientes.</Empty>
            )}
          </Section>

          <Section title="Servicio" subtitle={`${service.length} solicitudes activas prioritarias`} icon={UserCheck}>
            {service.length ? (
              service.map((request) => (
                <RowLink
                  key={s(request.id)}
                  href="/solicitudes"
                  eyebrow={s(request.priority) || "Solicitud"}
                  title={titleOf(request)}
                  detail={s(request.status) || "sin estado"}
                />
              ))
            ) : (
              <Empty>No hay solicitudes activas prioritarias.</Empty>
            )}
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
