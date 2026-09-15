"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, RefreshCw, TrendingUp } from "lucide-react";

type ClientRow = {
  id: string;
  name: string | null;
  affiliate_id: string | null;
};

type AffiliateRow = {
  id: string;
  name: string | null;
};

type ResponsibleRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SaleRow = {
  id: string;
  title: string | null;
  client_id: string | null;
  affiliate_id: string | null;
  responsible_id: string | null;
  business_unit: string | null;
  amount: number | null;
  collected_amount: number | null;
  outstanding_balance: number | null;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

const units = [
  ["migrapro", "MigraPro"],
  ["tributario", "Tributario"],
  ["genelibros", "GeneLibros"],
  ["libroseller", "LibroSeller"],
  ["b2b", "Marketing / B2B"],
  ["ia_capacitaciones", "IA / Capacitaciones"],
];

function money(value: unknown) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function SalesFinancialModule({ currentRole }: { currentRole: string }) {
  const supabase = useMemo(() => createClient(), []);
  const privileged = ["super_admin", "admin"].includes(currentRole);

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [responsibles, setResponsibles] = useState<ResponsibleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const requests = [
        supabase
          .from("sales")
          .select("id,title,client_id,affiliate_id,responsible_id,business_unit,amount,collected_amount,outstanding_balance,status,payment_status,created_at")
          .order("created_at", { ascending: false })
          .limit(250),
        supabase.from("clients").select("id,name,affiliate_id").order("name", { ascending: true }).limit(500),
        supabase.from("affiliates").select("id,name").order("name", { ascending: true }).limit(500),
      ] as const;

      const [salesR, clientsR, affiliatesR] = await Promise.all(requests);

      if (salesR.error) setError(salesR.error.message);
      else setSales((salesR.data || []) as SaleRow[]);

      if (clientsR.error) setError((current) => current || clientsR.error.message);
      else setClients((clientsR.data || []) as ClientRow[]);

      if (!affiliatesR.error) setAffiliates((affiliatesR.data || []) as AffiliateRow[]);

      if (privileged) {
        const profilesR = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("role", ["admin", "supervisor", "responsable", "vendedor"])
          .in("status", ["activo", "active"])
          .order("full_name", { ascending: true });

        if (!profilesR.error) setResponsibles((profilesR.data || []) as ResponsibleRow[]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [privileged, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const form = new FormData(event.currentTarget);
      const amount = Number(form.get("amount") || 0);
      if (amount <= 0) {
        setError("El monto vendido debe ser mayor que cero.");
        return;
      }

      const payload: Record<string, unknown> = {
        title: String(form.get("title") || "Venta"),
        client_id: String(form.get("client_id") || "") || null,
        business_unit: String(form.get("business_unit") || ""),
        amount,
        status: String(form.get("status") || "abierta"),
        notes: String(form.get("notes") || "") || null,
      };

      if (privileged) {
        const responsibleId = String(form.get("responsible_id") || "");
        if (responsibleId) payload.responsible_id = responsibleId;
      }

      const { error: insertError } = await supabase.from("sales").insert(payload);
      if (insertError) {
        setError(insertError.message);
        return;
      }

      event.currentTarget.reset();
      setSelectedClientId("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  const clientMap = new Map(clients.map((row) => [row.id, row]));
  const affiliateMap = new Map(affiliates.map((row) => [row.id, row.name || "Afiliado"]));
  const responsibleMap = new Map(
    responsibles.map((row) => [row.id, row.full_name || row.email || "Responsable"])
  );

  const selectedClient = selectedClientId ? clientMap.get(selectedClientId) : null;
  const selectedAffiliate = selectedClient?.affiliate_id
    ? affiliateMap.get(selectedClient.affiliate_id)
    : null;

  const visibleSold = sales
    .filter((row) => !["perdida", "cancelada"].includes(String(row.status)))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const visibleCollected = sales.reduce((sum, row) => sum + Number(row.collected_amount || 0), 0);
  const visiblePending = sales.reduce((sum, row) => sum + Number(row.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">Ventas atribuidas</p>
            <h1 className="mt-2 text-3xl font-black text-white">Venta → cliente → afiliado → cobro</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              La venta representa dinero comprometido. El ingreso real solo nace al registrar un pago. El afiliado se hereda del cliente y el responsable queda protegido por la base de datos.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="crm-button-secondary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Vendido visible</p><p className="mt-3 text-3xl font-black text-white">{money(visibleSold)}</p></article>
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Cobrado visible</p><p className="mt-3 text-3xl font-black text-emerald-200">{money(visibleCollected)}</p></article>
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Por cobrar</p><p className="mt-3 text-3xl font-black text-amber-200">{money(visiblePending)}</p></article>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="crm-card p-6">
        <h2 className="text-xl font-black text-white">Crear venta</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div><label>Título *</label><input name="title" required placeholder="Ej. Consulta migratoria Juan Pérez" /></div>
          <div>
            <label>Cliente *</label>
            <select name="client_id" required defaultValue="" onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="" disabled>Seleccionar cliente</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name || "Cliente"}</option>)}
            </select>
            {selectedClientId ? (
              <p className="mt-2 text-xs text-slate-500">
                Afiliado heredado: <span className="font-bold text-slate-300">{selectedAffiliate || "Sin afiliado"}</span>
              </p>
            ) : null}
          </div>
          <div>
            <label>Unidad de negocio *</label>
            <select name="business_unit" required defaultValue="">
              <option value="" disabled>Seleccionar unidad</option>
              {units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div><label>Monto vendido *</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div>
            <label>Estado</label>
            <select name="status" defaultValue="abierta">
              <option value="abierta">Abierta</option>
              <option value="ganada">Ganada</option>
              <option value="perdida">Perdida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          {privileged ? (
            <div>
              <label>Responsable</label>
              <select name="responsible_id" defaultValue="">
                <option value="">Sin asignar</option>
                {responsibles.map((row) => <option key={row.id} value={row.id}>{row.full_name || row.email || "Responsable"}</option>)}
              </select>
            </div>
          ) : null}
          <div className="md:col-span-2 xl:col-span-3"><label>Notas</label><textarea name="notes" rows={3} /></div>
          <div className="md:col-span-2 xl:col-span-3">
            <button type="submit" disabled={saving} className="crm-button-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? "Guardando…" : "Crear venta"}
            </button>
          </div>
        </form>
      </section>

      <section className="crm-card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3"><TrendingUp size={20} className="text-sky-300" /><h2 className="text-xl font-black text-white">Ventas visibles</h2></div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando ventas…</div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No hay ventas visibles para esta cuenta.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Venta / cliente</th><th className="p-4">Unidad</th><th className="p-4">Afiliado</th><th className="p-4">Responsable</th><th className="p-4 text-right">Vendido</th><th className="p-4 text-right">Cobrado</th><th className="p-4 text-right">Pendiente</th><th className="p-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const client = sale.client_id ? clientMap.get(sale.client_id) : null;
                  return (
                    <tr key={sale.id} className="border-b border-white/[0.06] text-slate-300">
                      <td className="p-4"><p className="font-black text-white">{sale.title || "Venta"}</p><p className="mt-1 text-xs text-slate-500">{client?.name || "Sin cliente"}</p></td>
                      <td className="p-4">{sale.business_unit || "—"}</td>
                      <td className="p-4">{sale.affiliate_id ? affiliateMap.get(sale.affiliate_id) || sale.affiliate_id.slice(0, 8) : "—"}</td>
                      <td className="p-4">{sale.responsible_id ? responsibleMap.get(sale.responsible_id) || sale.responsible_id.slice(0, 8) : "—"}</td>
                      <td className="p-4 text-right font-bold">{money(sale.amount)}</td>
                      <td className="p-4 text-right font-black text-emerald-200">{money(sale.collected_amount)}</td>
                      <td className="p-4 text-right font-black text-amber-200">{money(sale.outstanding_balance)}</td>
                      <td className="p-4">{sale.status || "—"} · {sale.payment_status || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
