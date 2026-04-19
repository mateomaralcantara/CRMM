import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Tickets"
        description="Atención al cliente, soporte, reclamos y solicitudes."
        table="tickets"
        columns={[
          "subject",
          "category",
          "priority",
          "status",
          "assigned_to",
          "start_at",
          "end_at",
          "due_at",
          "created_at",
        ]}
        fields={[
          { key: "subject", label: "Asunto", required: true },
          { key: "category", label: "Categoría" },
          {
            key: "assigned_to",
            label: "Responsable",
            type: "responsible-select",
            required: true,
          },
          {
            key: "priority",
            label: "Prioridad",
            type: "select",
            options: [
              { label: "Baja", value: "baja" },
              { label: "Media", value: "media" },
              { label: "Alta", value: "alta" },
              { label: "Urgente", value: "urgente" },
            ],
          },
          {
            key: "status",
            label: "Estado",
            type: "select",
            options: [
              { label: "Abierto", value: "abierto" },
              { label: "En proceso", value: "en_proceso" },
              { label: "Esperando cliente", value: "esperando_cliente" },
              { label: "Resuelto", value: "resuelto" },
              { label: "Cerrado", value: "cerrado" },
            ],
          },
          {
            key: "start_at",
            label: "Fecha de inicio",
            type: "datetime-local",
          },
          {
            key: "end_at",
            label: "Fecha de finalización",
            type: "datetime-local",
          },
          {
            key: "due_at",
            label: "Fecha límite",
            type: "datetime-local",
          },
          { key: "message", label: "Mensaje", type: "textarea" },
        ]}
      />
    </AppShell>
  );
}