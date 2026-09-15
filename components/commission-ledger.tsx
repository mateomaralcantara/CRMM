"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Loader2, RefreshCw, WalletCards } from "lucide-react";

type Commission = {
  id: string;
  affiliate_name: string | null;
  sale_title: string | null;
  payment_id: string | null;
  responsible_name: string | null;
  business_unit: string | null;
  basis_amount: number | null;
  rate: number | null;
  amount: number | null;
  status: string | null;
  origin: string | null;
  created_at: string | null;
};

function money(value: unknown) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function CommissionLedger() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Commission[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const privileged = ["super_admin", "admin"].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const authR = await supabase.auth.getUser();
      const userId = authR.data.user?.id;
      const [rowsR, profileR] = await Promise.all([
        supabase
          .from("commission_financial_view")
          .select("id,affiliate_name,sale_title,payment_id,responsible_name,business_unit,basis_amount,rate,amount,status,origin,created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        userId
          ? supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (rowsR.error) setError(rowsR.error.message);
      else setRows((rowsR.data || []) as Commission[]);

      if (profileR.data?.role) setRole(String(profileR.data.role).toLowerCase());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setStatus(id: string, status: "aprobada" | "pagada") {
    if (!privileged) return;

    setSavingId(id);
    setError(null);
    try {
      const patch = status === "pagada"
        ? { status, approved_at: new Date().toISOString(), paid_at: new Date().toISOString() }
        : { status, approved_at: new Date().toISOString(), paid_at: null };

      const { error: updateError } = await supabase
        .from("commissions")
        .update(patch)
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingId(null);
    }
  }

  const total = rows
    .filter((row) => row.status !== "cancelada")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paid = rows
    .filter((row) => row.status === "pagada")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pending = rows
    .filter((row) => ["generada", "retenida", "aprobada"].includes(String(row.status)))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Ledger de comisiones</p>
            <h1 className="mt-2 text-3xl font-black text-white">Comisiones sobre dinero cobrado</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Las nuevas comisiones nacen del cobro real, no de una venta aún pendiente. Cada afiliado solo ve sus registros; admin y super_admin pueden aprobar y pagar.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="crm-button-secondary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Generadas</p><p className="mt-3 text-3xl font-black text-white">{money(total)}</p></article>
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Pendientes</p><p className="mt-3 text-3xl font-black text-amber-200">{money(pending)}</p></article>
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Pagadas</p><p className="mt-3 text-3xl font-black text-emerald-200">{money(paid)}</p></article>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="crm-card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-black text-white">Detalle trazable</h2>
          <p className="mt-1 text-xs text-slate-500">Base cobrada → tasa → comisión.</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando comisiones…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No hay comisiones visibles para esta cuenta.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Afiliado</th>
                  <th className="p-4">Venta</th>
                  <th className="p-4">Responsable</th>
                  <th className="p-4">Unidad</th>
                  <th className="p-4 text-right">Base cobrada</th>
                  <th className="p-4 text-right">Tasa</th>
                  <th className="p-4 text-right">Comisión</th>
                  <th className="p-4">Estado</th>
                  {privileged ? <th className="p-4">Gestión</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06] text-slate-300">
                    <td className="p-4 font-bold text-white">{row.affiliate_name || "Afiliado"}</td>
                    <td className="p-4">{row.sale_title || "Venta"}</td>
                    <td className="p-4">{row.responsible_name || "—"}</td>
                    <td className="p-4">{row.business_unit || "—"}</td>
                    <td className="p-4 text-right">{money(row.basis_amount)}</td>
                    <td className="p-4 text-right">{Number(row.rate || 0).toFixed(2)}%</td>
                    <td className="p-4 text-right font-black text-amber-200">{money(row.amount)}</td>
                    <td className="p-4">{row.status || "—"}</td>
                    {privileged ? (
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {row.status !== "pagada" ? (
                            <button
                              type="button"
                              onClick={() => void setStatus(row.id, "aprobada")}
                              disabled={savingId === row.id}
                              className="inline-flex items-center gap-1 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-200"
                            >
                              <CheckCircle2 size={14} /> Aprobar
                            </button>
                          ) : null}
                          {row.status === "aprobada" ? (
                            <button
                              type="button"
                              onClick={() => void setStatus(row.id, "pagada")}
                              disabled={savingId === row.id}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200"
                            >
                              <WalletCards size={14} /> Pagar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
