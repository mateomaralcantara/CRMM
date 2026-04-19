import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Pagos"
        description="Control de pagos de clientes, comprobantes y estados."
        table="payments"
        columns={["amount", "method", "status", "proof_url", "created_at"]}
        fields={[
          { key: "amount", label: "Monto", type: "number", required: true },
          { key: "method", label: "Método" },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Pendiente", value: "pendiente" },
            { label: "Parcial", value: "parcial" },
            { label: "Completado", value: "completado" },
            { label: "Rechazado", value: "rechazado" },
            { label: "Vencido", value: "vencido" }
          ]},
          { key: "proof_url", label: "URL comprobante" },
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
