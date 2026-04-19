-- CRM Services — Tablas faltantes
-- Ejecutar después de tener profiles, clients, leads, affiliates, referrals,
-- commissions, tickets, documents y service_requests.

create extension if not exists "pgcrypto";

-- =========================
-- Helpers básicos
-- =========================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role::text = any(allowed_roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role::text = 'admin'
  );
$$;

-- =========================
-- Asegurar columnas base en tablas existentes
-- =========================

alter table public.clients
add column if not exists user_id uuid references public.profiles(id),
add column if not exists assigned_to uuid references public.profiles(id),
add column if not exists created_by uuid references public.profiles(id);

alter table public.affiliates
add column if not exists user_id uuid references public.profiles(id),
add column if not exists responsible_id uuid references public.profiles(id);

-- =========================
-- 1. SERVICES
-- =========================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  base_price numeric(12,2) not null default 0,
  requirements text,
  estimated_days integer,
  responsible_id uuid references public.profiles(id) on delete set null,
  status text not null default 'activo',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 2. SALES PIPELINES
-- =========================

create table if not exists public.sales_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  status text not null default 'activo',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 3. PIPELINE STAGES
-- =========================

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.sales_pipelines(id) on delete cascade,
  name text not null,
  position integer not null default 1,
  probability integer not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 4. DEALS / OPORTUNIDADES
