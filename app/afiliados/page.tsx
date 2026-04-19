import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

const affiliateTypes = [
  { label: "Referidor", value: "referidor" },
  { label: "Promotor", value: "promotor" },
  { label: "Premium", value: "premium" },
  { label: "Agencia", value: "agencia" },
  { label: "Empresa", value: "empresa" },
  { label: "Influencer", value: "influencer" },
];

const statuses = [
  { label: "Pendiente", value: "pendiente" },
  { label: "Activo / Aprobado", value: "activo" },
  { label: "Rechazado", value: "rechazado" },
  { label: "Suspendido", value: "suspendido" },
  { label: "Inactivo", value: "inactivo" },
];

const levels = [
  { label: "Bronce", value: "bronce" },
  { label: "Plata", value: "plata" },
  { label: "Oro", value: "oro" },
  { label: "VIP", value: "vip" },
  { label: "Master", value: "master" },
];

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Afiliados"
        description="Gestión de afiliados, responsables, estados, comisiones y métodos de pago."
        table="affiliates"
        columns={[
          "name",
          "code",
          "phone",
          "email",
          "affiliate_type",
          "level",
          "status",
          "responsible_id",
          "commission_pending",
          "created_at",
        ]}
        fields={[
          {
            key: "name",
            label: "Nombre",
            required: true,
          },
          {
            key: "phone",
            label: "Teléfono",
          },
          {
            key: "whatsapp",
            label: "WhatsApp",
          },
          {
            key: "email",
            label: "Correo",
            type: "email",
          },
          {
            key: "code",
            label: "Código de afiliado",
            placeholder: "Opcional; se genera si lo dejas vacío",
          },
          {
            key: "responsible_id",
            label: "Responsable",
            type: "responsible-select",
            required: true,
          },
          {
            key: "affiliate_type",
            label: "Tipo de afiliado",
            type: "select",
            options: affiliateTypes,
          },
          {
            key: "level",
            label: "Nivel",
            type: "select",
            options: levels,
          },
          {
            key: "status",
            label: "Estado",
            type: "select",
            required: true,
            options: statuses,
          },
          {
            key: "payment_method",
            label: "Método de pago",
            placeholder: "Banco, transferencia, PayPal, efectivo...",
          },
          {
            key: "payment_details",
            label: "Detalles de pago",
            type: "textarea",
          },
          {
            key: "notes",
            label: "Notas internas",
            type: "textarea",
          },
        ]}
      />
    </AppShell>
  );
}