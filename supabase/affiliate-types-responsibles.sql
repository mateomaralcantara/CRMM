-- CRM Services — Tipos de afiliados, responsables y permisos
-- Compatible con role como text. NO usa app_role.

create extension if not exists "pgcrypto";

-- =========================
-- 1. Funciones base seguras
-- =========================

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
    and status::text in ('activo', 'active')
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
    and status::text in ('activo', 'active')
  );
$$;

-- =========================
-- 2. Asegurar columnas necesarias
-- =========================

alter table public.affiliates
add column if not exists user_id uuid references public.profiles(id),
add column if not exists responsible_id uuid references public.profiles(id),
add column if not exists affiliate_type_id uuid,
add column if not exists assigned_by uuid references public.profiles(id),
add column if not exists assigned_at timestamptz,
add column if not exists status text default 'activo',
add column if not exists updated_at timestamptz default now();

-- =========================
-- 3. Tipos de afiliados
-- =========================

create table if not exists public.affiliate_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  default_commission_rate numeric(5,2) not null default 0,
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliates
drop constraint if exists affiliates_affiliate_type_id_fkey;

alter table public.affiliates
add constraint affiliates_affiliate_type_id_fkey
foreign key (affiliate_type_id)
references public.affiliate_types(id)
on delete set null;

-- =========================
-- 4. Permisos por tipo de afiliado
-- =========================

create table if not exists public.affiliate_type_permissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_type_id uuid not null references public.affiliate_types(id) on delete cascade,
  can_create_referrals boolean not null default true,
  can_view_own_referrals boolean not null default true,
  can_view_own_commissions boolean not null default true,
  can_upload_documents boolean not null default true,
  can_create_leads boolean not null default false,
  can_view_assigned_clients boolean not null default false,
  can_request_payout boolean not null default false,
  can_have_sub_affiliates boolean not null default false,
  can_view_reports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_type_id)
);

-- =========================
-- 5. Responsables por tipo de afiliado
-- =========================

create table if not exists public.affiliate_type_responsibles (
  id uuid primary key default gen_random_uuid(),
  affiliate_type_id uuid not null references public.affiliate_types(id) on delete cascade,
  responsible_user_id uuid not null references public.profiles(id) on delete cascade,
  is_default boolean not null default false,
  status text not null default 'activo',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_type_id, responsible_user_id)
);

create unique index if not exists affiliate_type_one_default_responsible
on public.affiliate_type_responsibles (affiliate_type_id)
where is_default = true and status = 'activo';

-- =========================
-- 6. Insertar tipos iniciales
-- =========================

insert into public.affiliate_types
(code, name, description, default_commission_rate, status)
values
('referidor', 'Afiliado referidor', 'Solo registra referidos y ve sus comisiones.', 5, 'activo'),
('promotor', 'Afiliado promotor', 'Puede registrar referidos y generar leads.', 8, 'activo'),
('premium', 'Afiliado premium', 'Afiliado con mejores permisos y comisión superior.', 12, 'activo'),
('agencia', 'Agencia afiliada', 'Entidad o equipo que puede manejar subafiliados.', 15, 'activo'),
('empresa', 'Empresa afiliada', 'Cuenta comercial con gestión avanzada.', 10, 'activo')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  default_commission_rate = excluded.default_commission_rate,
  status = excluded.status,
  updated_at = now();

-- =========================
-- 7. Insertar permisos iniciales por tipo
-- =========================

insert into public.affiliate_type_permissions
(
  affiliate_type_id,
  can_create_referrals,
  can_view_own_referrals,
  can_view_own_commissions,
  can_upload_documents,
  can_create_leads,
  can_view_assigned_clients,
  can_request_payout,
  can_have_sub_affiliates,
  can_view_reports
)
select
  id,
  true,
  true,
  true,
  true,
  false,
  false,
  false,
  false,
  false
from public.affiliate_types
where code = 'referidor'
on conflict (affiliate_type_id) do update set
  can_create_referrals = excluded.can_create_referrals,
  can_view_own_referrals = excluded.can_view_own_referrals,
  can_view_own_commissions = excluded.can_view_own_commissions,
  can_upload_documents = excluded.can_upload_documents,
  can_create_leads = excluded.can_create_leads,
  can_view_assigned_clients = excluded.can_view_assigned_clients,
  can_request_payout = excluded.can_request_payout,
  can_have_sub_affiliates = excluded.can_have_sub_affiliates,
  can_view_reports = excluded.can_view_reports,
  updated_at = now();

insert into public.affiliate_type_permissions
(
  affiliate_type_id,
  can_create_referrals,
  can_view_own_referrals,
  can_view_own_commissions,
  can_upload_documents,
  can_create_leads,
  can_view_assigned_clients,
  can_request_payout,
  can_have_sub_affiliates,
  can_view_reports
)
select
  id,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  false,
  false
