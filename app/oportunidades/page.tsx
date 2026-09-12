import { AppShell } from "@/components/app-shell";
import { CrudModule } from "@/components/crud-module";

const businessUnits = [
  { label: "MigraPro", value: "migrapro" },
  { label: "Tributario", value: "tributario" },
  { label: "GeneLibros", value: "genelibros" },
  { label: "LibroSeller", value: "libroseller" },
  { label: "Marketing / B2B", value: "b2b" },
  { label: "IA / Capacitaciones", value: "ia_capacitaciones" }
];
const stages = [
  { label: "Nuevo", value: "nuevo" },
  { label: "Contactado", value: "contactado" },
  { label: "Respondió", value: "respondio" },
  { label: "Calificado", value: "calificado" },
  { label: "Consulta", value: "consulta" },
  { label: "Propuesta", value: "propuesta" },
  { label: "Negociación", value: "negociacion" },
  { label: "Pago pendiente", value: "pago_pendiente" },
  { label: "Ganado", value: "ganado" },
  { label: "En ejecución", value: "en_ejecucion" },
  { label: "Finalizado", value: "finalizado" },
  { label: "Referido / Upsell", value: "referido_upsell" },
  { label: "Perdido", value: "perdido" }
];

export default function Page() {
  return (
    <AppShell>
      <CrudModule
        title="Oportunidades — Pipeline Reto 111"
        description="Control comercial desde el primer contacto hasta cobro, ejecución, cierre y upsell."
        table="opportunities"
        columns={["title","business_unit","stage","opportunity_value","sold_amount","collected_amount","outstanding_balance","conversion_probability","next_action","next_action_at","assigned_to"]}
        fields={[
          { key: "title", label: "Oportunidad", required: true },
          { key: "business_unit", label: "Unidad de negocio", type: "select", options: businessUnits, required: true },
          { key: "source", label: "Fuente" },
          { key: "stage", label: "Etapa", type: "select", options: stages, required: true },
          { key: "opportunity_value", label: "Valor de oportunidad", type: "number" },
          { key: "sold_amount", label: "Vendido", type: "number" },
          { key: "collected_amount", label: "Cobrado", type: "number" },
          { key: "conversion_probability", label: "Probabilidad %", type: "number" },
          { key: "next_action", label: "Próxima acción", required: true },
          { key: "next_action_at", label: "Fecha próxima acción", type: "datetime-local", required: true },
          { key: "assigned_to", label: "Responsable", type: "responsible-select", required: true },
          { key: "loss_reason", label: "Motivo de pérdida" },
          { key: "notes", label: "Notas", type: "textarea" }
        ]}
      />
    </AppShell>
  );
}
