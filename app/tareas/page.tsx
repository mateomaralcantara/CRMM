import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Tareas"
        description="Seguimientos, recordatorios y pendientes del equipo."
        table="tasks"
        columns={["title", "priority", "status", "due_at", "created_at"]}
        fields={[
          { key: "title", label: "Título", required: true },
          { key: "priority", label: "Prioridad", type: "select", options: [
            { label: "Baja", value: "baja" },
            { label: "Media", value: "media" },
            { label: "Alta", value: "alta" },
            { label: "Urgente", value: "urgente" }
          ]},
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Pendiente", value: "pendiente" },
            { label: "En proceso", value: "en_proceso" },
            { label: "Completada", value: "completada" },
            { label: "Cancelada", value: "cancelada" }
          ]},
          { key: "due_at", label: "Fecha límite", type: "datetime-local" },
          { key: "description", label: "Descripción", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
