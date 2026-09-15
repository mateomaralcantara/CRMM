import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileSignature,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

type Row = Record<string, unknown>;

const pipelineStages = [
  "nuevo",
  "contactado",
  "respondio",
  "calificado",
  "consulta",
  "propuesta",
  "negociacion",
  "pago_pendiente",
  "ganado",
  "en_ejecucion",
  "finalizado",
  "referido_upsell",
] as const;

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

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function titleOf(row: Row) {
  return s(row.title || row.name || row.email || "Registro");
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
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
  const supabase = await createClient();

  const settled = await Promise.allSettled([
    supabase
      .from("leads")
      .select("id,name,email,business_unit,status,opportunity_value,next_action,next_action_at,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("opportunities")
      .select("id,title,business_unit,stage,opportunity_value,sold_amount,collected_amount,outstanding_balance,next_action,next_action_at,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("quotes")
      .select("id,title,business_unit,total,status,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("sales")
      .select("id,title,business_unit,amount,collected_amount,outstanding_balance,status,payment_status,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("payments")
      .select("id,sale_id,amount,status,paid_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rowsAt = (index: number): Row[] => {
    const result = settled[index];
    if (!result || result.status === "rejected" || result.value.error) return [];
    return (result.value.data || []) as unknown as Row[];
  };

  const leads = rowsAt(0);
  const opportunities = rowsAt(1);
  const quotes = rowsAt(2);
  const sales = rowsAt(3);
  const payments = rowsAt(4);

  const hasPartialFailure = settled.some(
    (result) => result.status === "rejected" || Boolean(result.value.error)
  );

  const validPayments = payments.filter((payment) =>
    ["parcial", "completado"].includes(s(payment.status).toLowerCase())
  );

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const paymentDate = (payment: Row) => s(payment.paid_at || payment.created_at);

  const cashToday = validPayments
    .filter((payment) => paymentDate(payment).slice(0, 10) === today)
    .reduce((sum, payment) => sum + n(payment.amount), 0);

  const cashMonth = validPayments
    .filter((payment) => paymentDate(payment).startsWith(month))
    .reduce((sum, payment) => sum + n(payment.amount), 0);

  const receivable = sales.reduce(
    (sum, sale) => sum + Math.max(n(sale.outstanding_balance), 0),
    0
  );

  const pipelineRows = opportunities.length ? opportunities : leads;
  const wonCount = pipelineRows.filter((row) =>
    ["ganado", "en_ejecucion", "finalizado", "referido_upsell"].includes(
      s(row.stage || row.status).toLowerCase()
    )
  ).length;

  const conversion = pipelineRows.length
    ? Math.round((wonCount / pipelineRows.length) * 100)
    : 0;

  const followUps = pipelineRows
    .filter((row) => {
      const stage = s(row.stage || row.status).toLowerCase();
      if (["finalizado", "referido_upsell", "perdido"].includes(stage)) return false;
      const raw = s(row.next_action_at);
      return raw && new Date(raw).getTime() <= now.getTime();
    })
    .sort(
      (a, b) =>
        new Date(s(a.next_action_at)).getTime() - new Date(s(b.next_action_at)).getTime()
    )
    .slice(0, 6);

  const openQuotes = quotes
    .filter((quote) => ["borrador", "enviada"].includes(s(quote.status).toLowerCase()))
    .slice(0, 4);

  const collectionTasks = sales
    .filter((sale) => n(sale.outstanding_balance) > 0)
    .sort((a, b) => n(b.outstanding_balance) - n(a.outstanding_balance))
    .slice(0, 4);

  const pipelineCounts = Object.fromEntries(
    pipelineStages.map((stage) => [
      stage,
      pipelineRows.filter((row) => s(row.stage || row.status).toLowerCase() === stage).length,
    ])
  ) as Record<string, number>;

  const todayTasks = [
    ...followUps.map((row) => ({
      type: "Seguimiento",
      title: titleOf(row),
      detail: s(row.next_action) || "Dar seguimiento",
      href: opportunities.length ? "/oportunidades" : "/leads",
      weight: 3,
    })),
    ...collectionTasks.map((sale) => ({
      type: "Cobro",
      title: titleOf(sale),
      detail: `Saldo ${money(n(sale.outstanding_balance))}`,
      href: "/ventas",
      weight: 2,
    })),
    ...openQuotes.map((quote) => ({
      type: "Propuesta",
      title: titleOf(quote),
      detail: `${money(n(quote.total))} · ${pretty(s(quote.status))}`,
      href: "/cotizaciones",
      weight: 1,
    })),
  ]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7);

  return (
    <>
      {hasPartialFailure ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Parte de los datos no respondió. El CRM cargó el resto de la información disponible.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Cobrado hoy" value={money(cashToday)} detail="Pagos registrados hoy." icon={Banknote} />
        <Metric label="Cobrado mes" value={money(cashMonth)} detail="Ingresos cobrados este mes." icon={CircleDollarSign} />
        <Metric label="Por cobrar" value={money(receivable)} detail="Saldo pendiente de ventas." icon={WalletCards} />
        <Metric label="Conversión" value={`${conversion}%`} detail={`${wonCount} oportunidades ganadas o avanzadas.`} icon={CheckCircle2} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Leads" value={String(leads.length)} detail="Últimos prospectos operativos." icon={Users} />
        <Metric label="Seguimientos" value={String(followUps.length)} detail="Acciones vencidas o para ahora." icon={CalendarClock} />
        <Metric label="Propuestas" value={String(openQuotes.length)} detail="Borradores y propuestas enviadas." icon={FileSignature} />
        <Metric label="Pipeline" value={String(pipelineRows.length)} detail="Oportunidades activas cargadas." icon={Target} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="crm-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">Pipeline</p>
              <h2 className="mt-2 text-2xl font-black text-white">Dónde está el dinero</h2>
            </div>
            <TrendingUp className="text-indigo-300" size={22} />
          </div>

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
                  key={`${item.type}-${item.title}-${index}`}
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
    </>
  );
}
