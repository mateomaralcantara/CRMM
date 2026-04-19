import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Servicios"
        description="Cat\u00e1logo de servicios que ofrece la empresa."
        table="services"
        columns={["name", "category", "base_price", "estimated_days", "status", "created_at"]}
        fields={[
          { key: "name", label: "Nombre del servicio", required: true },
          { key: "category", label: "Categoría" },
          { key: "base_price", label: "Precio base", type: "number" },
          { key: "estimated_days", label: "Días estimados", type: "number" },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Activo", value: "activo" },
            { label: "Inactivo", value: "inactivo" }
          ]},
          { key: "requirements", label: "Requisitos", type: "textarea" },
          { key: "description", label: "Descripción", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
