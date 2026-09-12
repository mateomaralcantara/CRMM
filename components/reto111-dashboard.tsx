import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileSignature,
  Flame,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  Zap
} from "lucide-react";

type Row = Record<string, unknown>;

const unitLabels: Record<string, string> = {
  migrapro: "MigraPro",
  tributario: "Tributario",
  genelibros: "GeneLibros",
  libroseller: "LibroSeller",
  b2b: "Marketing / B2B",
  ia_capacitaciones: "IA / Capacitaciones"
};

const pipelineStages = [
  "nuevo","contactado","respondio","calificado","consulta","propuesta",
  "negociacion","pago_pendiente","ganado","en_ejecucion","finalizado","referido_upsell"
];

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function s(value: unknown) {
  return String(value || "").trim();
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0
  }).format(value);
}

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function dateKey(input: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(input));

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function formatDate(value: unknown) {
  if (!value) return "Sin fecha";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function titleOf(row: Row) {
  return s(row.title || row.name || row.subject || row.email || row.code || "Registro");
}

function openPipeline(row: Row) {
  const stage = s(row.stage || row.status).toLowerCase();
  return !["finalizado","referido_upsell","perdido","cancelado","cancelada"].includes(stage);
}

function Metric({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
}) {
  return (
    <div className="crm-stat">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-indigo-300/10 bg-indigo-500/10 text-indigo-200">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export async function Reto111Dashboard() {
  const supabase = createClient();

  const [leadsR, opportunitiesR, quotesR, salesR, paymentsR] = await Promise.all([
    supabase.from("leads").select("*").limit(1000),
    supabase.from("opportunities").select("*").limit(1000),
    supabase.from("quotes").select("*").limit(1000),
    supabase.from("sales").select("*").limit(1000),
    supabase.from("payments").select("*").limit(2000)
  ]);

  const leads = (leadsR.data || []) as Row[];
  const opportunities = (opportunitiesR.data || []) as Row[];
  const quotes = (quotesR.data || []) as Row[];
  const sales = (salesR.data || []) as Row[];
  const payments = (paymentsR.data || []) as Row[];

  const now = new Date();
  const today = dateKey(now);
  const currentMonth = today.slice(0, 7);
  const todayStart = new Date(`${today}T00:00:00-04:00`);
  const weekday = todayStart.getDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - mondayOffset);

  const validPayments = payments.filter((p) =>
    ["parcial", "completado"].includes(s(p.status).toLowerCase())
  );
  const paymentDate = (p: Row) => s(p.paid_at || p.created_at);

  const cashToday = validPayments
    .filter((p) => paymentDate(p) && dateKey(paymentDate(p)) === today)
    .reduce((sum, p) => sum + n(p.amount), 0);

  const cashWeek = validPayments
    .filter((p) => {
      const raw = paymentDate(p);
      if (!raw) return false;
      const d = new Date(raw);
      return d >= weekStart && d <= now;
    })
    .reduce((sum, p) => sum + n(p.amount), 0);

  const cashMonth = validPayments
    .filter((p) => paymentDate(p) && dateKey(paymentDate(p)).startsWith(currentMonth))
    .reduce((sum, p) => sum + n(p.amount), 0);

  const collectedBySale = new Map<string, number>();
  validPayments.forEach((p) => {
    const id = s(p.sale_id);
    if (!id) return;
    collectedBySale.set(id, (collectedBySale.get(id) || 0) + n(p.amount));
  });

  const receivable = sales.reduce((sum, sale) => {
    if (sale.outstanding_balance !== undefined && sale.outstanding_balance !== null) {
      return sum + n(sale.outstanding_balance);
    }
    return sum + Math.max(n(sale.amount) - (collectedBySale.get(s(sale.id)) || 0), 0);
  }, 0);

  const openQuotes = quotes.filter((q) =>
    ["borrador", "enviada"].includes(s(q.status).toLowerCase())
  );

  const pipelineRows = opportunities.length > 0 ? opportunities : leads;

  const wonCount = pipelineRows.filter((r) =>
    ["ganado","en_ejecucion","finalizado","referido_upsell"].includes(
      s(r.stage || r.status).toLowerCase()
    )
  ).length;

  const conversion = pipelineRows.length
    ? Math.round((wonCount / pipelineRows.length) * 100)
    : 0;

  const followUps = pipelineRows
    .filter(openPipeline)
    .filter((row) => {
      const raw = s(row.next_action_at || row.next_follow_up);
      return raw && new Date(raw).getTime() <= now.getTime();
    })
    .sort((a, b) =>
      new Date(s(a.next_action_at || a.next_follow_up)).getTime() -
      new Date(s(b.next_action_at || b.next_follow_up)).getTime()
    );

  const pipelineCounts = Object.fromEntries(
    pipelineStages.map((stage) => [
      stage,
      pipelineRows.filter((r) => s(r.stage || r.status).toLowerCase() === stage).length
    ])
  ) as Record<string, number>;

  const unitStats = Object.keys(unitLabels).map((unit) => {
    const unitLeads = leads.filter((r) => s(r.business_unit) === unit).length;
    const unitSales = sales.filter((r) => s(r.business_unit) === unit);
    const sold = unitSales.reduce((sum, r) => sum + n(r.amount), 0);
    const saleIds = new Set(unitSales.map((r) => s(r.id)).filter(Boolean));
    const collected = validPayments
      .filter((p) => saleIds.has(s(p.sale_id)))
      .reduce((sum, p) => sum + n(p.amount), 0);

    return { unit, leads: unitLeads, sold, collected };
  });

  const collectionTasks = sales
    .filter((sale) => {
      const bal = sale.outstanding_balance !== undefined && sale.outstanding_balance !== null
        ? n(sale.outstanding_balance)
        : Math.max(n(sale.amount) - (collectedBySale.get(s(sale.id)) || 0), 0);
      return bal > 0;
    })
    .map((sale) => ({
      type: "Cobro",
      title: titleOf(sale),
      detail: `Saldo ${money(
        sale.outstanding_balance !== undefined && sale.outstanding_balance !== null
          ? n(sale.outstanding_balance)
          : Math.max(n(sale.amount) - (collectedBySale.get(s(sale.id)) || 0), 0)
      )}`,
      href: "/ventas",
      weight: 2
    }));

  const proposalTasks = openQuotes.map((quote) => ({
    type: "Propuesta",
    title: titleOf(quote),
    detail: `${money(n(quote.total))} · ${pretty(s(quote.status))}`,
    href: "/cotizaciones",
    weight: 3
  }));

  const followUpTasks = followUps.map((row) => ({
    type: "Seguimiento",
    title: titleOf(row),
    detail: `${s(row.next_action) || "Dar seguimiento"} · ${formatDate(row.next_action_at || row.next_follow_up)}`,
    href: opportunities.length > 0 ? "/oportunidades" : "/leads",
    weight: 4
  }));

  const todayTasks = [...followUpTasks, ...collectionTasks, ...proposalTasks]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7);

  return (
    <>
      <section className="crm-hero p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
              <span className="crm-status-dot" />
              Reto 111 · Centro comercial
            </div>
            <h1 className="crm-gradient-title text-4xl font-black tracking-tight lg:text-5xl">
              Dinero, seguimiento y ejecución.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              La capa comercial prioriza leads, oportunidades, propuestas, cobros,
              próximas acciones y conversión.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/hoy" className="crm-button-primary">
              <Flame size={17} />
              Abrir HOY
            </Link>
            <Link href="/oportunidades" className="crm-button-secondary">
              <Target size={17} />
              Pipeline
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Cobrado hoy" value={money(cashToday)} detail="Pagos registrados hoy." icon={Banknote} />
        <Metric label="Cobrado semana" value={money(cashWeek)} detail="Caja desde el lunes." icon={TrendingUp} />
        <Metric label="Cobrado mes" value={money(cashMonth)} detail="Ingresos cobrados este mes." icon={CircleDollarSign} />
        <Metric label="Por cobrar" value={money(receivable)} detail="Saldo pendiente de ventas." icon={WalletCards} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Leads" value={String(leads.length)} detail="Prospectos registrados." icon={Users} />
        <Metric label="Seguimientos" value={String(followUps.length)} detail="Acciones vencidas o para ahora." icon={CalendarClock} />
        <Metric label="Propuestas abiertas" value={String(openQuotes.length)} detail="Borradores y propuestas enviadas." icon={FileSignature} />
        <Metric label="Conversión" value={`${conversion}%`} detail={`${wonCount} oportunidades ganadas/avanzadas.`} icon={CheckCircle2} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="crm-card p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">Pipeline</p>
          <h2 className="mt-2 text-2xl font-black text-white">Dónde está el dinero</h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pipelineStages.map((stage) => (
              <div key={stage} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{pretty(stage)}</p>
                <p className="mt-2 text-2xl font-black text-white">{pipelineCounts[stage] || 0}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-card p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">HOY</p>
          <h2 className="mt-2 text-2xl font-black text-white">Prioridad comercial</h2>

          <div className="mt-5 space-y-3">
            {todayTasks.length === 0 ? (
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                No hay urgencias detectadas.
              </div>
            ) : (
              todayTasks.map((item, index) => (
                <Link
                  key={`${item.type}-${index}-${item.title}`}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.13em] text-indigo-300">{item.type}</p>
                    <p className="mt-1 truncate font-black text-white">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-slate-600 group-hover:text-white" />
                </Link>
              ))
            )}
          </div>

          <Link href="/hoy" className="crm-button-primary mt-5 w-full">
            <Zap size={16} />
            Ver agenda completa
          </Link>
        </div>
      </section>

      <section className="crm-card p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">Seis motores</p>
        <h2 className="mt-2 text-2xl font-black text-white">Unidades de negocio</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {unitStats.map((item) => (
            <div key={item.unit} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="font-black text-white">{unitLabels[item.unit]}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] uppercase text-slate-500">Leads</p>
                  <p className="mt-1 text-lg font-black text-white">{item.leads}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-slate-500">Vendido</p>
                  <p className="mt-1 text-sm font-black text-indigo-200">{money(item.sold)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-slate-500">Cobrado</p>
                  <p className="mt-1 text-sm font-black text-emerald-200">{money(item.collected)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {opportunitiesR.error ? (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          <strong>Falta activar Supabase:</strong> ejecuta <code>supabase/reto-111-specialization.sql</code>.
        </section>
      ) : null}
    </>
  );
}
