import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Clientes"
        description="Base central de clientes, responsables, datos de contacto y estado comercial."
        table="clients"
        columns={[
          "name",
          "phone",
          "whatsapp",
          "email",
          "client_type",
          "status",
          "assigned_to",
          "created_at"
        ]}
        fields={[
          { key: "name", label: "Nombre", required: true },
          { key: "phone", label: "Teléfono" },
          { key: "whatsapp", label: "WhatsApp" },
          { key: "email", label: "Correo", type: "email" },
          {
            key: "assigned_to",
            label: "Responsable",
            type: "responsible-select",
            required: true
            },
            {
            key: "client_type",
            label: "Tipo",
            type: "select",
            options: [
              { label: "Persona", value: "persona" },
              { label: "Empresa", value: "empresa" },
              { label: "Referido", value: "referido" },
              { label: "VIP", value: "vip" }
            ]
          },
          {
            key: "status",
            label: "Estado",
            type: "select",
            options: [
              { label: "Prospecto", value: "prospecto" },
              { label: "Activo", value: "activo" },
              { label: "Inactivo", value: "inactivo" },
              { label: "Suspendido", value: "suspendido" },
              { label: "Perdido", value: "perdido" }
            ]
          },
          { key: "address", label: "Dirección" },
          { key: "document_id", label: "Documento / RNC" },
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}