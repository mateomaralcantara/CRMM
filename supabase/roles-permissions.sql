-- CRM Services — Roles y permisos base
-- Ejecutar en Supabase SQL Editor

create extension if not exists "pgcrypto";

-- =========================
-- 1. Enum de roles
-- =========================

do $$
begin
  create type public.app_role as enum (
    'admin',
    'supervisor',
    'vendedor',
    'responsable',
    'soporte',
    'afiliado',
    'cliente'
  );
exception
  when duplicate_object then null;
end $$;

-- =========================
-- 2. Tabla profiles
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  phone text,
  role public.app_role not null default 'cliente',
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- =========================
-- 3. Funciones de seguridad
-- =========================

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
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
    and role = 'admin'
  );
$$;

create or replace function public.has_role(allowed_roles public.app_role[])
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
    and role = any(allowed_roles)
  );
$$;

-- =========================
-- 4. Trigger para crear profile automático
-- =========================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'cliente'),
    'activo'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- =========================
-- 5. Políticas para profiles
-- =========================

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_admin_select_all" on public.profiles;
drop policy if exists "profiles_admin_update_all" on public.profiles;
drop policy if exists "profiles_user_update_own_basic" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_admin_select_all"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "profiles_admin_update_all"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "profiles_user_update_own_basic"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = public.current_user_role()
);

-- =========================
-- 6. Tabla de permisos por módulo
-- =========================

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_assign boolean not null default false,
  can_export boolean not null default false,
  can_pay_commissions boolean not null default false,
  created_at timestamptz not null default now(),
  unique(role, module)
);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_admin_all" on public.role_permissions;
drop policy if exists "role_permissions_authenticated_read" on public.role_permissions;

create policy "role_permissions_admin_all"
on public.role_permissions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "role_permissions_authenticated_read"
on public.role_permissions
for select
to authenticated
using (true);

-- =========================
-- 7. Permisos iniciales
-- =========================

insert into public.role_permissions
(role, module, can_view, can_create, can_edit, can_delete, can_approve, can_assign, can_export, can_pay_commissions)
values
-- Admin
('admin', 'usuarios', true, true, true, true, true, true, true, true),
('admin', 'clientes', true, true, true, true, true, true, true, true),
('admin', 'leads', true, true, true, true, true, true, true, true),
('admin', 'afiliados', true, true, true, true, true, true, true, true),
('admin', 'servicios', true, true, true, true, true, true, true, true),
('admin', 'ventas', true, true, true, true, true, true, true, true),
('admin', 'pagos', true, true, true, true, true, true, true, true),
('admin', 'comisiones', true, true, true, true, true, true, true, true),
('admin', 'tickets', true, true, true, true, true, true, true, true),
('admin', 'reportes', true, true, true, true, true, true, true, true),

-- Supervisor
('supervisor', 'usuarios', true, false, true, false, true, true, true, false),
('supervisor', 'clientes', true, true, true, false, true, true, true, false),
('supervisor', 'leads', true, true, true, false, true, true, true, false),
('supervisor', 'afiliados', true, true, true, false, true, true, true, false),
('supervisor', 'servicios', true, true, true, false, true, true, true, false),
('supervisor', 'ventas', true, true, true, false, true, true, true, false),
('supervisor', 'pagos', true, false, true, false, true, false, true, false),
('supervisor', 'comisiones', true, false, true, false, true, false, true, false),
('supervisor', 'tickets', true, true, true, false, true, true, true, false),
('supervisor', 'reportes', true, false, false, false, false, false, true, false),

-- Vendedor
('vendedor', 'clientes', true, true, true, false, false, false, false, false),
('vendedor', 'leads', true, true, true, false, false, false, false, false),
('vendedor', 'ventas', true, true, true, false, false, false, false, false),
('vendedor', 'cotizaciones', true, true, true, false, false, false, false, false),
('vendedor', 'tareas', true, true, true, false, false, false, false, false),

-- Responsable
('responsable', 'clientes', true, false, true, false, false, false, false, false),
('responsable', 'servicios', true, true, true, false, false, false, false, false),
('responsable', 'solicitudes', true, true, true, false, false, false, false, false),
('responsable', 'tareas', true, true, true, false, false, false, false, false),
('responsable', 'documentos', true, true, true, false, false, false, false, false),

-- Soporte
('soporte', 'clientes', true, false, true, false, false, false, false, false),
('soporte', 'tickets', true, true, true, false, false, false, false, false),
('soporte', 'documentos', true, true, false, false, false, false, false, false),

-- Afiliado
('afiliado', 'portal_afiliado', true, true, true, false, false, false, false, false),
('afiliado', 'referidos', true, true, false, false, false, false, false, false),
('afiliado', 'comisiones', true, false, false, false, false, false, false, false),

-- Cliente
('cliente', 'portal_cliente', true, true, true, false, false, false, false, false),
('cliente', 'solicitudes', true, true, false, false, false, false, false, false),
('cliente', 'tickets', true, true, true, false, false, false, false, false),
('cliente', 'documentos', true, true, false, false, false, false, false, false)
on conflict (role, module) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve,
  can_assign = excluded.can_assign,
  can_export = excluded.can_export,
  can_pay_commissions = excluded.can_pay_commissions;