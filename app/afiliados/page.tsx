import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";
import { getCurrentProfile } from "@/lib/auth/current-user";

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

export default async function Page() {
  const profile = await getCurrentProfile();
  const role = String(profile?.role || "").toLowerCase();
  const privileged = ["super_admin", "admin"].includes(role);

  if (!["super_admin", "admin", "supervisor", "responsable"].includes(role)) {
    redirect("/finanzas");
  }

  const fields = [
    { key: "name", label: "Nombre", required: true },
    { key: "phone", label: "Teléfono" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "email", label: "Correo", type: "email" as const },
    { key: "code", label: "Código de afiliado", placeholder: "Opcional; se genera si lo dejas vacío" },
    { key: "affiliate_type", label: "Tipo de afiliado", type: "select" as const, options: affiliateTypes },
    { key: "level", label: "Nivel", type: "select" as const, options: levels },
    { key: "status", label: "Estado", type: "select" as const, required: true, options: statuses },
    { key: "payment_method", label: "Método de pago", placeholder: "Banco, transferencia, PayPal, efectivo..." },
    { key: "payment_details", label: "Detalles de pago", type: "textarea" as const },
    { key: "notes", label: "Notas internas", type: "textarea" as const },
    ...(privileged
      ? [
          { key: "responsible_id", label: "Responsable", type: "responsible-select" as const, required: true },
          { key: "commission_rate", label: "Tasa de comisión (%)", type: "number" as const },
        ]
      : []),
  ];

  return (
    <AppShell>
      <CrudModule
        title="Afiliados"
        description={
          privileged
            ? "Gestión global de afiliados, responsables y tasa financiera."
            : "Afiliados asignados a tu cuenta. La tasa y la atribución financiera solo pueden cambiarlas Admin/Super Admin."
        }
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
          "commission_rate",
          "commission_pending",
          "created_at",
        ]}
        fields={fields}
      />
    </AppShell>
  );
}