from public.affiliate_types
where code = 'promotor'
on conflict (affiliate_type_id) do update set
  can_create_referrals = excluded.can_create_referrals,
  can_view_own_referrals = excluded.can_view_own_referrals,
  can_view_own_commissions = excluded.can_view_own_commissions,
  can_upload_documents = excluded.can_upload_documents,
  can_create_leads = excluded.can_create_leads,
  can_view_assigned_clients = excluded.can_view_assigned_clients,
  can_request_payout = excluded.can_request_payout,
  can_have_sub_affiliates = excluded.can_have_sub_affiliates,
  can_view_reports = excluded.can_view_reports,
  updated_at = now();

insert into public.affiliate_type_permissions
(
  affiliate_type_id,
  can_create_referrals,
  can_view_own_referrals,
  can_view_own_commissions,
  can_upload_documents,
  can_create_leads,
  can_view_assigned_clients,
  can_request_payout,
  can_have_sub_affiliates,
  can_view_reports
)
select
  id,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  true
from public.affiliate_types
where code = 'premium'
on conflict (affiliate_type_id) do update set
  can_create_referrals = excluded.can_create_referrals,
  can_view_own_referrals = excluded.can_view_own_referrals,
  can_view_own_commissions = excluded.can_view_own_commissions,
  can_upload_documents = excluded.can_upload_documents,
  can_create_leads = excluded.can_create_leads,
  can_view_assigned_clients = excluded.can_view_assigned_clients,
  can_request_payout = excluded.can_request_payout,
  can_have_sub_affiliates = excluded.can_have_sub_affiliates,
  can_view_reports = excluded.can_view_reports,
  updated_at = now();

insert into public.affiliate_type_permissions
(
  affiliate_type_id,
  can_create_referrals,
  can_view_own_referrals,
  can_view_own_commissions,
  can_upload_documents,
  can_create_leads,
  can_view_assigned_clients,
  can_request_payout,
  can_have_sub_affiliates,
  can_view_reports
)
select
  id,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
from public.affiliate_types
where code in ('agencia', 'empresa')
on conflict (affiliate_type_id) do update set
  can_create_referrals = excluded.can_create_referrals,
  can_view_own_referrals = excluded.can_view_own_referrals,
  can_view_own_commissions = excluded.can_view_own_commissions,
  can_upload_documents = excluded.can_upload_documents,
  can_create_leads = excluded.can_create_leads,
  can_view_assigned_clients = excluded.can_view_assigned_clients,
  can_request_payout = excluded.can_request_payout,
  can_have_sub_affiliates = excluded.can_have_sub_affiliates,
  can_view_reports = excluded.can_view_reports,
  updated_at = now();

-- =========================
-- 8. Vista de responsables asignables
-- Incluye admins, supervisores y responsables.
-- =========================

drop view if exists public.assignable_affiliate_responsibles cascade;

create view public.assignable_affiliate_responsibles as
select
  id,
  coalesce(full_name, email, 'Sin nombre') as full_name,
  email,
  phone,
  role::text as role,
  status::text as status,
  coalesce(full_name, email, 'Sin nombre') || ' — ' || role::text as label
from public.profiles
where role::text in ('admin', 'supervisor', 'responsable')
and status::text in ('activo', 'active')
order by full_name asc nulls last, email asc nulls last;

grant select on public.assignable_affiliate_responsibles to authenticated;

-- =========================
-- 9. Vista completa de afiliados con tipo y responsable
-- =========================

drop view if exists public.affiliates_with_assignment cascade;

create view public.affiliates_with_assignment as
select
  a.*,
  at.code as affiliate_type_code,
  at.name as affiliate_type_name,
  at.default_commission_rate,
  p.full_name as responsible_name,
  p.email as responsible_email,
  p.role as responsible_role
from public.affiliates a
left join public.affiliate_types at
  on at.id = a.affiliate_type_id
left join public.profiles p
  on p.id = a.responsible_id;

grant select on public.affiliates_with_assignment to authenticated;

-- =========================
-- 10. Función para asignar tipo y responsable a un afiliado
-- Solo admin o supervisor.
-- =========================

