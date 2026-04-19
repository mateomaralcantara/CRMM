import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Solicitudes de servicio"
        description="Casos operativos asociados a clientes y servicios."
        table="service_requests"
        columns={["title", "priority", "status", "assigned_to", "due_date", "created_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "priority", label: "Prioridad", type: "select", options: [
            { label: "Baja", value: "baja" },
            { label: "Media", value: "media" },
            { label: "Alta", value: "alta" },
            { label: "Urgente", value: "urgente" }
          ]},
          {
            key: "assigned_to",
            label: "Responsable",
            type: "responsible-select",
            required: true
          },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Pendiente", value: "pendiente" },
            { label: "En proceso", value: "en_proceso" },
            { label: "Esperando documentos", value: "esperando_documentos" },
            { label: "Completado", value: "completado" },
            { label: "Cancelado", value: "cancelado" }
            
          ]},
          { key: "due_date", label: "Fecha límite", type: "date" },
          { key: "comments", label: "Comentarios", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
