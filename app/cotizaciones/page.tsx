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
        title="Cotizaciones — Propuestas abiertas"
        description="Propuestas económicas por unidad de negocio y estado comercial."
        table="quotes"
        columns={["title","business_unit","subtotal","discount","tax","total","status","expires_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "business_unit", label: "Unidad de negocio", type: "select", options: businessUnits, required: true },
          { key: "subtotal", label: "Subtotal", type: "number" },
          { key: "discount", label: "Descuento", type: "number" },
          { key: "tax", label: "Impuestos", type: "number" },
          { key: "expires_at", label: "Vence", type: "date" },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Borrador", value: "borrador" }, { label: "Enviada", value: "enviada" },
            { label: "Aceptada", value: "aceptada" }, { label: "Rechazada", value: "rechazada" },
            { label: "Vencida", value: "vencida" }
          ]},
          { key: "terms", label: "Condiciones", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
