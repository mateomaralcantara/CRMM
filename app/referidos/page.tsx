import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Referidos"
        description="Rastreo de clientes o leads tra\u00eddos por afiliados."
        table="referrals"
        columns={["service_interest", "status", "commission_status", "created_at"]}
        fields={[
          { key: "service_interest", label: "Servicio de interés" },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Nuevo", value: "nuevo" },
            { label: "Contactado", value: "contactado" },
            { label: "Convertido", value: "convertido" },
            { label: "Perdido", value: "perdido" },
            { label: "Cancelado", value: "cancelado" }
          ]},
          { key: "commission_status", label: "Estado comisión", type: "select", options: [
            { label: "Pendiente", value: "pendiente" },
            { label: "Generada", value: "generada" },
            { label: "Aprobada", value: "aprobada" },
            { label: "Retenida", value: "retenida" },
            { label: "Pagada", value: "pagada" },
            { label: "Cancelada", value: "cancelada" }
          ]},
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
