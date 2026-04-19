import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Documentos"
        description="Registro de documentos y rutas en Supabase Storage."
        table="documents"
        columns={["name", "owner_type", "document_type", "bucket", "path", "status", "created_at"]}
        fields={[
          { key: "name", label: "Nombre", required: true },
          { key: "owner_type", label: "Pertenece a", type: "select", options: [
            { label: "Cliente", value: "cliente" },
            { label: "Afiliado", value: "afiliado" },
            { label: "Servicio", value: "servicio" },
            { label: "Venta", value: "venta" },
            { label: "Ticket", value: "ticket" },
            { label: "Solicitud", value: "solicitud" }
          ]},
          { key: "document_type", label: "Tipo documento" },
          { key: "bucket", label: "Bucket", placeholder: "client-documents" },
          { key: "path", label: "Ruta / path", required: true },
          { key: "status", label: "Estado", type: "select", options: [
            { label: "Pendiente", value: "pendiente" },
            { label: "Recibido", value: "recibido" },
            { label: "Validado", value: "validado" },
            { label: "Rechazado", value: "rechazado" },
            { label: "Vencido", value: "vencido" }
          ]},
          { key: "expires_at", label: "Vence", type: "date" }
        ]}
      />
    </AppShell>
  );
}
