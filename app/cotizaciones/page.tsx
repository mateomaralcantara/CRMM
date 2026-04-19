import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Cotizaciones"
        description="Propuestas econ\u00f3micas con subtotal, descuento, impuestos y estado."
        table="quotes"
        columns={["title", "subtotal", "discount", "tax", "total", "status", "expires_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "subtotal", label: "Subtotal", type: "number" },
          { key: "discount", label: "Descuento", type: "number" },
          { key: "tax", label: "Impuestos", type: "number" },
          { key: "expires_at", label: "Vence", type: "date" },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Borrador", value: "borrador" },
            { label: "Enviada", value: "enviada" },
            { label: "Aceptada", value: "aceptada" },
            { label: "Rechazada", value: "rechazada" },
            { label: "Vencida", value: "vencida" }
          ]},
          { key: "terms", label: "Condiciones", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