-- =========================

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  pipeline_id uuid references public.sales_pipelines(id) on delete set null,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null default 0,
  probability integer not null default 0,
  expected_close_date date,
  status text not null default 'abierto',
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 5. QUOTES / COTIZACIONES
-- =========================

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null default ('Q-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'borrador',
  valid_until date,
  terms text,
  notes text,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 6. QUOTE ITEMS
-- =========================

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- =========================
-- 7. SALES / VENTAS
-- =========================

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text unique not null default ('S-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  responsible_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_status text not null default 'pendiente',
  status text not null default 'cerrada',
  closed_at timestamptz default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 8. PAYMENTS / PAGOS
-- =========================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text unique not null default ('P-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  client_id uuid references public.clients(id) on delete set null,
  sale_id uuid references public.sales(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  method text,
  status text not null default 'pendiente',
  paid_at timestamptz,
  due_date date,
  reference text,
  proof_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 9. COMMISSION SETTLEMENTS / LIQUIDACIONES
-- =========================

create table if not exists public.commission_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text unique not null default ('LQ-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_generated numeric(12,2) not null default 0,
  total_retained numeric(12,2) not null default 0,
  total_approved numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null default 0,
  status text not null default 'pendiente',
  approved_by uuid references public.profiles(id) on delete set null,
  paid_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 10. COMMISSION SETTLEMENT ITEMS
-- =========================

create table if not exists public.commission_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.commission_settlements(id) on delete cascade,
  commission_id uuid,
  amount numeric(12,2) not null default 0,
  status text not null default 'incluida',
  created_at timestamptz not null default now()
);

-- =========================
-- 11. TASKS / TAREAS
-- =========================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  related_type text,
  related_id uuid,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_date timestamptz,
  reminder_at timestamptz,
  priority text not null default 'media',
  status text not null default 'pendiente',
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 12. CALENDAR EVENTS
-- =========================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'general',
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'programado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 13. TICKET MESSAGES
-- =========================

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_type text not null default 'usuario',
  message text not null,
  attachments jsonb not null default '[]'::jsonb,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================
-- 14. NOTIFICATIONS
-- =========================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  related_type text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- 15. ACTIVITY LOGS
-- =========================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  module text not null,
  record_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- 16. AUDIT LOGS
-- =========================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- =========================
-- 17. SETTINGS
-- =========================

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 18. SERVICE CHECKLISTS
-- =========================

create table if not exists public.service_checklists (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  status text not null default 'activo',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 19. CHECKLIST ITEMS
-- =========================

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.service_checklists(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 1,
  is_required boolean not null default true,
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 20. CHECKLIST PROGRESS
-- =========================

create table if not exists public.checklist_progress (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  status text not null default 'pendiente',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(checklist_item_id, service_request_id)
);

-- =========================
-- Índices
-- =========================

create index if not exists idx_services_status on public.services(status);
create index if not exists idx_services_category on public.services(category);

create index if not exists idx_deals_client_id on public.deals(client_id);
create index if not exists idx_deals_lead_id on public.deals(lead_id);
create index if not exists idx_deals_assigned_to on public.deals(assigned_to);
create index if not exists idx_deals_status on public.deals(status);

create index if not exists idx_quotes_client_id on public.quotes(client_id);
create index if not exists idx_quotes_status on public.quotes(status);

create index if not exists idx_sales_client_id on public.sales(client_id);
create index if not exists idx_sales_affiliate_id on public.sales(affiliate_id);
create index if not exists idx_sales_status on public.sales(status);

create index if not exists idx_payments_client_id on public.payments(client_id);
create index if not exists idx_payments_sale_id on public.payments(sale_id);
create index if not exists idx_payments_status on public.payments(status);

create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

create index if not exists idx_calendar_events_assigned_to on public.calendar_events(assigned_to);
create index if not exists idx_calendar_events_start_at on public.calendar_events(start_at);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read_at on public.notifications(read_at);

create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_audit_logs_table_name on public.audit_logs(table_name);

-- =========================
-- Triggers updated_at
-- =========================

drop trigger if exists set_updated_at_services on public.services;
create trigger set_updated_at_services
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_sales_pipelines on public.sales_pipelines;
create trigger set_updated_at_sales_pipelines
before update on public.sales_pipelines
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_pipeline_stages on public.pipeline_stages;
create trigger set_updated_at_pipeline_stages
before update on public.pipeline_stages
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_deals on public.deals;
create trigger set_updated_at_deals
before update on public.deals
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_quotes on public.quotes;
create trigger set_updated_at_quotes
before update on public.quotes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_sales on public.sales;
create trigger set_updated_at_sales
before update on public.sales
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_payments on public.payments;
create trigger set_updated_at_payments
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_commission_settlements on public.commission_settlements;
create trigger set_updated_at_commission_settlements
before update on public.commission_settlements
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tasks on public.tasks;
create trigger set_updated_at_tasks
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_calendar_events on public.calendar_events;
create trigger set_updated_at_calendar_events
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_settings on public.settings;
create trigger set_updated_at_settings
before update on public.settings
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_service_checklists on public.service_checklists;
create trigger set_updated_at_service_checklists
before update on public.service_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_checklist_items on public.checklist_items;
create trigger set_updated_at_checklist_items
before update on public.checklist_items
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_checklist_progress on public.checklist_progress;
create trigger set_updated_at_checklist_progress
before update on public.checklist_progress
for each row execute function public.set_updated_at();

-- =========================
-- RLS básico
-- =========================

alter table public.services enable row level security;
alter table public.sales_pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.commission_settlements enable row level security;
alter table public.commission_settlement_items enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
alter table public.service_checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_progress enable row level security;

-- =========================
-- Policies generales
-- =========================

-- SERVICES
drop policy if exists "services_admin_supervisor_all" on public.services;
create policy "services_admin_supervisor_all"
on public.services
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "services_internal_select" on public.services;
create policy "services_internal_select"
on public.services
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte','afiliado','cliente']));

-- PIPELINES
drop policy if exists "pipelines_admin_supervisor_all" on public.sales_pipelines;
create policy "pipelines_admin_supervisor_all"
on public.sales_pipelines
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "pipelines_internal_select" on public.sales_pipelines;
create policy "pipelines_internal_select"
on public.sales_pipelines
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

drop policy if exists "pipeline_stages_admin_supervisor_all" on public.pipeline_stages;
create policy "pipeline_stages_admin_supervisor_all"
on public.pipeline_stages
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "pipeline_stages_internal_select" on public.pipeline_stages;
create policy "pipeline_stages_internal_select"
on public.pipeline_stages
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

-- DEALS
drop policy if exists "deals_admin_supervisor_all" on public.deals;
create policy "deals_admin_supervisor_all"
on public.deals
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "deals_assigned_select" on public.deals;
create policy "deals_assigned_select"
on public.deals
for select
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.has_role(array['admin','supervisor'])
);

drop policy if exists "deals_internal_insert" on public.deals;
create policy "deals_internal_insert"
on public.deals
for insert
to authenticated
with check (public.has_role(array['admin','supervisor','vendedor','responsable']));

-- QUOTES
drop policy if exists "quotes_admin_supervisor_all" on public.quotes;
create policy "quotes_admin_supervisor_all"
on public.quotes
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "quotes_internal_select" on public.quotes;
create policy "quotes_internal_select"
on public.quotes
for select
to authenticated
using (
  public.has_role(array['admin','supervisor','vendedor','responsable','soporte'])
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "quotes_internal_insert" on public.quotes;
create policy "quotes_internal_insert"
on public.quotes
for insert
to authenticated
with check (public.has_role(array['admin','supervisor','vendedor','responsable']));

drop policy if exists "quote_items_internal_select" on public.quote_items;
create policy "quote_items_internal_select"
on public.quote_items
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

drop policy if exists "quote_items_internal_all" on public.quote_items;
create policy "quote_items_internal_all"
on public.quote_items
for all
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable']))
with check (public.has_role(array['admin','supervisor','vendedor','responsable']));

-- SALES
drop policy if exists "sales_admin_supervisor_all" on public.sales;
create policy "sales_admin_supervisor_all"
on public.sales
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "sales_internal_select" on public.sales;
create policy "sales_internal_select"
on public.sales
for select
to authenticated
using (
  public.has_role(array['admin','supervisor','vendedor','responsable','soporte'])
  or responsible_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "sales_internal_insert" on public.sales;
create policy "sales_internal_insert"
on public.sales
for insert
to authenticated
with check (public.has_role(array['admin','supervisor','vendedor','responsable']));

-- PAYMENTS
drop policy if exists "payments_admin_supervisor_all" on public.payments;
create policy "payments_admin_supervisor_all"
on public.payments
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "payments_internal_select" on public.payments;
create policy "payments_internal_select"
on public.payments
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

drop policy if exists "payments_internal_insert" on public.payments;
create policy "payments_internal_insert"
on public.payments
for insert
to authenticated
with check (public.has_role(array['admin','supervisor','vendedor','responsable']));

-- COMMISSION SETTLEMENTS
drop policy if exists "commission_settlements_admin_supervisor_all" on public.commission_settlements;
create policy "commission_settlements_admin_supervisor_all"
on public.commission_settlements
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "commission_settlements_affiliate_select" on public.commission_settlements;
create policy "commission_settlements_affiliate_select"
on public.commission_settlements
for select
to authenticated
using (
  affiliate_id in (
    select id
    from public.affiliates
    where user_id = auth.uid()
  )
);

drop policy if exists "commission_settlement_items_admin_supervisor_all" on public.commission_settlement_items;
create policy "commission_settlement_items_admin_supervisor_all"
on public.commission_settlement_items
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

-- TASKS
drop policy if exists "tasks_admin_supervisor_all" on public.tasks;
create policy "tasks_admin_supervisor_all"
on public.tasks
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "tasks_assigned_all" on public.tasks;
create policy "tasks_assigned_all"
on public.tasks
for all
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.has_role(array['admin','supervisor'])
);

-- CALENDAR
drop policy if exists "calendar_admin_supervisor_all" on public.calendar_events;
create policy "calendar_admin_supervisor_all"
on public.calendar_events
for all
to authenticated
using (public.has_role(array['admin','supervisor']))
with check (public.has_role(array['admin','supervisor']));

drop policy if exists "calendar_assigned_all" on public.calendar_events;
create policy "calendar_assigned_all"
on public.calendar_events
for all
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.has_role(array['admin','supervisor'])
);

-- TICKET MESSAGES
drop policy if exists "ticket_messages_admin_support_all" on public.ticket_messages;
create policy "ticket_messages_admin_support_all"
on public.ticket_messages
for all
to authenticated
using (public.has_role(array['admin','supervisor','soporte']))
with check (public.has_role(array['admin','supervisor','soporte']));

drop policy if exists "ticket_messages_sender_insert" on public.ticket_messages;
create policy "ticket_messages_sender_insert"
on public.ticket_messages
for insert
to authenticated
with check (sender_id = auth.uid());

-- NOTIFICATIONS
drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notifications_internal_insert" on public.notifications;
create policy "notifications_internal_insert"
on public.notifications
for insert
to authenticated
with check (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

-- LOGS
drop policy if exists "activity_logs_admin_supervisor_select" on public.activity_logs;
create policy "activity_logs_admin_supervisor_select"
on public.activity_logs
for select
to authenticated
using (public.has_role(array['admin','supervisor']));

drop policy if exists "activity_logs_insert_authenticated" on public.activity_logs;
create policy "activity_logs_insert_authenticated"
on public.activity_logs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "audit_logs_admin_supervisor_select" on public.audit_logs;
create policy "audit_logs_admin_supervisor_select"
on public.audit_logs
for select
to authenticated
using (public.has_role(array['admin','supervisor']));

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
on public.audit_logs
for insert
to authenticated
with check (true);

-- SETTINGS
drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all"
on public.settings
for all
to authenticated
using (public.has_role(array['admin']))
with check (public.has_role(array['admin']));

drop policy if exists "settings_public_select" on public.settings;
create policy "settings_public_select"
on public.settings
for select
to authenticated
using (is_public = true or public.has_role(array['admin','supervisor']));

-- CHECKLISTS
drop policy if exists "service_checklists_internal_select" on public.service_checklists;
create policy "service_checklists_internal_select"
on public.service_checklists
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

drop policy if exists "service_checklists_admin_responsable_all" on public.service_checklists;
create policy "service_checklists_admin_responsable_all"
on public.service_checklists
for all
to authenticated
using (public.has_role(array['admin','supervisor','responsable']))
with check (public.has_role(array['admin','supervisor','responsable']));

drop policy if exists "checklist_items_internal_select" on public.checklist_items;
create policy "checklist_items_internal_select"
on public.checklist_items
for select
to authenticated
using (public.has_role(array['admin','supervisor','vendedor','responsable','soporte']));

drop policy if exists "checklist_items_admin_responsable_all" on public.checklist_items;
create policy "checklist_items_admin_responsable_all"
on public.checklist_items
for all
to authenticated
using (public.has_role(array['admin','supervisor','responsable']))
with check (public.has_role(array['admin','supervisor','responsable']));

drop policy if exists "checklist_progress_admin_responsable_all" on public.checklist_progress;
create policy "checklist_progress_admin_responsable_all"
on public.checklist_progress
for all
to authenticated
using (public.has_role(array['admin','supervisor','responsable']))
with check (public.has_role(array['admin','supervisor','responsable']));

-- =========================
-- Datos iniciales recomendados
-- =========================

insert into public.sales_pipelines (name, description, is_default, status)
values ('Pipeline principal', 'Embudo principal de ventas de CRM Services', true, 'activo')
on conflict do nothing;

insert into public.settings (key, value, description, is_public)
values
('company_name', '"CRM Services"'::jsonb, 'Nombre de la empresa', true),
('default_currency', '"DOP"'::jsonb, 'Moneda por defecto', true),
('commission_payment_frequency', '"mensual"'::jsonb, 'Frecuencia de pago de comisiones', false)
on conflict (key) do nothing;