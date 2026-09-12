"use client";

import {
  FormEvent,
  ReactNode,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createClient } from "@/lib/supabase/client";
import { makeAffiliateCode } from "@/lib/utils";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";

type FieldType =
  | "text"
  | "email"
  | "number"
  | "date"
  | "datetime-local"
  | "textarea"
  | "select"
  | "responsible-select"
  | "affiliate-type-select";

export type CrudField = {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
};

type CrudRow = Record<string, unknown> & {
  id?: string;
  created_at?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type CrudModuleProps = {
  title: string;
  description: string;
  table: string;
  fields: CrudField[];
  columns: string[];
  defaultValues?: Record<string, unknown>;
};

const ASSIGNABLE_TABLES = ["clients", "leads", "opportunities", "sales", "tasks", "tickets", "service_requests"];

const RESPONSIBLE_COLUMNS = [
  "assigned_to",
  "responsible_id",
  "created_by",
  "validated_by",
  "assigned_by"
];

const AFFILIATE_TYPE_COLUMNS = [
  "affiliate_type_id",
  "affiliate_type",
  "affiliate_type_code",
  "affiliate_type_name"
];

const MONEY_COLUMNS = [
  "opportunity_value",
  "sold_amount",
  "collected_amount",
  "outstanding_balance",
  "amount",
  "base_price",
  "subtotal",
  "discount",
  "tax",
  "total",
  "commission_pending",
  "commission_paid",
  "commission_accumulated",
  "default_commission_rate"
];

const BADGE_COLUMNS = [
  "stage",
  "business_unit",
  "status",
  "priority",
  "payment_status",
  "interest_level",
  "level",
  "client_type",
  "affiliate_type",
  "affiliate_type_code",
  "commission_status",
  "type"
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatColumnLabel(column: string) {
  const labels: Record<string, string> = {
    name: "Nombre",
    title: "Título",
    subject: "Asunto",
    phone: "Teléfono",
    whatsapp: "WhatsApp",
    email: "Correo",
    client_type: "Tipo",
    business_unit: "Unidad de negocio",
    stage: "Etapa",
    opportunity_value: "Valor oportunidad",
    sold_amount: "Vendido",
    collected_amount: "Cobrado",
    outstanding_balance: "Saldo pendiente",
    conversion_probability: "Probabilidad %",
    next_action: "Próxima acción",
    next_action_at: "Fecha próxima acción",
    status: "Estado",
    assigned_to: "Responsable",
    responsible_id: "Responsable",
    responsible_name: "Responsable",
    responsible_email: "Correo responsable",
    assigned_by: "Asignado por",
    assigned_at: "Asignado",
    created_by: "Creado por",
    validated_by: "Validado por",
    created_at: "Creado",
    updated_at: "Actualizado",
    amount: "Monto",
    rate: "Tasa",
    type: "Tipo",
    priority: "Prioridad",
    due_at: "Vence",
    due_date: "Fecha límite",
    code: "Código",
    level: "Nivel",
    affiliate_type: "Tipo afiliado",
    affiliate_type_id: "Tipo afiliado",
    affiliate_type_code: "Código tipo",
    affiliate_type_name: "Tipo afiliado",
    default_commission_rate: "Comisión %",
    commission_pending: "Comisión pendiente",
    commission_paid: "Comisión pagada",
    commission_accumulated: "Comisión acumulada",
    payment_status: "Estado de pago",
    payment_method: "Método de pago",
    service_interest: "Servicio de interés",
    interest_level: "Interés",
    source: "Fuente",
    category: "Categoría",
    method: "Método",
    proof_url: "Comprobante",
    path: "Ruta",
    bucket: "Bucket",
    document_type: "Tipo documento",
    owner_type: "Pertenece a",
    retention_reason: "Motivo retención"
  };

  return labels[column] || column.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatPercent(value: unknown) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("es-DO", { maximumFractionDigits: 2 })}%`;
}

function normalizeText(value: string) {
  return value.replaceAll("_", " ");
}

function getBadgeClass(value: string) {
  const cleanValue = value.toLowerCase();

  if (
    [
      "activo",
      "activa",
      "ganada",
      "pagado",
      "pagada",
      "completado",
      "completada",
      "validado",
      "aprobada",
      "alto",
      "vip",
      "oro",
      "premium"
    ].includes(cleanValue)
  ) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }

  if (
    [
      "pendiente",
      "nuevo",
      "nueva",
      "abierta",
      "abierto",
      "media",
      "medio",
      "bronce",
      "generada",
      "parcial",
      "borrador",
      "referidor",
      "promotor"
    ].includes(cleanValue)
  ) {
    return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  }

  if (
    [
      "urgente",
      "alta",
      "vencido",
      "vencida",
      "perdida",
      "perdido",
      "cancelada",
      "cancelado",
      "rechazada",
      "rechazado",
      "retenida",
      "suspendido",
      "suspendida",
      "bloqueado"
    ].includes(cleanValue)
  ) {
    return "border-red-400/20 bg-red-500/10 text-red-200";
  }

  if (
    ["contactado", "cotizado", "en_proceso", "enviada", "plata", "master", "agencia", "empresa"].includes(
      cleanValue
    )
  ) {
    return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  }

  return "border-slate-400/20 bg-slate-500/10 text-slate-200";
}

function Badge({ children, value }: { children: ReactNode; value: string }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-black capitalize",
        getBadgeClass(value)
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function formatSearchValue(
  column: string,
  value: unknown,
  responsibleMap: Map<string, string>,
  affiliateTypeMap: Map<string, string>
) {
  if (value === null || value === undefined || value === "") return "";

  const text = String(value);

  if (RESPONSIBLE_COLUMNS.includes(column)) {
    return responsibleMap.get(text) || text;
  }

  if (column === "affiliate_type_id") {
    return affiliateTypeMap.get(text) || text;
  }

  if (column === "default_commission_rate") {
    return formatPercent(value);
  }

  if (MONEY_COLUMNS.includes(column)) {
    return formatMoney(value);
  }

  return text;
}

function formatCellValue(
  column: string,
  value: unknown,
  responsibleMap: Map<string, string>,
  affiliateTypeMap: Map<string, string>
): ReactNode {
  if (value === null || value === undefined || value === "") return "—";

  const text = String(value);

  if (RESPONSIBLE_COLUMNS.includes(column)) {
    return responsibleMap.get(text) || (
      <span className="font-mono text-xs text-slate-500">{text}</span>
    );
  }

  if (column === "affiliate_type_id") {
    return affiliateTypeMap.get(text) || (
      <span className="font-mono text-xs text-slate-500">{text}</span>
    );
  }

  if (column === "default_commission_rate") {
    return <span className="font-bold text-slate-100">{formatPercent(value)}</span>;
  }

  if (MONEY_COLUMNS.includes(column)) {
    return <span className="font-bold text-slate-100">{formatMoney(value)}</span>;
  }

  if (BADGE_COLUMNS.includes(column)) {
    return <Badge value={text}>{normalizeText(text)}</Badge>;
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (typeof value === "object") {
    return <span className="font-mono text-xs text-slate-400">{JSON.stringify(value)}</span>;
  }

  if (text.includes("T") && text.includes(":") && !Number.isNaN(Date.parse(text))) {
    return <span className="text-slate-300">{formatDate(text)}</span>;
  }

  return text;
}

function getFriendlyError(message: string) {
  if (message.includes("violates foreign key constraint")) {
    return "No se pudo guardar o eliminar porque este registro depende de otro dato relacionado. Revisa cliente, responsable, afiliado, venta o documento asociado.";
  }

  if (message.includes("duplicate key")) {
    return "Ya existe un registro con ese dato único. Revisa código, correo u otro campo repetido.";
  }

  if (message.includes("permission denied") || message.includes("row-level security")) {
    return "No tienes permiso para realizar esta acción. Revisa las políticas RLS o tu rol de usuario.";
  }

  if (message.includes("affiliate_types")) {
    return "No se pudo cargar la lista de tipos de afiliado. Verifica que exista la tabla public.affiliate_types en Supabase.";
  }

  if (message.includes("assignable_affiliate_responsibles")) {
    return "No se pudo cargar la lista de responsables para afiliados. Verifica que exista la vista public.assignable_affiliate_responsibles en Supabase.";
  }

  if (message.includes("assignable_responsibles")) {
    return "No se pudo cargar la lista de responsables. Verifica que exista la vista public.assignable_responsibles en Supabase.";
  }

  return message;
}

function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="mt-5 flex gap-3 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
      <AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={18} />
      <p className="leading-6">{message}</p>
    </div>
  );
}

function ModuleHeader({
  title,
  description,
  loading,
  onRefresh
}: {
  title: string;
  description: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-300/10 bg-indigo-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
          <ClipboardList size={14} />
          Módulo CRM
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>

      <button
        onClick={onRefresh}
        type="button"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {loading ? "Actualizando..." : "Actualizar"}
      </button>
    </div>
  );
}

function FieldInput({
  table,
  field,
  responsibleOptions,
  affiliateTypeOptions
}: {
  table: string;
  field: CrudField;
  responsibleOptions: SelectOption[];
  affiliateTypeOptions: SelectOption[];
}) {
  const inputId = `${table}-${field.key}`;
  const commonClass =
    "w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/60 focus:bg-slate-950/70 focus:ring-4 focus:ring-indigo-500/10";

  return (
    <div className={field.type === "textarea" ? "md:col-span-2 xl:col-span-3" : ""}>
      <label
        htmlFor={inputId}
        className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400"
      >
        {field.label}
        {field.required ? <span className="ml-1 text-red-300">*</span> : null}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={inputId}
          name={field.key}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          className={commonClass}
        />
      ) : field.type === "responsible-select" ? (
        <select
          id={inputId}
          name={field.key}
          required={field.required}
          defaultValue=""
          className={commonClass}
        >
          <option value="" disabled={field.required}>
            {field.required ? "Seleccionar responsable" : "Sin responsable"}
          </option>

          {responsibleOptions.length === 0 ? (
            <option value="" disabled>
              No hay responsables disponibles
            </option>
          ) : null}

          {responsibleOptions.map((responsible) => (
            <option key={responsible.value} value={responsible.value}>
              {responsible.label}
            </option>
          ))}
        </select>
      ) : field.type === "affiliate-type-select" ? (
        <select
          id={inputId}
          name={field.key}
          required={field.required}
          defaultValue=""
          className={commonClass}
        >
          <option value="" disabled={field.required}>
            {field.required ? "Seleccionar tipo de afiliado" : "Sin tipo de afiliado"}
          </option>

          {affiliateTypeOptions.length === 0 ? (
            <option value="" disabled>
              No hay tipos de afiliado disponibles
            </option>
          ) : null}

          {affiliateTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "select" ? (
        <select
          id={inputId}
          name={field.key}
          required={field.required}
          defaultValue=""
          className={commonClass}
        >
          <option value="" disabled={field.required}>
            Seleccionar
          </option>

          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          name={field.key}
          type={field.type || "text"}
          placeholder={field.placeholder}
          required={field.required}
          className={commonClass}
        />
      )}
    </div>
  );
}

function CrudForm({
  table,
  fields,
  saving,
  formRef,
  responsibleOptions,
  affiliateTypeOptions,
  onSubmit
}: {
  table: string;
  fields: CrudField[];
  saving: boolean;
  formRef: Ref<HTMLFormElement>;
  responsibleOptions: SelectOption[];
  affiliateTypeOptions: SelectOption[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      ref={formRef}
      id={`${table}-form`}
      onSubmit={onSubmit}
      className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          table={table}
          field={field}
          responsibleOptions={responsibleOptions}
          affiliateTypeOptions={affiliateTypeOptions}
        />
      ))}

      <div className="flex items-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-950/30 hover:from-indigo-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {saving ? "Guardando..." : "Guardar registro"}
        </button>
      </div>
    </form>
  );
}

function TableSkeleton({ columns }: { columns: string[] }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {columns.map((column) => (
            <td key={column} className="px-4 py-4">
              <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
            </td>
          ))}
          <td className="px-4 py-4">
            <div className="h-8 w-24 animate-pulse rounded-2xl bg-white/10" />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyState({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td className="px-4 py-12 text-center" colSpan={colSpan}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl border border-white/10 bg-white/[0.04] text-slate-400">
          <ClipboardList size={24} />
        </div>
        <p className="mt-4 text-sm font-bold text-slate-300">Sin registros todavía</p>
        <p className="mt-1 text-xs text-slate-500">
          Crea el primer registro usando el formulario superior.
        </p>
      </td>
    </tr>
  );
}

function buildPayloadFromValues(fields: CrudField[], values: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.key];

    if (raw === undefined) continue;

    if (raw === null || raw === "") {
      payload[field.key] = null;
      continue;
    }

    payload[field.key] = field.type === "number" ? Number(raw) : String(raw);
  }

  return payload;
}

function EditableCell({
  table,
  column,
  field,
  value,
  responsibleOptions,
  affiliateTypeOptions,
  onChange
}: {
  table: string;
  column: string;
  field?: CrudField;
  value: unknown;
  responsibleOptions: SelectOption[];
  affiliateTypeOptions: SelectOption[];
  onChange: (column: string, value: string) => void;
}) {
  if (!field) return null;

  const inputId = `${table}-${column}-edit`;
  const commonClass =
    "w-full min-w-[160px] rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10";

  const currentValue = value === null || value === undefined ? "" : String(value);

  if (field.type === "textarea") {
    return (
      <textarea
        id={inputId}
        value={currentValue}
        rows={2}
        onChange={(event) => onChange(column, event.target.value)}
        className={commonClass}
      />
    );
  }

  if (field.type === "responsible-select") {
    return (
      <select
        id={inputId}
        value={currentValue}
        onChange={(event) => onChange(column, event.target.value)}
        className={commonClass}
      >
        <option value="">Sin responsable</option>
        {responsibleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "affiliate-type-select") {
    return (
      <select
        id={inputId}
        value={currentValue}
        onChange={(event) => onChange(column, event.target.value)}
        className={commonClass}
      >
        <option value="">Sin tipo</option>
        {affiliateTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={inputId}
        value={currentValue}
        onChange={(event) => onChange(column, event.target.value)}
        className={commonClass}
      >
        <option value="">Seleccionar</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={inputId}
      type={field.type || "text"}
      value={currentValue}
      placeholder={field.placeholder}
      onChange={(event) => onChange(column, event.target.value)}
      className={commonClass}
    />
  );
}

function CrudTable({
  table,
  fields,
  columns,
  rows,
  totalRows,
  query,
  loading,
  deletingId,
  editingId,
  editValues,
  savingEdit,
  responsibleOptions,
  affiliateTypeOptions,
  responsibleMap,
  affiliateTypeMap,
  onQueryChange,
  onStartEdit,
  onCancelEdit,
  onEditValueChange,
  onSaveEdit,
  onDelete
}: {
  table: string;
  fields: CrudField[];
  columns: string[];
  rows: CrudRow[];
  totalRows: number;
  query: string;
  loading: boolean;
  deletingId: string | null;
  editingId: string | null;
  editValues: Record<string, unknown>;
  savingEdit: boolean;
  responsibleOptions: SelectOption[];
  affiliateTypeOptions: SelectOption[];
  responsibleMap: Map<string, string>;
  affiliateTypeMap: Map<string, string>;
  onQueryChange: (value: string) => void;
  onStartEdit: (row: CrudRow) => void;
  onCancelEdit: () => void;
  onEditValueChange: (column: string, value: string) => void;
  onSaveEdit: () => void;
  onDelete: (id?: string) => void;
}) {
  const fieldMap = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Registros recientes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Mostrando <span className="font-bold text-slate-300">{rows.length}</span> de{" "}
            <span className="font-bold text-slate-300">{totalRows}</span> registros.
          </p>
        </div>

        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-4 top-3.5 text-slate-500" size={16} />
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
            placeholder="Buscar registros..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/40">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                >
                  {formatColumnLabel(column)}
                </th>
              ))}

              <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {loading ? (
              <TableSkeleton columns={columns} />
            ) : rows.length === 0 ? (
              <EmptyState colSpan={columns.length + 1} />
            ) : (
              rows.map((row, rowIndex) => {
                const isEditing = editingId === row.id;

                return (
                  <tr key={row.id || rowIndex} className="transition hover:bg-white/[0.04]">
                    {columns.map((column) => {
                      const editableField = fieldMap.get(column);

                      return (
                        <td
                          key={column}
                          className="max-w-xs truncate px-4 py-4 align-middle text-slate-300"
                        >
                          {isEditing && editableField ? (
                            <EditableCell
                              table={table}
                              column={column}
                              field={editableField}
                              value={editValues[column]}
                              responsibleOptions={responsibleOptions}
                              affiliateTypeOptions={affiliateTypeOptions}
                              onChange={onEditValueChange}
                            />
                          ) : (
                            formatCellValue(column, row[column], responsibleMap, affiliateTypeMap)
                          )}
                        </td>
                      );
                    })}

                    <td className="whitespace-nowrap px-4 py-4">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={onSaveEdit}
                            disabled={savingEdit}
                            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingEdit ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
                            {savingEdit ? "Guardando..." : "Guardar"}
                          </button>

                          <button
                            type="button"
                            onClick={onCancelEdit}
                            disabled={savingEdit}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X size={14} />
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onStartEdit(row)}
                            disabled={!row.id || Boolean(editingId)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-200 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Pencil size={14} />
                            Modificar
                          </button>

                          <button
                            type="button"
                            onClick={() => onDelete(row.id)}
                            disabled={deletingId === row.id || Boolean(editingId)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === row.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            {deletingId === row.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CrudModule({
  title,
  description,
  table,
  fields,
  columns,
  defaultValues = {}
}: CrudModuleProps) {
  const supabase = useMemo(() => createClient(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const [rows, setRows] = useState<CrudRow[]>([]);
  const [responsibles, setResponsibles] = useState<SelectOption[]>([]);
  const [affiliateTypes, setAffiliateTypes] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAffiliatesModule = table === "affiliates";

  const usesResponsibles = useMemo(() => {
    return (
      fields.some((field) => field.type === "responsible-select") ||
      columns.some((column) => RESPONSIBLE_COLUMNS.includes(column))
    );
  }, [fields, columns]);

  const usesAffiliateTypes = useMemo(() => {
    return (
      isAffiliatesModule ||
      fields.some((field) => field.type === "affiliate-type-select") ||
      columns.some((column) => AFFILIATE_TYPE_COLUMNS.includes(column))
    );
  }, [isAffiliatesModule, fields, columns]);

  const responsibleMap = useMemo(() => {
    return new Map(responsibles.map((responsible) => [responsible.value, responsible.label]));
  }, [responsibles]);

  const affiliateTypeMap = useMemo(() => {
    return new Map(affiliateTypes.map((option) => [option.value, option.label]));
  }, [affiliateTypes]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    const sourceTable = isAffiliatesModule ? "affiliates_with_assignment" : table;

    let result = await supabase
      .from(sourceTable)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error && sourceTable !== table) {
      result = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
    }

    if (result.error) {
      setError(getFriendlyError(result.error.message));
      setRows([]);
    } else {
      setRows((result.data || []) as CrudRow[]);
    }

    setLoading(false);
  }, [supabase, table, isAffiliatesModule]);

  const loadResponsibles = useCallback(async () => {
    if (!usesResponsibles) return;

    const viewName = isAffiliatesModule
      ? "assignable_affiliate_responsibles"
      : "assignable_responsibles";

    let result = await supabase
      .from(viewName)
      .select("id, label")
      .order("label", { ascending: true });

    if (result.error && isAffiliatesModule) {
      result = await supabase
        .from("assignable_responsibles")
        .select("id, label")
        .order("label", { ascending: true });
    }

    if (result.error) {
      setError(getFriendlyError(result.error.message));
      setResponsibles([]);
      return;
    }

    setResponsibles(
      (result.data || []).map((item) => ({
        value: String(item.id),
        label: String(item.label)
      }))
    );
  }, [supabase, usesResponsibles, isAffiliatesModule]);

  const loadAffiliateTypes = useCallback(async () => {
    if (!usesAffiliateTypes) return;

    const { data, error } = await supabase
      .from("affiliate_types")
      .select("id, code, name, default_commission_rate")
      .eq("status", "activo")
      .order("name", { ascending: true });

    if (error) {
      setError(getFriendlyError(error.message));
      setAffiliateTypes([]);
      return;
    }

    setAffiliateTypes(
      (data || []).map((item) => ({
        value: String(item.id),
        label: `${item.name} — ${item.default_commission_rate}%`
      }))
    );
  }, [supabase, usesAffiliateTypes]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadRows(), loadResponsibles(), loadAffiliateTypes()]);
  }, [loadRows, loadResponsibles, loadAffiliateTypes]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) return rows;

    return rows.filter((row) =>
      columns.some((column) => {
        const value = formatSearchValue(column, row[column], responsibleMap, affiliateTypeMap);
        return String(value).toLowerCase().includes(cleanQuery);
      })
    );
  }, [rows, query, columns, responsibleMap, affiliateTypeMap]);

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        setError(getFriendlyError(userError.message));
        return;
      }

      const values: Record<string, unknown> = { ...defaultValues };

      for (const field of fields) {
        const raw = formData.get(field.key);
        if (raw === null || raw === "") continue;
        values[field.key] = raw;
      }

      const payload = buildPayloadFromValues(fields, values);

      for (const [key, value] of Object.entries(defaultValues)) {
        if (payload[key] === undefined) payload[key] = value;
      }

      if (table === "affiliates") {
        if (!payload.code) {
          payload.code = makeAffiliateCode(String(payload.name || "Afiliado"));
        }

        if (!payload.status) {
          payload.status = "activo";
        }
      }

      if (table === "documents" && !payload.bucket) {
        payload.bucket = "client-documents";
      }

      if (userData.user) {
        payload.created_by = userData.user.id;

        if (!payload.assigned_to && ASSIGNABLE_TABLES.includes(table)) {
          payload.assigned_to = userData.user.id;
        }

        if (table === "sales" && !payload.responsible_id) {
          payload.responsible_id = userData.user.id;
        }
      }

      const { error } = await supabase.from(table).insert(payload);

      if (error) {
        setError(getFriendlyError(error.message));
        return;
      }

      formRef.current?.reset();
      await refreshAll();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: CrudRow) {
    if (!row.id) {
      setError("Este registro no tiene ID válido para modificar.");
      return;
    }

    const nextEditValues: Record<string, unknown> = {};

    for (const field of fields) {
      nextEditValues[field.key] = row[field.key] ?? "";
    }

    setEditingId(row.id);
    setEditValues(nextEditValues);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  function updateEditValue(column: string, value: string) {
    setEditValues((current) => ({
      ...current,
      [column]: value
    }));
  }

  async function updateRecord() {
    if (!editingId) {
      setError("No hay registro seleccionado para modificar.");
      return;
    }

    setSavingEdit(true);
    setError(null);

    try {
      const payload = buildPayloadFromValues(fields, editValues);

      delete payload.id;
      delete payload.created_at;
      payload.updated_at = new Date().toISOString();

      if (table === "affiliates" && !payload.code && payload.name) {
        payload.code = makeAffiliateCode(String(payload.name));
      }

      const { error } = await supabase.from(table).update(payload).eq("id", editingId);

      if (error) {
        setError(getFriendlyError(error.message));
        return;
      }

      setEditingId(null);
      setEditValues({});
      await refreshAll();
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteRecord(id?: string) {
    if (!id) {
      setError("Este registro no tiene ID válido para eliminar.");
      return;
    }

    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este registro? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError(null);

    try {
      const { error } = await supabase.from(table).delete().eq("id", id);

      if (error) {
        setError(getFriendlyError(error.message));
        return;
      }

      setRows((currentRows) => currentRows.filter((row) => row.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative">
          <ModuleHeader
            title={title}
            description={description}
            loading={loading}
            onRefresh={refreshAll}
          />

          <CrudForm
            table={table}
            fields={fields}
            saving={saving}
            formRef={formRef}
            responsibleOptions={responsibles}
            affiliateTypeOptions={affiliateTypes}
            onSubmit={createRecord}
          />

          <ErrorAlert message={error} />
        </div>
      </section>

      <CrudTable
        table={table}
        fields={fields}
        columns={columns}
        rows={filteredRows}
        totalRows={rows.length}
        query={query}
        loading={loading}
        deletingId={deletingId}
        editingId={editingId}
        editValues={editValues}
        savingEdit={savingEdit}
        responsibleOptions={responsibles}
        affiliateTypeOptions={affiliateTypes}
        responsibleMap={responsibleMap}
        affiliateTypeMap={affiliateTypeMap}
        onQueryChange={setQuery}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onEditValueChange={updateEditValue}
        onSaveEdit={updateRecord}
        onDelete={deleteRecord}
      />
    </div>
  );
}

