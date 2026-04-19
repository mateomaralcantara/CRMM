-- CRM Services — Usuarios y Roles
-- Compatible con role como text

create extension if not exists "pgcrypto";

-- =========================
-- 1. Asegurar columnas en profiles
-- =========================

alter table public.profiles
add column if not exists role text default 'cliente';

alter table public.profiles
add column if not exists status text default 'activo';

update public.profiles
set role = 'cliente'
where role is null
   or role not in (
    'admin',
    'supervisor',
    'vendedor',
    'responsable',
    'soporte',
    'afiliado',
    'cliente'
   );

update public.profiles
set status = 'activo'
where status is null
   or status not in (
    'activo',
    'inactivo',
    'suspendido'
   );

alter table public.profiles
alter column role set default 'cliente';

alter table public.profiles
alter column status set default 'activo';

alter table public.profiles
alter column role set not null;

alter table public.profiles
alter column status set not null;

-- =========================
-- 2. Limpiar funciones anteriores
-- =========================

drop function if exists public.current_user_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.has_role(text[]) cascade;
drop function if exists public.admin_update_user_profile(uuid, text, text) cascade;

-- =========================
-- 3. Funciones base
-- =========================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
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
    and status = 'activo'
  );
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
    and role = any(allowed_roles)
    and status = 'activo'
  );
$$;

-- =========================
-- 4. Función segura para actualizar rol y estado
-- =========================

create or replace function public.admin_update_user_profile(
  target_user_id uuid,
  new_role text,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_target_role text;
  current_target_status text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if new_role not in (
    'admin',
    'supervisor',
    'vendedor',
    'responsable',
    'soporte',
    'afiliado',
    'cliente'
  ) then
    raise exception 'Rol inválido';
  end if;

  if new_status not in (
    'activo',
    'inactivo',
    'suspendido'
  ) then
    raise exception 'Estado inválido';
  end if;

  select role, status
  into current_target_role, current_target_status
  from public.profiles
  where id = target_user_id
  for update;

  if current_target_role is null then
    raise exception 'Usuario no encontrado';
  end if;

  -- Evita que el admin se saque el acceso a sí mismo.
  if target_user_id = auth.uid()
     and (new_role <> 'admin' or new_status <> 'activo') then
    raise exception 'No puedes quitarte el rol admin ni desactivarte a ti mismo';
  end if;

  update public.profiles
  set role = new_role,
      status = new_status,
      updated_at = now()
  where id = target_user_id;
end;
$$;

-- =========================
-- 5. RLS para profiles
-- =========================

alter table public.profiles enable row level security;

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