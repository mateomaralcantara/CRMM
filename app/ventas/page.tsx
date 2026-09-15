import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";
import { getCurrentProfile } from "@/lib/auth/current-user";

const businessUnits = [
  { label: "MigraPro", value: "migrapro" },
  { label: "Tributario", value: "tributario" },
  { label: "GeneLibros", value: "genelibros" },
  { label: "LibroSeller", value: "libroseller" },
  { label: "Marketing / B2B", value: "b2b" },
  { label: "IA / Capacitaciones", value: "ia_capacitaciones" },
];

export default async function Page() {
  const profile = await getCurrentProfile();
  const role = String(profile?.role || "").toLowerCase();

  if (!["super_admin", "admin", "supervisor", "responsable", "vendedor"].includes(role)) {
    redirect("/finanzas");
  }

  return (
    <AppShell>
      <CrudModule
        title="Ventas — Dinero comprometido"
        description="Ventas visibles según RLS. El dinero real solo se reconoce cuando entra por Pagos."
        table="sales"
        columns={["title","business_unit","amount","collected_amount","outstanding_balance","status","payment_status","responsible_id","affiliate_id","created_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "business_unit", label: "Unidad de negocio", type: "select", options: businessUnits, required: true },
          { key: "amount", label: "Monto vendido", type: "number", required: true },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Abierta", value: "abierta" }, { label: "Ganada", value: "ganada" },
            { label: "Perdida", value: "perdida" }, { label: "Cancelada", value: "cancelada" },
          ]},
          { key: "payment_status", label: "Estado de pago", type: "select", options: [
            { label: "Pendiente", value: "pendiente" }, { label: "Parcial", value: "parcial" },
            { label: "Pagado", value: "pagado" }, { label: "Vencido", value: "vencido" },
          ]},
          { key: "payment_method", label: "Método de pago" },
          { key: "responsible_id", label: "Responsable", type: "responsible-select" },
          { key: "affiliate_id", label: "Afiliado" },
          { key: "notes", label: "Notas", type: "textarea" },
        ]}
      />
    </AppShell>
  );
}
