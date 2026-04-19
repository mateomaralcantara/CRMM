-- CRM Services - Supabase MVP completo
-- FIXED: public.profiles se crea antes de las funciones que la consultan
-- Ejecutar este archivo completo en Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- =========================
-- Helpers
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

-- =========================
-- Profiles
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  role text not null default 'vendedor'
    check (role in ('admin','supervisor','vendedor','responsable','soporte','afiliado','cliente')),
  status text not null default 'active'
    check (status in ('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_supervisor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'supervisor'), false)
$$;


-- =========================
-- CRM core tables
-- =========================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_type text not null default 'persona'
    check (client_type in ('persona','empresa','referido','vip')),
  phone text,
  whatsapp text,
  email text,
  address text,
  document_id text,
  status text not null default 'prospecto'
    check (status in ('prospecto','activo','inactivo','suspendido','perdido')),
  assigned_to uuid references public.profiles(id) on delete set null,
  affiliate_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  email text,
  source text default 'manual',
  service_interest text,
  interest_level text not null default 'medio'
    check (interest_level in ('bajo','medio','alto')),
  status text not null default 'nuevo'
    check (status in ('nuevo','contactado','cotizado','ganado','perdido')),
  assigned_to uuid references public.profiles(id) on delete set null,
  converted_client_id uuid references public.clients(id) on delete set null,
  loss_reason text,
  next_follow_up timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  affiliate_type text not null default 'promotor'
    check (affiliate_type in ('promotor','aliado','vendedor_externo','empresa','influencer')),
  phone text,
  whatsapp text,
  email text,
  code text unique not null,
  referral_link text,
  status text not null default 'pendiente'
    check (status in ('pendiente','activo','inactivo','suspendido','bloqueado')),
  level text not null default 'bronce'
    check (level in ('bronce','plata','oro','vip','master')),
  assigned_to uuid references public.profiles(id) on delete set null,
  commission_accumulated numeric(12,2) not null default 0,
  commission_paid numeric(12,2) not null default 0,
  commission_pending numeric(12,2) not null default 0,
  payment_method text,
  payment_details text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  drop constraint if exists clients_affiliate_id_fkey;

alter table public.clients
  add constraint clients_affiliate_id_fkey
  foreign key (affiliate_id) references public.affiliates(id) on delete set null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  service_interest text,
  status text not null default 'nuevo'
    check (status in ('nuevo','contactado','convertido','perdido','cancelado')),
  sale_id uuid,
  commission_status text not null default 'pendiente'
    check (commission_status in ('pendiente','generada','aprobada','retenida','pagada','cancelada')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  base_price numeric(12,2) not null default 0,
  requirements text,
  estimated_days integer default 1,
  status text not null default 'activo'
    check (status in ('activo','inactivo')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  title text not null default 'Solicitud de servicio',
  priority text not null default 'media'
    check (priority in ('baja','media','alta','urgente')),
  status text not null default 'pendiente'
    check (status in ('pendiente','en_proceso','esperando_documentos','completado','cancelado')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  comments text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null default 'Cotización',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (subtotal - discount + tax) stored,
  status text not null default 'borrador'
    check (status in ('borrador','enviada','aceptada','rechazada','vencida')),
  expires_at date,
  terms text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Venta',
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  responsible_id uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null default 0,
  status text not null default 'abierta'
    check (status in ('abierta','ganada','perdida','cancelada')),
  payment_status text not null default 'pendiente'
    check (payment_status in ('pendiente','parcial','pagado','vencido')),
  payment_method text,
  closed_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referrals
  drop constraint if exists referrals_sale_id_fkey;

alter table public.referrals
  add constraint referrals_sale_id_fkey
  foreign key (sale_id) references public.sales(id) on delete set null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pendiente'
    check (status in ('pendiente','parcial','completado','rechazado','vencido')),
  method text,
  proof_url text,
  paid_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  type text not null default 'porcentual'
    check (type in ('fija','porcentual','por_servicio','por_nivel')),
  rate numeric(7,2) default 0,
  amount numeric(12,2) not null default 0,
  status text not null default 'generada'
    check (status in ('generada','retenida','aprobada','pagada','cancelada')),
  retention_reason text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  related_type text,
  related_id uuid,
  assigned_to uuid references public.profiles(id) on delete set null,
  priority text not null default 'media'
    check (priority in ('baja','media','alta','urgente')),
  status text not null default 'pendiente'
    check (status in ('pendiente','en_proceso','completada','cancelada')),
  due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  subject text not null,
  message text,
  category text,
  priority text not null default 'media'
    check (priority in ('baja','media','alta','urgente')),
  status text not null default 'abierto'
    check (status in ('abierto','en_proceso','esperando_cliente','resuelto','cerrado')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null
    check (owner_type in ('cliente','afiliado','servicio','venta','ticket','solicitud')),
  owner_id uuid,
  name text not null,
  document_type text,
  bucket text not null,
  path text not null,
  status text not null default 'recibido'
    check (status in ('pendiente','recibido','validado','rechazado','vencido')),
  expires_at date,
  validated_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- Updated at triggers
-- =========================

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','leads','affiliates','referrals','services','service_requests',
    'quotes','sales','payments','commissions','tasks','tickets','documents'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- Indexes
-- =========================

create index if not exists idx_clients_assigned_to on public.clients(assigned_to);
create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_leads_assigned_to on public.leads(assigned_to);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_affiliates_code on public.affiliates(code);
create index if not exists idx_affiliates_status on public.affiliates(status);
create index if not exists idx_sales_status on public.sales(status);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_commissions_status on public.commissions(status);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tickets_assigned_to on public.tickets(assigned_to);

-- =========================
-- RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.affiliates enable row level security;
alter table public.referrals enable row level security;
alter table public.services enable row level security;
alter table public.service_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.commissions enable row level security;
alter table public.tasks enable row level security;
alter table public.tickets enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Clients
drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all" on public.clients
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients
for select to authenticated
using (
  public.is_supervisor_or_admin()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or user_id = auth.uid()
);

drop policy if exists "clients_insert" on public.clients;
create policy "clients_insert" on public.clients
for insert to authenticated
with check (created_by = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists "clients_update" on public.clients;
create policy "clients_update" on public.clients
for update to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

-- Leads
drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all" on public.leads
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
for select to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
for insert to authenticated
with check (created_by = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
for update to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

-- Affiliates
drop policy if exists "affiliates_admin_all" on public.affiliates;
create policy "affiliates_admin_all" on public.affiliates
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "affiliates_select" on public.affiliates;
create policy "affiliates_select" on public.affiliates
for select to authenticated
using (
  public.is_supervisor_or_admin()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or profile_id = auth.uid()
);

drop policy if exists "affiliates_insert" on public.affiliates;
create policy "affiliates_insert" on public.affiliates
for insert to authenticated
with check (created_by = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists "affiliates_update" on public.affiliates;
create policy "affiliates_update" on public.affiliates
for update to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

-- Services
drop policy if exists "services_read" on public.services;
create policy "services_read" on public.services
for select to authenticated
using (true);

drop policy if exists "services_write" on public.services;
create policy "services_write" on public.services
for all to authenticated
using (public.is_supervisor_or_admin())
with check (public.is_supervisor_or_admin());

-- Generic table policies
drop policy if exists "referrals_policy" on public.referrals;
create policy "referrals_policy" on public.referrals
for all to authenticated
using (
  public.is_supervisor_or_admin()
  or created_by = auth.uid()
  or exists (
    select 1 from public.affiliates a
    where a.id = referrals.affiliate_id and a.profile_id = auth.uid()
  )
)
with check (public.is_supervisor_or_admin() or created_by = auth.uid());

drop policy if exists "service_requests_policy" on public.service_requests;
create policy "service_requests_policy" on public.service_requests
for all to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "quotes_policy" on public.quotes;
create policy "quotes_policy" on public.quotes
for all to authenticated
using (public.is_supervisor_or_admin() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or created_by = auth.uid());

drop policy if exists "sales_policy" on public.sales;
create policy "sales_policy" on public.sales
for all to authenticated
using (public.is_supervisor_or_admin() or responsible_id = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or responsible_id = auth.uid() or created_by = auth.uid());

drop policy if exists "payments_policy" on public.payments;
create policy "payments_policy" on public.payments
for all to authenticated
using (public.is_supervisor_or_admin() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or created_by = auth.uid());

drop policy if exists "commissions_policy" on public.commissions;
create policy "commissions_policy" on public.commissions
for all to authenticated
using (
  public.is_supervisor_or_admin()
  or created_by = auth.uid()
  or exists (
    select 1 from public.affiliates a
    where a.id = commissions.affiliate_id and a.profile_id = auth.uid()
  )
)
with check (public.is_supervisor_or_admin() or created_by = auth.uid());

drop policy if exists "tasks_policy" on public.tasks;
create policy "tasks_policy" on public.tasks
for all to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "tickets_policy" on public.tickets;
create policy "tickets_policy" on public.tickets
for all to authenticated
using (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "documents_policy" on public.documents;
create policy "documents_policy" on public.documents
for all to authenticated
using (public.is_supervisor_or_admin() or created_by = auth.uid())
with check (public.is_supervisor_or_admin() or created_by = auth.uid());

drop policy if exists "notifications_policy" on public.notifications;
create policy "notifications_policy" on public.notifications
for all to authenticated
using (user_id = auth.uid() or public.is_supervisor_or_admin())
with check (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists "audit_logs_policy" on public.audit_logs;
create policy "audit_logs_policy" on public.audit_logs
for select to authenticated
using (public.is_supervisor_or_admin());

-- =========================
-- Storage buckets
-- =========================

insert into storage.buckets (id, name, public)
values
  ('client-documents', 'client-documents', false),
  ('affiliate-documents', 'affiliate-documents', false),
  ('contracts', 'contracts', false),
  ('invoices', 'invoices', false),
  ('payment-proofs', 'payment-proofs', false),
  ('service-files', 'service-files', false),
  ('ticket-attachments', 'ticket-attachments', false),
  ('marketing-materials', 'marketing-materials', false)
on conflict (id) do nothing;

-- =========================
-- Seed services
-- =========================

insert into public.services (name, category, description, base_price, requirements, estimated_days, status)
values
  ('Consulta personalizada', 'Atención', 'Servicio de atención y orientación personalizada.', 0, 'Datos básicos del cliente.', 1, 'activo'),
  ('Gestión documental', 'Documentos', 'Organización, validación y seguimiento de documentos.', 1500, 'Documentos requeridos según caso.', 3, 'activo'),
  ('Afiliación comercial', 'Afiliados', 'Registro y activación de afiliados o aliados comerciales.', 0, 'Datos del afiliado y aceptación de términos.', 1, 'activo')
on conflict do nothing;
