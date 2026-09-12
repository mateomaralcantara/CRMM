import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

const businessUnits = [
  { label: "MigraPro", value: "migrapro" },
  { label: "Tributario", value: "tributario" },
  { label: "GeneLibros", value: "genelibros" },
  { label: "LibroSeller", value: "libroseller" },
  { label: "Marketing / B2B", value: "b2b" },
  { label: "IA / Capacitaciones", value: "ia_capacitaciones" }
];

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Ventas — Dinero comprometido"
        description="Ventas por unidad de negocio con vendido, cobrado y saldo pendiente calculado automáticamente desde pagos."
        table="sales"
        columns={["title","business_unit","amount","collected_amount","outstanding_balance","status","payment_status","responsible_id","created_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "business_unit", label: "Unidad de negocio", type: "select", options: businessUnits, required: true },
          { key: "amount", label: "Monto vendido", type: "number", required: true },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Abierta", value: "abierta" }, { label: "Ganada", value: "ganada" },
            { label: "Perdida", value: "perdida" }, { label: "Cancelada", value: "cancelada" }
          ]},
          { key: "payment_status", label: "Estado de pago", type: "select", options: [
            { label: "Pendiente", value: "pendiente" }, { label: "Parcial", value: "parcial" },
            { label: "Pagado", value: "pagado" }, { label: "Vencido", value: "vencido" }
          ]},
          { key: "payment_method", label: "Método de pago" },
          { key: "responsible_id", label: "Responsable", type: "responsible-select" },
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
