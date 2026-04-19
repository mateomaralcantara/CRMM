import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Comisiones"
        description="Comisiones por afiliado, venta, tipo, porcentaje, monto y estado."
        table="commissions"
        columns={["type", "rate", "amount", "status", "retention_reason", "created_at"]}
        fields={[
          { key: "type", label: "Tipo", type: "select", options: [
            { label: "Fija", value: "fija" },
            { label: "Porcentual", value: "porcentual" },
            { label: "Por servicio", value: "por_servicio" },
            { label: "Por nivel", value: "por_nivel" }
          ]},
          { key: "rate", label: "Porcentaje / tasa", type: "number" },
          { key: "amount", label: "Monto", type: "number", required: true },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Generada", value: "generada" },
            { label: "Retenida", value: "retenida" },
            { label: "Aprobada", value: "aprobada" },
            { label: "Pagada", value: "pagada" },
            { label: "Cancelada", value: "cancelada" }
          ]},
          { key: "retention_reason", label: "Motivo de retención", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
