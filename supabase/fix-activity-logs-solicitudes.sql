-- CRM Services — Fix activity_logs para Solicitudes
-- Corrige el error:
-- column "table_name" of relation "activity_logs" does not exist

create extension if not exists "pgcrypto";

-- 1. Crear tabla base si no existe
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 2. Agregar columnas faltantes aunque la tabla ya exista
alter table public.activity_logs
add column if not exists user_id uuid references public.profiles(id) on delete set null,
add column if not exists action text,
add column if not exists table_name text,
add column if not exists record_id text,
add column if not exists old_data jsonb,
add column if not exists new_data jsonb,
add column if not exists ip_address text,
add column if not exists user_agent text;

-- 3. Rellenar valores viejos si hay registros incompletos
update public.activity_logs
set
  action = coalesce(action, 'unknown'),
  table_name = coalesce(table_name, 'unknown')
where action is null
   or table_name is null;

-- 4. Hacer obligatorias las columnas principales
alter table public.activity_logs
alter column action set not null;

alter table public.activity_logs
alter column table_name set not null;

-- 5. Funciones de rol
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'admin'
      and p.status::text in ('activo', 'active')
  );
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'supervisor'
      and p.status::text in ('activo', 'active')
  );
$$;

create or replace function public.is_admin_or_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_supervisor();
$$;

-- 6. Activar RLS
alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_admin_supervisor_select_all" on public.activity_logs;
drop policy if exists "activity_logs_authenticated_insert_own" on public.activity_logs;

-- Admin y supervisor ven todo el historial
create policy "activity_logs_admin_supervisor_select_all"
on public.activity_logs
for select
to authenticated
using (public.is_admin_or_supervisor());

-- Usuarios autenticados solo pueden insertar actividad propia
create policy "activity_logs_authenticated_insert_own"
on public.activity_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
);