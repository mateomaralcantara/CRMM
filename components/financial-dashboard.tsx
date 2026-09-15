import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { currency } from "@/lib/utils";
import {
  BadgeDollarSign,
  Banknote,
  CircleDollarSign,
  HandCoins,
  Receipt,
  TrendingUp,
} from "lucide-react";

type FinancialRow = {
  id: string;
  sale_title: string | null;
  client_name: string | null;
  affiliate_name: string | null;
  responsible_name: string | null;
  business_unit: string | null;
  amount: number | null;
  status: string | null;
  method: string | null;
  occurred_at: string | null;
};

type SaleRow = {
  id: string;
  amount: number | null;
  collected_amount: number | null;
  outstanding_balance: number | null;
  status: string | null;
  business_unit: string | null;
};

type CommissionRow = {
  id: string;
  amount: number | null;
  status: string | null;
  business_unit: string | null;
};

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function roleTitle(role: string) {
  if (["super_admin", "admin"].includes(role)) return "Finanzas globales";
  if (["afiliado", "promotor"].includes(role)) return "Mi panel financiero de afiliado";
  if (["responsable", "vendedor"].includes(role)) return "Mi gestión financiera";
  return "Mi actividad financiera";
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Banknote;
}) {
  return (
    <article className="crm-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-500/10 text-emerald-200">
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

export async function FinancialDashboard({ compact = false }: { compact?: boolean }) {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()]);
  const role = String(profile?.role || "").toLowerCase();
  const privileged = ["super_admin", "admin"].includes(role);

  const [transactionsR, salesR, commissionsR] = await Promise.all([
    supabase
      .from("financial_transactions_view")
      .select(
        "id,sale_title,client_name,affiliate_name,responsible_name,business_unit,amount,status,method,occurred_at"
      )
      .eq("status", "posted")
      .order("occurred_at", { ascending: false })
      .limit(250),
    supabase
      .from("sales")
      .select("id,amount,collected_amount,outstanding_balance,status,business_unit")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("commission_financial_view")
      .select("id,amount,status,business_unit")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const transactions = (transactionsR.data || []) as FinancialRow[];
  const sales = (salesR.data || []) as SaleRow[];
  const commissions = (commissionsR.data || []) as CommissionRow[];

  const activeSales = sales.filter(
    (sale) => !["perdida", "cancelada"].includes(String(sale.status || ""))
  );

  const sold = sum(activeSales.map((sale) => sale.amount));
  const collected = sum(transactions.map((row) => row.amount));
  const receivable = sum(activeSales.map((sale) => sale.outstanding_balance));
  const commissionGenerated = sum(
    commissions
      .filter((row) => ["generada", "retenida", "aprobada", "pagada"].includes(String(row.status)))
      .map((row) => row.amount)
  );
  const commissionPaid = sum(
    commissions.filter((row) => row.status === "pagada").map((row) => row.amount)
  );
  const commissionPending = sum(
    commissions
      .filter((row) => ["generada", "retenida", "aprobada"].includes(String(row.status)))
      .map((row) => row.amount)
  );

  const byUnit = new Map<string, number>();
  for (const transaction of transactions) {
    const unit = transaction.business_unit || "sin_unidad";
    byUnit.set(unit, (byUnit.get(unit) || 0) + Number(transaction.amount || 0));
  }

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              {privileged ? "Control financiero" : "Vista privada · solo tus datos"}
            </p>
            <h1 className="mt-2 text-3xl font-black text-white lg:text-4xl">{roleTitle(role)}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              El ingreso real nace en Pagos. Ventas muestra lo comprometido; caja muestra lo cobrado; el saldo pendiente y las comisiones se actualizan desde el mismo flujo.
            </p>
          </div>

          {!compact ? (
            <div className="flex flex-wrap gap-3">
              <Link href="/pagos" className="crm-button-primary">Registrar / ver cobros</Link>
              <Link href="/comisiones" className="crm-button-secondary">Comisiones</Link>
            </div>
          ) : null}
        </div>
      </section>

      {(transactionsR.error || salesR.error || commissionsR.error) ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Una fuente financiera no respondió. La vista muestra únicamente los datos que pudieron verificarse.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric label="Vendido" value={currency(sold)} hint="Dinero comprometido en ventas visibles para tu rol." icon={TrendingUp} />
        <Metric label="Cobrado real" value={currency(collected)} hint="Dinero efectivamente recibido y contabilizado." icon={Banknote} />
        <Metric label="Por cobrar" value={currency(receivable)} hint="Saldo vivo de las ventas visibles." icon={Receipt} />
        <Metric label="Comisión generada" value={currency(commissionGenerated)} hint="Comisión atribuida al dinero cobrado." icon={CircleDollarSign} />
        <Metric label="Comisión pagada" value={currency(commissionPaid)} hint="Comisiones marcadas como pagadas." icon={HandCoins} />
        <Metric label="Comisión pendiente" value={currency(commissionPending)} hint="Generada, retenida o aprobada pendiente." icon={BadgeDollarSign} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="crm-card overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-black text-white">Últimos ingresos contabilizados</h2>
            <p className="mt-1 text-xs text-slate-500">
              {privileged ? "Vista global según RLS." : "Solo movimientos propios, asignados o atribuidos."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Venta / cliente</th>
                  <th className="p-4">Unidad</th>
                  <th className="p-4">Responsable</th>
                  <th className="p-4">Afiliado</th>
                  <th className="p-4 text-right">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, compact ? 8 : 25).map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06] text-slate-300">
                    <td className="p-4">{row.occurred_at ? new Date(row.occurred_at).toLocaleString("es-DO") : "—"}</td>
                    <td className="p-4">
                      <p className="font-bold text-white">{row.sale_title || "Venta"}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.client_name || "Sin cliente"}</p>
                    </td>
                    <td className="p-4">{row.business_unit || "—"}</td>
                    <td className="p-4">{row.responsible_name || "—"}</td>
                    <td className="p-4">{row.affiliate_name || "—"}</td>
                    <td className="p-4 text-right font-black text-emerald-200">{currency(Number(row.amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Todavía no hay ingresos reales visibles para esta cuenta.</div>
            ) : null}
          </div>
        </div>

        <div className="crm-card p-5">
          <h2 className="text-xl font-black text-white">Cobrado por unidad</h2>
          <p className="mt-1 text-xs text-slate-500">Distribución basada en pagos reales.</p>
          <div className="mt-5 space-y-3">
            {[...byUnit.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([unit, amount]) => (
                <div key={unit} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-slate-300">{unit}</span>
                    <span className="font-black text-white">{currency(amount)}</span>
                  </div>
                </div>
              ))}
            {byUnit.size === 0 ? <p className="text-sm text-slate-500">Sin movimientos por unidad.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
