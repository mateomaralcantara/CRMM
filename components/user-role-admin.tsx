"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
};

const roles = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "responsable", label: "Responsable" },
  { value: "vendedor", label: "Vendedor" },
  { value: "soporte", label: "Soporte" },
  { value: "promotor", label: "Promotor" },
  { value: "afiliado", label: "Afiliado" },
  { value: "cliente", label: "Cliente" },
];

const statuses = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "suspendido", label: "Suspendido" },
];

export function UserRoleAdmin({ currentRole }: { currentRole: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const superAdmin = currentRole === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("id,full_name,email,phone,role,status")
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setRows([]);
      } else {
        setRows((data || []) as Profile[]);
      }
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

  async function save(profile: Profile) {
    const privilegedTarget = ["super_admin", "admin"].includes(profile.role);
    if (!superAdmin && privilegedTarget) {
      setError("Solo Super Admin puede modificar cuentas Admin o Super Admin.");
      return;
    }

    setSavingId(profile.id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: profile.role, status: profile.status })
        .eq("id", profile.id);

      if (updateError) setError(updateError.message);
      else await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingId(null);
    }
  }

  const filtered = rows.filter((row) => {
    const value = query.trim().toLowerCase();
    if (!value) return true;
    return [row.full_name, row.email, row.phone, row.role, row.status]
      .filter(Boolean)
      .some((item) => String(item).toLowerCase().includes(value));
  });

  function patchRow(id: string, patch: Partial<Profile>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-6">
      <section className="crm-hero p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">Roles/RLS V2</p>
            <h1 className="mt-2 text-3xl font-black text-white">Usuarios y roles</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Admin y Super Admin son los únicos roles con visión global. Los demás usuarios trabajan sobre registros propios, asignados o atribuidos. Solo Super Admin puede modificar cuentas privilegiadas.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="crm-button-secondary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Usuarios visibles</p><p className="mt-3 text-3xl font-black text-white">{rows.length}</p></article>
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Admins</p><p className="mt-3 text-3xl font-black text-white">{rows.filter((row) => row.role === "admin").length}</p></article>
        <article className="crm-card p-5"><p className="text-xs font-black uppercase text-slate-500">Super Admin</p><p className="mt-3 text-3xl font-black text-white">{rows.filter((row) => row.role === "super_admin").length}</p></article>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="crm-card p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-300" size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar usuario, correo o rol..."
            className="w-full"
          />
        </div>
      </section>

      <section className="crm-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando usuarios…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Alcance</th>
                  <th className="p-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const protectedTarget = ["super_admin", "admin"].includes(row.role) && !superAdmin;
                  return (
                    <tr key={row.id} className="border-b border-white/[0.06] text-slate-300">
                      <td className="p-4">
                        <p className="font-black text-white">{row.full_name || "Sin nombre"}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.email || "Sin correo"}</p>
                      </td>
                      <td className="p-4">
                        <select
                          value={row.role}
                          disabled={protectedTarget}
                          onChange={(event) => patchRow(row.id, { role: event.target.value })}
                        >
                          {roles
                            .filter((option) => superAdmin || !["super_admin", "admin"].includes(option.value))
                            .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <select
                          value={row.status}
                          disabled={protectedTarget}
                          onChange={(event) => patchRow(row.id, { status: event.target.value })}
                        >
                          {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {["super_admin", "admin"].includes(row.role) ? "Global" : "Propio / asignado / atribuido"}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => void save(row)}
                          disabled={protectedTarget || savingId === row.id}
                          className="crm-button-primary"
                        >
                          {savingId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          Guardar
                        </button>
                      </td>
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
