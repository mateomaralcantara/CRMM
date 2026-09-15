"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

type Sale = {
  id: string;
  title: string | null;
  amount: number | null;
  collected_amount: number | null;
  outstanding_balance: number | null;
  business_unit: string | null;
  affiliate_id: string | null;
  responsible_id: string | null;
};

type Payment = {
  id: string;
  sale_id: string | null;
  amount: number | null;
  method: string | null;
  status: string | null;
  proof_url: string | null;
  paid_at: string | null;
  created_at: string | null;
  affiliate_id: string | null;
  responsible_id: string | null;
  business_unit: string | null;
};

function money(value: unknown) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function friendlyError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause || "Error desconocido");
  if (/abort|timeout|timed out/i.test(message)) {
    return "La consulta tardó demasiado. Verifica tu conexión y pulsa Actualizar.";
  }
  return message;
}

export function PaymentModuleFast() {
  const supabase = useMemo(() => createClient(), []);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privileged = ["super_admin", "admin"].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userR = await supabase.auth.getUser();
      const userId = userR.data.user?.id;

      const [salesR, paymentsR, profileR] = await Promise.all([
        supabase
          .from("sales")
          .select("id,title,amount,collected_amount,outstanding_balance,business_unit,affiliate_id,responsible_id")
          .order("created_at", { ascending: false })
          .limit(250)
          .abortSignal(AbortSignal.timeout(12000)),
        supabase
          .from("payments")
          .select("id,sale_id,amount,method,status,proof_url,paid_at,created_at,affiliate_id,responsible_id,business_unit")
          .order("created_at", { ascending: false })
          .limit(250)
          .abortSignal(AbortSignal.timeout(12000)),
        userId
          ? supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (salesR.error) setError(salesR.error.message);
      else setSales((salesR.data || []) as Sale[]);

      if (paymentsR.error) setError(paymentsR.error.message);
      else setPayments((paymentsR.data || []) as Payment[]);

      if (profileR.data?.role) setRole(String(profileR.data.role).toLowerCase());
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
      const saleId = String(form.get("sale_id") || "");
      const amount = Number(form.get("amount") || 0);
      const method = String(form.get("method") || "");
      const status = String(form.get("status") || "completado");
      const paidAt = String(form.get("paid_at") || "");
      const proofUrl = String(form.get("proof_url") || "");
      const notes = String(form.get("notes") || "");

      if (amount <= 0) {
        setError("El monto del cobro debe ser mayor que cero.");
        return;
      }

      const sale = sales.find((item) => item.id === saleId);
      if (!sale) {
        setError("Selecciona una venta visible para tu cuenta.");
        return;
      }

      const outstanding = Number(sale.outstanding_balance ?? sale.amount ?? 0);
      if (outstanding > 0 && amount > outstanding && !privileged) {
        setError(`El cobro supera el saldo pendiente (${money(outstanding)}).`);
        return;
      }

      const { error: insertError } = await supabase.from("payments").insert({
        sale_id: saleId,
        amount,
        method: method || null,
        status,
        paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
        proof_url: proofUrl || null,
        notes: notes || null,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function voidPayment(id: string) {
    if (!privileged) return;
    if (!window.confirm("¿Anular este pago? Se conservará el registro histórico y se recalcularán venta, ledger y comisión.")) return;

    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "rechazado" })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
      await load();
    } catch (cause) {
      setError(friendlyError(cause));
    }
  }

  const saleMap = new Map(sales.map((sale) => [sale.id, sale]));
  const realCollected = payments
    .filter((payment) => ["parcial", "completado"].includes(String(payment.status)))
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Caja real</p>
            <h1 className="mt-2 text-3xl font-black text-white">Pagos y cobros</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Cada cobro se atribuye automáticamente a la venta, cliente, responsable, afiliado y unidad de negocio existentes al momento del pago. Esa atribución queda congelada para la historia financiera.
            </p>
            <p className="mt-4 text-2xl font-black text-emerald-200">Visible cobrado: {money(realCollected)}</p>
          </div>
          <button type="button" onClick={() => void load()} className="crm-button-secondary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}

      <section className="crm-card p-6">
        <h2 className="text-xl font-black text-white">Registrar ingreso</h2>
        <p className="mt-2 text-sm text-slate-500">Solo aparecen ventas que RLS permite ver a tu usuario.</p>

        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label>Venta *</label>
            <select name="sale_id" required defaultValue="">
              <option value="" disabled>Seleccionar venta</option>
              {sales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.title || "Venta"} · vendido {money(sale.amount)} · pendiente {money(sale.outstanding_balance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Monto *</label>
            <input name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div>
            <label>Método</label>
            <select name="method" defaultValue="">
              <option value="">Seleccionar</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="paypal">PayPal</option>
              <option value="deposito">Depósito</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label>Estado</label>
            <select name="status" defaultValue="completado">
              <option value="completado">Completado / contabilizar</option>
              <option value="parcial">Parcial / contabilizar</option>
              <option value="pendiente">Pendiente / no contabilizar</option>
              <option value="rechazado">Rechazado</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
          <div>
            <label>Fecha de cobro</label>
            <input name="paid_at" type="datetime-local" />
          </div>
          <div>
            <label>Comprobante URL</label>
            <input name="proof_url" />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label>Notas</label>
            <textarea name="notes" rows={3} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <button disabled={saving} className="crm-button-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </section>

      <section className="crm-card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-black text-white">Últimos pagos</h2>
          <p className="mt-1 text-xs text-slate-500">La atribución mostrada es la fotografía financiera del momento del cobro.</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando pagos…</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No hay pagos visibles para esta cuenta.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Venta</th>
                  <th className="p-4">Unidad</th>
                  <th className="p-4">Monto</th>
                  <th className="p-4">Método</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Responsable</th>
                  <th className="p-4">Afiliado</th>
                  <th className="p-4">Fecha</th>
                  {privileged ? <th className="p-4">Acción</th> : null}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const sale = payment.sale_id ? saleMap.get(payment.sale_id) : null;
                  return (
                    <tr key={payment.id} className="border-b border-white/[0.06] text-slate-300">
                      <td className="p-4 font-semibold text-white">{sale?.title || "Venta"}</td>
                      <td className="p-4">{payment.business_unit || sale?.business_unit || "—"}</td>
                      <td className="p-4 font-black text-emerald-200">{money(payment.amount)}</td>
                      <td className="p-4">{payment.method || "—"}</td>
                      <td className="p-4">{payment.status || "—"}</td>
                      <td className="p-4 font-mono text-xs">{payment.responsible_id ? payment.responsible_id.slice(0, 8) : "—"}</td>
                      <td className="p-4 font-mono text-xs">{payment.affiliate_id ? payment.affiliate_id.slice(0, 8) : "—"}</td>
                      <td className="p-4">{payment.paid_at ? new Date(payment.paid_at).toLocaleString("es-DO") : "—"}</td>
                      {privileged ? (
                        <td className="p-4">
                          <button type="button" onClick={() => void voidPayment(payment.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200">
                            <Trash2 size={14} />
                            Anular
                          </button>
                        </td>
                      ) : null}
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
