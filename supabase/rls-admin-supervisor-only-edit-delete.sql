-- CRM Services
-- Solo admin y supervisor pueden modificar o eliminar.
-- Otros roles pueden ver/crear solo registros propios o asignados.

create extension if not exists "pgcrypto";

-- =========================
-- 1. Funciones base
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
-- 2. Asegurar columnas necesarias
-- =========================

alter table public.tasks
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz default now();

alter table public.tickets
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz default now();

alter table public.leads
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz default now();

alter table public.clients
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz default now();

alter table public.service_requests
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz default now();

alter table public.affiliates
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
add column if not exists user_id uuid references public.profiles(id) on delete set null,
add column if not exists updated_at timestamptz default now();

-- =========================
-- 3. Activar RLS
-- =========================

alter table public.tasks enable row level security;
alter table public.tickets enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.service_requests enable row level security;
alter table public.affiliates enable row level security;

-- =========================
-- 4. Limpiar políticas viejas
-- Esto es importante para que no quede una policy vieja permitiendo update/delete.
-- =========================

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'tasks',
        'tickets',
        'leads',
        'clients',
        'service_requests',
        'affiliates'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end $$;

-- =====================================================
-- TASKS
-- =====================================================

create policy "tasks_admin_supervisor_select_all"
on public.tasks
for select
to authenticated
using (public.is_admin_or_supervisor());

create policy "tasks_user_select_related"
on public.tasks
for select
to authenticated
using (
  public.has_role(array[
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

create policy "tasks_insert_own"
on public.tasks
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
  and (
    public.is_admin_or_supervisor()
    or created_by = auth.uid()
  )
);

create policy "tasks_admin_supervisor_update_all"
on public.tasks
for update
to authenticated
using (public.is_admin_or_supervisor())
with check (public.is_admin_or_supervisor());

create policy "tasks_admin_supervisor_delete_all"
on public.tasks
for delete
to authenticated
using (public.is_admin_or_supervisor());

-- =====================================================
-- TICKETS
-- =====================================================

create policy "tickets_admin_supervisor_select_all"
on public.tickets
for select
to authenticated
using (public.is_admin_or_supervisor());

create policy "tickets_user_select_related"
on public.tickets
for select
to authenticated
using (
  public.has_role(array[
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

create policy "tickets_insert_own"
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
  and (
    public.is_admin_or_supervisor()
    or created_by = auth.uid()
  )
);

create policy "tickets_admin_supervisor_update_all"
on public.tickets
for update
to authenticated
using (public.is_admin_or_supervisor())
with check (public.is_admin_or_supervisor());

create policy "tickets_admin_supervisor_delete_all"
on public.tickets
for delete
to authenticated
using (public.is_admin_or_supervisor());

-- =====================================================
-- LEADS
-- =====================================================

create policy "leads_admin_supervisor_select_all"
on public.leads
for select
to authenticated
using (public.is_admin_or_supervisor());

create policy "leads_user_select_related"
on public.leads
for select
to authenticated
using (
  public.has_role(array[
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

create policy "leads_insert_own"
on public.leads
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
  and (
    public.is_admin_or_supervisor()
    or created_by = auth.uid()
  )
);

create policy "leads_admin_supervisor_update_all"
on public.leads
for update
to authenticated
using (public.is_admin_or_supervisor())
with check (public.is_admin_or_supervisor());

create policy "leads_admin_supervisor_delete_all"
on public.leads
for delete
to authenticated
using (public.is_admin_or_supervisor());

-- =====================================================
-- CLIENTS
-- =====================================================

create policy "clients_admin_supervisor_select_all"
on public.clients
for select
to authenticated
using (public.is_admin_or_supervisor());

create policy "clients_user_select_related"
on public.clients
for select
to authenticated
using (
  public.has_role(array[
    'responsable',
    'vendedor',
    'soporte'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
  )
);

create policy "clients_insert_own"
on public.clients
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
  and (
    public.is_admin_or_supervisor()
    or created_by = auth.uid()
  )
);

create policy "clients_admin_supervisor_update_all"
on public.clients
for update
to authenticated
using (public.is_admin_or_supervisor())
with check (public.is_admin_or_supervisor());

create policy "clients_admin_supervisor_delete_all"
on public.clients
for delete
to authenticated
using (public.is_admin_or_supervisor());

-- =====================================================
-- SERVICE REQUESTS
-- =====================================================

create policy "service_requests_admin_supervisor_select_all"
on public.service_requests
for select
to authenticated
using (public.is_admin_or_supervisor());

create policy "service_requests_user_select_related"
on public.service_requests
for select
to authenticated
using (
  public.has_role(array[
    'responsable',
    'vendedor',
    'soporte',
    'promotor',
    'afiliado',
    'cliente'
  ]::text[])
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
  )
);

create policy "service_requests_insert_own"
on public.service_requests
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
    'afiliado',
    'cliente'
  ]::text[])
  and (
    public.is_admin_or_supervisor()
    or created_by = auth.uid()
  )
);

create policy "service_requests_admin_supervisor_update_all"
on public.service_requests
for update
to authenticated
using (public.is_admin_or_supervisor())
with check (public.is_admin_or_supervisor());

create policy "service_requests_admin_supervisor_delete_all"
on public.service_requests
for delete
to authenticated
using (public.is_admin_or_supervisor());

-- =====================================================
-- AFFILIATES
-- =====================================================

create policy "affiliates_admin_supervisor_select_all"
on public.affiliates
for select
to authenticated
using (public.is_admin_or_supervisor());

create policy "affiliates_user_select_own"
on public.affiliates
for select
to authenticated
using (
  public.has_role(array[
    'promotor',
    'afiliado'
  ]::text[])
  and (
    user_id = auth.uid()
    or created_by = auth.uid()
    or responsible_id = auth.uid()
  )
);

create policy "affiliates_insert_own"
on public.affiliates
for insert
to authenticated
with check (
  public.has_role(array[
    'admin',
    'supervisor',
    'promotor',
    'afiliado'
  ]::text[])
  and (
    public.is_admin_or_supervisor()
    or created_by = auth.uid()
    or user_id = auth.uid()
  )
);

create policy "affiliates_admin_supervisor_update_all"
on public.affiliates
for update
to authenticated
using (public.is_admin_or_supervisor())
with check (public.is_admin_or_supervisor());

create policy "affiliates_admin_supervisor_delete_all"
on public.affiliates
for delete
to authenticated
using (public.is_admin_or_supervisor());