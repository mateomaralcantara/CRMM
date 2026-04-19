import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { createClient } from "@/lib/supabase/server";
import { currency } from "@/lib/utils";
import { BadgeDollarSign, Handshake, LifeBuoy, ShoppingCart, Users } from "lucide-react";

async function countWhere(table: string, column?: string, value?: string) {
  const supabase = createClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });

  if (column && value) {
    query = query.eq(column, value);
  }

  const { count } = await query;
  return count || 0;
}

async function sumSalesByStatus(status: string) {
  const supabase = createClient();
  const { data } = await supabase.from("sales").select("amount").eq("status", status);
  return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

async function sumCommissionsByStatus(status: string) {
  const supabase = createClient();
  const { data } = await supabase.from("commissions").select("amount").eq("status", status);
  return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export default async function ReportesPage() {
  const [
    activeClients,
    activeAffiliates,
    openTickets,
    wonSales,
    lostSales,
    wonRevenue,
    pendingCommissions,
    paidCommissions
  ] = await Promise.all([
    countWhere("clients", "status", "activo"),
    countWhere("affiliates", "status", "activo"),
    countWhere("tickets", "status", "abierto"),
    countWhere("sales", "status", "ganada"),
    countWhere("sales", "status", "perdida"),
    sumSalesByStatus("ganada"),
    sumCommissionsByStatus("aprobada"),
    sumCommissionsByStatus("pagada")
  ]);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Reportes</h1>
        <p className="mt-2 text-slate-400">
          Métricas rápidas para revisar ventas, afiliados, tickets y comisiones.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Clientes activos" value={activeClients} icon={Users} />
        <StatCard title="Afiliados activos" value={activeAffiliates} icon={Handshake} />
        <StatCard title="Tickets abiertos" value={openTickets} icon={LifeBuoy} />
        <StatCard title="Ventas ganadas" value={wonSales} icon={ShoppingCart} />
        <StatCard title="Ventas perdidas" value={lostSales} icon={ShoppingCart} />
        <StatCard title="Ingresos ganados" value={currency(wonRevenue)} icon={BadgeDollarSign} />
        <StatCard title="Comisiones aprobadas" value={currency(pendingCommissions)} icon={BadgeDollarSign} />
        <StatCard title="Comisiones pagadas" value={currency(paidCommissions)} icon={BadgeDollarSign} />
      </div>
    </AppShell>
  );
}
