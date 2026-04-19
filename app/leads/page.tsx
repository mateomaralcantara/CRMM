import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Leads"
        description="Prospectos, fuente de captaci\u00f3n, inter\u00e9s, seguimiento y conversi\u00f3n."
        table="leads"
        columns={["name", "phone", "source", "service_interest", "interest_level", "status", "assigned_to", "created_at"]}
        fields={[
          { key: "name", label: "Nombre", required: true },
          { key: "phone", label: "Teléfono" },
          { key: "whatsapp", label: "WhatsApp" },
          { key: "email", label: "Correo", type: "email" },
          { key: "source", label: "Fuente", placeholder: "WhatsApp, web, referido..." },
          { key: "service_interest", label: "Servicio de interés" },
          { key: "interest_level", label: "Interés", type: "select", options: [
            { label: "Bajo", value: "bajo" },
            { label: "Medio", value: "medio" },
            { label: "Alto", value: "alto" }
          ]},
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Nuevo", value: "nuevo" },
            { label: "Contactado", value: "contactado" },
            { label: "Cotizado", value: "cotizado" },
            { label: "Ganado", value: "ganado" },
            { label: "Perdido", value: "perdido" }
          ]},
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
