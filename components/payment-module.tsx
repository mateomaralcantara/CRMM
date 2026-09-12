"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

type Sale = {
  id: string;
  title: string | null;
  amount: number | null;
  business_unit?: string | null;
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
};

function money(value: unknown) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function PaymentModule() {
  const supabase = useMemo(() => createClient(), []);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [salesR, paymentsR] = await Promise.all([
      supabase
        .from("sales")
        .select("id,title,amount,business_unit")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("payments")
        .select("id,sale_id,amount,method,status,proof_url,paid_at,created_at")
        .order("created_at", { ascending: false })
        .limit(500)
    ]);

    if (salesR.error) setError(salesR.error.message);
    else setSales((salesR.data || []) as Sale[]);

    if (paymentsR.error) setError(paymentsR.error.message);
    else setPayments((paymentsR.data || []) as Payment[]);

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const saleId = String(form.get("sale_id") || "");
    const amount = Number(form.get("amount") || 0);
    const method = String(form.get("method") || "");
    const status = String(form.get("status") || "completado");
    const paidAt = String(form.get("paid_at") || "");
    const proofUrl = String(form.get("proof_url") || "");
    const notes = String(form.get("notes") || "");

    const { error: insertError } = await supabase.from("payments").insert({
      sale_id: saleId || null,
      amount,
      method: method || null,
      status,
      paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
      proof_url: proofUrl || null,
      notes: notes || null
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    event.currentTarget.reset();
    setSaving(false);
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar este pago? El saldo de la venta se recalculará automáticamente.")) return;

    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await load();
  }

  const saleMap = new Map(sales.map((sale) => [sale.id, sale]));

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Caja</p>
            <h1 className="mt-2 text-3xl font-black text-white">Pagos y cobros</h1>
            <p className="mt-2 text-sm text-slate-400">
              Cada pago queda ligado a una venta; el CRM recalcula cobrado y saldo pendiente.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="crm-button-secondary">
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section className="crm-card p-6">
        <h2 className="text-xl font-black text-white">Registrar cobro</h2>

        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label>Venta *</label>
            <select name="sale_id" required defaultValue="">
              <option value="" disabled>Seleccionar venta</option>
              {sales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.title || "Venta"} · {money(sale.amount)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Monto *</label>
            <input name="amount" type="number" step="0.01" min="0" required />
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
              <option value="completado">Completado</option>
              <option value="parcial">Parcial</option>
              <option value="pendiente">Pendiente</option>
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-4 text-left">Venta</th>
                <th className="px-4 py-4 text-left">Monto</th>
                <th className="px-4 py-4 text-left">Método</th>
                <th className="px-4 py-4 text-left">Estado</th>
                <th className="px-4 py-4 text-left">Fecha</th>
                <th className="px-4 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Cargando...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Sin pagos registrados.</td>
                </tr>
              ) : payments.map((payment) => {
                const sale = payment.sale_id ? saleMap.get(payment.sale_id) : undefined;

                return (
                  <tr key={payment.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-4 font-bold text-white">{sale?.title || "Sin venta asociada"}</td>
                    <td className="px-4 py-4 font-black text-emerald-200">{money(payment.amount)}</td>
                    <td className="px-4 py-4 text-slate-400">{payment.method || "—"}</td>
                    <td className="px-4 py-4 text-slate-300">{payment.status || "—"}</td>
                    <td className="px-4 py-4 text-slate-400">
                      {payment.paid_at ? new Date(payment.paid_at).toLocaleString("es-DO") : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(payment.id)}
                        className="crm-button-danger"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
