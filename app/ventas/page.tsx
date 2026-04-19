import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Ventas"
        description="Registro comercial de ventas, pagos, afiliados y responsables."
        table="sales"
        columns={["title", "amount", "status", "payment_status", "payment_method", "responsible_id", "created_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "amount", label: "Monto", type: "number" },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Abierta", value: "abierta" },
            { label: "Ganada", value: "ganada" },
            { label: "Perdida", value: "perdida" },
            { label: "Cancelada", value: "cancelada" }
          ]},
          { key: "payment_status", label: "Estado de pago", type: "select", options: [
            { label: "Pendiente", value: "pendiente" },
            { label: "Parcial", value: "parcial" },
            { label: "Pagado", value: "pagado" },
            { label: "Vencido", value: "vencido" }
          ]},
          { key: "payment_method", label: "Método de pago" },
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
