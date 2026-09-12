import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Banknote,
  FileSignature,
  Flame,
  PhoneCall,
  Target,
  UserCheck
} from "lucide-react";

type Row = Record<string, unknown>;

function s(value: unknown) { return String(value || "").trim(); }
function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0
  }).format(value);
}
function titleOf(row: Row) {
  return s(row.title || row.name || row.subject || row.email || row.code || "Registro");
}
function formatDate(value: unknown) {
  if (!value) return "Sin fecha";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(d);
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children
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
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function TodayPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [leadsR, oppsR, salesR, paymentsR, quotesR, requestsR] = await Promise.all([
    supabase.from("leads").select("*").limit(1000),
    supabase.from("opportunities").select("*").limit(1000),
    supabase.from("sales").select("*").limit(1000),
    supabase.from("payments").select("*").limit(2000),
    supabase.from("quotes").select("*").limit(1000),
    supabase.from("service_requests").select("*").limit(1000)
  ]);

  const leads = (leadsR.data || []) as Row[];
  const opps = (oppsR.data || []) as Row[];
  const sales = (salesR.data || []) as Row[];
  const payments = (paymentsR.data || []) as Row[];
  const quotes = (quotesR.data || []) as Row[];
  const requests = (requestsR.data || []) as Row[];
  const now = Date.now();

  const pipeline = opps.length ? opps : leads;
  const followups = pipeline
    .filter((r) => {
      const stage = s(r.stage || r.status).toLowerCase();
      if (["finalizado","referido_upsell","perdido"].includes(stage)) return false;
      const raw = s(r.next_action_at || r.next_follow_up);
      return raw && new Date(raw).getTime() <= now;
    })
    .sort((a, b) =>
      new Date(s(a.next_action_at || a.next_follow_up)).getTime() -
      new Date(s(b.next_action_at || b.next_follow_up)).getTime()
    );

  const collected = new Map<string, number>();
  payments
    .filter((p) => ["parcial","completado"].includes(s(p.status).toLowerCase()))
    .forEach((p) => {
      const saleId = s(p.sale_id);
      if (saleId) collected.set(saleId, (collected.get(saleId) || 0) + n(p.amount));
    });

  const collections = sales
    .map((sale) => {
      const balance = sale.outstanding_balance !== undefined && sale.outstanding_balance !== null
        ? n(sale.outstanding_balance)
        : Math.max(n(sale.amount) - (collected.get(s(sale.id)) || 0), 0);
      return { sale, balance };
    })
    .filter((x) => x.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const proposals = quotes.filter((q) =>
    ["borrador","enviada"].includes(s(q.status).toLowerCase())
  );

  const service = requests
    .filter((r) => !["completado","cancelado"].includes(s(r.status).toLowerCase()))
    .sort((a, b) => {
      const score = (r: Row) => s(r.priority) === "urgente" ? 4 : s(r.priority) === "alta" ? 3 : 1;
      return score(b) - score(a);
    });

  const RowLink = ({
    href,
    eyebrow,
    title,
    detail
  }: {
    href: string;
    eyebrow: string;
    title: string;
    detail: string;
  }) => (
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

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="crm-hero p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-300/15 bg-orange-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-orange-200">
                <Flame size={14} />
                HOY
              </div>
              <h1 className="crm-gradient-title text-4xl font-black">Agenda comercial de hoy</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                A quién llamar, cobrar, seguir y atender. Sin perder tiempo buscando.
              </p>
            </div>
            <Link href="/oportunidades" className="crm-button-primary">
              <Target size={17} />
              Ver pipeline
            </Link>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title={`Seguimientos (${followups.length})`} subtitle="Acciones vencidas o para ahora." icon={PhoneCall}>
            <div className="space-y-3">
              {followups.length ? followups.slice(0, 20).map((row, i) => (
                <RowLink
                  key={`${s(row.id)}-${i}`}
                  href={opps.length ? "/oportunidades" : "/leads"}
                  eyebrow={s(row.business_unit) || "seguimiento"}
                  title={titleOf(row)}
                  detail={`${s(row.next_action) || "Dar seguimiento"} · ${formatDate(row.next_action_at || row.next_follow_up)}`}
                />
              )) : <p className="text-sm text-slate-500">No hay seguimientos vencidos.</p>}
            </div>
          </Section>

          <Section title={`Cobros (${collections.length})`} subtitle="Ventas con dinero pendiente de entrar." icon={Banknote}>
            <div className="space-y-3">
              {collections.length ? collections.slice(0, 20).map(({ sale, balance }, i) => (
                <RowLink
                  key={`${s(sale.id)}-${i}`}
                  href="/ventas"
                  eyebrow="cobrar"
                  title={titleOf(sale)}
                  detail={`Saldo pendiente ${money(balance)}`}
                />
              )) : <p className="text-sm text-slate-500">No hay saldos pendientes.</p>}
            </div>
          </Section>

          <Section title={`Propuestas (${proposals.length})`} subtitle="Cotizaciones que todavía requieren movimiento." icon={FileSignature}>
            <div className="space-y-3">
              {proposals.length ? proposals.slice(0, 20).map((quote, i) => (
                <RowLink
                  key={`${s(quote.id)}-${i}`}
                  href="/cotizaciones"
                  eyebrow={s(quote.status)}
                  title={titleOf(quote)}
                  detail={`${money(n(quote.total))} · vence ${formatDate(quote.expires_at)}`}
                />
              )) : <p className="text-sm text-slate-500">No hay propuestas abiertas.</p>}
            </div>
          </Section>

          <Section title={`Clientes por atender (${service.length})`} subtitle="Solicitudes abiertas priorizadas." icon={UserCheck}>
            <div className="space-y-3">
              {service.length ? service.slice(0, 20).map((row, i) => (
                <RowLink
                  key={`${s(row.id)}-${i}`}
                  href="/solicitudes"
                  eyebrow={s(row.priority) || "cliente"}
                  title={titleOf(row)}
                  detail={`Estado: ${s(row.status).replaceAll("_", " ")}`}
                />
              )) : <p className="text-sm text-slate-500">No hay solicitudes abiertas.</p>}
            </div>
          </Section>
        </div>

        {oppsR.error ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            Ejecuta <code>supabase/reto-111-specialization.sql</code> para activar oportunidades.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