create or replace function public.admin_update_affiliate_assignment(
  target_affiliate_id uuid,
  new_affiliate_type_id uuid,
  new_responsible_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  responsible_role text;
  responsible_status text;
begin
  if not public.has_role(array['admin', 'supervisor']) then
    raise exception 'No autorizado';
  end if;

  if new_responsible_id is not null then
    select role::text, status::text
    into responsible_role, responsible_status
    from public.profiles
    where id = new_responsible_id;

    if responsible_role is null then
      raise exception 'Responsable no encontrado';
    end if;

    if responsible_role not in ('admin', 'supervisor', 'responsable') then
      raise exception 'Ese usuario no puede ser responsable de afiliados';
    end if;

    if responsible_status not in ('activo', 'active') then
      raise exception 'El responsable no está activo';
    end if;
  end if;

  update public.affiliates
  set affiliate_type_id = new_affiliate_type_id,
      responsible_id = new_responsible_id,
      assigned_by = auth.uid(),
      assigned_at = now(),
      updated_at = now()
  where id = target_affiliate_id;

  if not found then
    raise exception 'Afiliado no encontrado';
  end if;
end;
$$;

-- =========================
-- 11. Función para asignar responsables por tipo de afiliado
-- Solo admin o supervisor.
-- =========================

create or replace function public.admin_assign_responsible_to_affiliate_type(
  target_affiliate_type_id uuid,
  target_responsible_user_id uuid,
  make_default boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  responsible_role text;
  responsible_status text;
begin
  if not public.has_role(array['admin', 'supervisor']) then
    raise exception 'No autorizado';
  end if;

  select role::text, status::text
  into responsible_role, responsible_status
  from public.profiles
  where id = target_responsible_user_id;

  if responsible_role is null then
    raise exception 'Responsable no encontrado';
  end if;

  if responsible_role not in ('admin', 'supervisor', 'responsable') then
    raise exception 'Ese usuario no puede ser responsable de este tipo de afiliado';
  end if;

  if responsible_status not in ('activo', 'active') then
    raise exception 'El responsable no está activo';
  end if;

  if make_default then
    update public.affiliate_type_responsibles
    set is_default = false,
        updated_at = now()
    where affiliate_type_id = target_affiliate_type_id;
  end if;

  insert into public.affiliate_type_responsibles (
    affiliate_type_id,
    responsible_user_id,
    is_default,
    status,
    assigned_by
  )
  values (
    target_affiliate_type_id,
    target_responsible_user_id,
    make_default,
    'activo',
    auth.uid()
  )
  on conflict (affiliate_type_id, responsible_user_id) do update set
    is_default = excluded.is_default,
    status = 'activo',
    assigned_by = auth.uid(),
    updated_at = now();
end;
$$;

-- =========================
-- 12. RLS
-- =========================

alter table public.affiliate_types enable row level security;
alter table public.affiliate_type_permissions enable row level security;
alter table public.affiliate_type_responsibles enable row level security;

drop policy if exists "affiliate_types_read_authenticated" on public.affiliate_types;
drop policy if exists "affiliate_types_admin_supervisor_all" on public.affiliate_types;

create policy "affiliate_types_read_authenticated"
on public.affiliate_types
for select
to authenticated
using (status = 'activo');

create policy "affiliate_types_admin_supervisor_all"
on public.affiliate_types
for all
to authenticated
using (public.has_role(array['admin', 'supervisor']))
with check (public.has_role(array['admin', 'supervisor']));

drop policy if exists "affiliate_type_permissions_read_authenticated" on public.affiliate_type_permissions;
drop policy if exists "affiliate_type_permissions_admin_supervisor_all" on public.affiliate_type_permissions;

create policy "affiliate_type_permissions_read_authenticated"
on public.affiliate_type_permissions
for select
to authenticated
using (true);

create policy "affiliate_type_permissions_admin_supervisor_all"
on public.affiliate_type_permissions
for all
to authenticated
using (public.has_role(array['admin', 'supervisor']))
with check (public.has_role(array['admin', 'supervisor']));

drop policy if exists "affiliate_type_responsibles_admin_supervisor_all" on public.affiliate_type_responsibles;
drop policy if exists "affiliate_type_responsibles_responsible_read_own" on public.affiliate_type_responsibles;

create policy "affiliate_type_responsibles_admin_supervisor_all"
on public.affiliate_type_responsibles
for all
to authenticated
using (public.has_role(array['admin', 'supervisor']))
with check (public.has_role(array['admin', 'supervisor']));

create policy "affiliate_type_responsibles_responsible_read_own"
on public.affiliate_type_responsibles
for select
to authenticated
using (responsible_user_id = auth.uid());

-- =========================
-- 13. RLS extra sobre affiliates
-- =========================

alter table public.affiliates enable row level security;

drop policy if exists "affiliates_responsible_select_assigned" on public.affiliates;
drop policy if exists "affiliates_admin_supervisor_update_assignment" on public.affiliates;

create policy "affiliates_responsible_select_assigned"
on public.affiliates
for select
to authenticated
using (
  responsible_id = auth.uid()
  and public.has_role(array['responsable', 'supervisor', 'admin'])
);

create policy "affiliates_admin_supervisor_update_assignment"
on public.affiliates
for update
to authenticated
using (public.has_role(array['admin', 'supervisor']))
with check (public.has_role(array['admin', 'supervisor']));