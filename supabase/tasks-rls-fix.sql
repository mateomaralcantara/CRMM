-- CRM Services — Fix permisos RLS para tareas/tasks
-- Admin ve/modifica todo.
-- Usuarios autorizados pueden crear tareas.
-- Usuarios ven/modifican tareas asignadas o creadas por ellos.

create extension if not exists "pgcrypto";

-- =========================
-- 1. Asegurar columnas necesarias
-- =========================

alter table public.tasks
add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.tasks
add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

alter table public.tasks
add column if not exists status text default 'pendiente';

alter table public.tasks
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

alter table public.tasks enable row level security;

-- =========================
-- 4. Limpiar políticas viejas de tasks
-- =========================

drop policy if exists "tasks_admin_select_all" on public.tasks;
drop policy if exists "tasks_admin_insert_all" on public.tasks;
drop policy if exists "tasks_admin_update_all" on public.tasks;
drop policy if exists "tasks_admin_delete_all" on public.tasks;

drop policy if exists "tasks_user_select_related" on public.tasks;
drop policy if exists "tasks_user_insert_own" on public.tasks;
drop policy if exists "tasks_user_update_related" on public.tasks;
drop policy if exists "tasks_user_delete_own" on public.tasks;

-- =========================
-- 5. ADMIN: todo permitido
-- =========================

create policy "tasks_admin_select_all"
on public.tasks
for select
to authenticated
using (public.is_admin());

create policy "tasks_admin_insert_all"
on public.tasks
for insert
to authenticated
with check (public.is_admin());

create policy "tasks_admin_update_all"
on public.tasks
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "tasks_admin_delete_all"
on public.tasks
for delete
to authenticated
using (public.is_admin());

-- =========================
-- 6. Usuarios internos: ver tareas relacionadas
-- =========================

create policy "tasks_user_select_related"
on public.tasks
for select
to authenticated
using (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_admin()
  )
);

-- =========================
-- 7. Usuarios internos: crear tareas
-- =========================

create policy "tasks_user_insert_own"
on public.tasks
for insert
to authenticated
with check (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte'
  ]::text[])
  and created_by = auth.uid()
);

-- =========================
-- 8. Usuarios internos: modificar tareas relacionadas
-- =========================

create policy "tasks_user_update_related"
on public.tasks
for update
to authenticated
using (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte'
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
    'soporte'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
  )
);

-- =========================
-- 9. Usuario puede eliminar solo tareas creadas por él
-- =========================

create policy "tasks_user_delete_own"
on public.tasks
for delete
to authenticated
using (
  public.has_role(array[
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte'
  ]::text[])
  and created_by = auth.uid()
);