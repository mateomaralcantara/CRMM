-- CRM Services — Fix permisos RLS para tickets
-- Admin ve/modifica todo.
-- Supervisor/responsable/vendedor/soporte ven tickets creados o asignados.
-- Promotor/afiliado ven solo sus propios tickets.

create extension if not exists "pgcrypto";

-- =========================
-- 1. Asegurar columnas necesarias
-- =========================

alter table public.tickets
add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.tickets
add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

alter table public.tickets
add column if not exists status text default 'abierto';

alter table public.tickets
add column if not exists updated_at timestamptz default now();

-- =========================
-- 2. Funciones base
-- =========================

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

create or replace function public.has_role(allowed_roles text[])
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
    and p.role::text = any(allowed_roles)
    and p.status::text in ('activo', 'active')
  );
$$;

-- =========================
-- 3. Activar RLS
-- =========================

alter table public.tickets enable row level security;

-- =========================
-- 4. Limpiar políticas viejas
-- =========================

drop policy if exists "tickets_admin_select_all" on public.tickets;
drop policy if exists "tickets_admin_insert_all" on public.tickets;
drop policy if exists "tickets_admin_update_all" on public.tickets;
drop policy if exists "tickets_admin_delete_all" on public.tickets;

drop policy if exists "tickets_user_select_related" on public.tickets;
drop policy if exists "tickets_user_insert_own" on public.tickets;
drop policy if exists "tickets_user_update_related" on public.tickets;
drop policy if exists "tickets_user_delete_own" on public.tickets;

-- =========================
-- 5. ADMIN: todo permitido
-- =========================

create policy "tickets_admin_select_all"
on public.tickets
for select
to authenticated
using (public.is_admin());

create policy "tickets_admin_insert_all"
on public.tickets
for insert
to authenticated
with check (public.is_admin());

create policy "tickets_admin_update_all"
on public.tickets
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "tickets_admin_delete_all"
on public.tickets
for delete
to authenticated
using (public.is_admin());

-- =========================
-- 6. Usuarios permitidos: ver tickets propios o asignados
-- =========================

create policy "tickets_user_select_related"
on public.tickets
for select
to authenticated
using (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte',
    'promotor',
    'afiliado'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_admin()
  )
);

-- =========================
-- 7. Usuarios permitidos: crear tickets propios
-- =========================

create policy "tickets_user_insert_own"
on public.tickets
for insert
to authenticated
with check (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte',
    'promotor',
    'afiliado'
  ]::text[])
  and created_by = auth.uid()
);

-- =========================
-- 8. Usuarios permitidos: modificar tickets relacionados
-- =========================

create policy "tickets_user_update_related"
on public.tickets
for update
to authenticated
using (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte',
    'promotor',
    'afiliado'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
  )
)
with check (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte',
    'promotor',
    'afiliado'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
  )
);

-- =========================
-- 9. Usuarios permitidos: eliminar solo tickets creados por ellos
-- =========================

create policy "tickets_user_delete_own"
on public.tickets
for delete
to authenticated
using (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte',
    'promotor',
    'afiliado'
  ]::text[])
  and created_by = auth.uid()
);