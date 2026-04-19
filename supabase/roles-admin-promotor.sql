-- CRM Services — Roles Admin y Promotor
-- Admin ve/modifica todo.
-- Promotor solo ve/gestiona sus propios datos.

create extension if not exists "pgcrypto";

-- =========================
-- 1. Asegurar columnas base
-- =========================

alter table public.profiles
add column if not exists role text default 'cliente';

alter table public.profiles
add column if not exists status text default 'activo';

alter table public.affiliates
add column if not exists user_id uuid references public.profiles(id) on delete set null;

alter table public.affiliates
add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.leads
add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.commissions
add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null;

-- =========================
-- 2. Permitir role = promotor
-- =========================

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (
  role in (
    'admin',
    'supervisor',
    'responsable',
    'vendedor',
    'soporte',
    'afiliado',
    'promotor',
    'cliente'
  )
);

alter table public.profiles
drop constraint if exists profiles_status_check;

alter table public.profiles
add constraint profiles_status_check
check (
  status in (
    'activo',
    'active',
    'inactivo',
    'inactive',
    'suspendido',
    'suspended'
  )
);

-- =========================
-- 3. Funciones de seguridad
-- =========================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_active_user()
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
    and p.status::text in ('activo', 'active')
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
    from public.profiles p
    where p.id = auth.uid()
    and p.role::text = 'admin'
    and p.status::text in ('activo', 'active')
  );
$$;

create or replace function public.is_promotor()
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
    and p.role::text in ('promotor', 'afiliado')
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
-- 4. Activar RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.affiliates enable row level security;
alter table public.leads enable row level security;
alter table public.commissions enable row level security;

-- =========================
-- 5. Limpiar políticas anteriores
-- OJO: esto evita que una política vieja deje ver todo.
-- =========================

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
    and tablename in ('profiles', 'affiliates', 'leads', 'commissions')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end $$;

-- =========================
-- 6. POLÍTICAS: profiles
-- =========================

-- Admin ve todos los perfiles.
create policy "profiles_admin_select_all"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- Admin modifica todos los perfiles.
create policy "profiles_admin_update_all"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Usuario normal/promotor ve su propio perfil.
create policy "profiles_user_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Usuario normal/promotor modifica solo su propio perfil,
-- pero no puede cambiar su role ni hacerse admin.
create policy "profiles_user_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = public.current_user_role()
);

-- =========================
-- 7. POLÍTICAS: affiliates
-- =========================

-- Admin ve todo.
create policy "affiliates_admin_select_all"
on public.affiliates
for select
to authenticated
using (public.is_admin());

-- Admin crea todo.
create policy "affiliates_admin_insert_all"
on public.affiliates
for insert
to authenticated
with check (public.is_admin());

-- Admin modifica todo.
create policy "affiliates_admin_update_all"
on public.affiliates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Admin elimina todo.
create policy "affiliates_admin_delete_all"
on public.affiliates
for delete
to authenticated
using (public.is_admin());

-- Promotor ve solo su propio registro de afiliado.
create policy "affiliates_promotor_select_own"
on public.affiliates
for select
to authenticated
using (
  public.is_promotor()
  and (
    user_id = auth.uid()
    or created_by = auth.uid()
  )
);

-- Promotor modifica solo su propio registro.
create policy "affiliates_promotor_update_own"
on public.affiliates
for update
to authenticated
using (
  public.is_promotor()
  and (
    user_id = auth.uid()
    or created_by = auth.uid()
  )
)
with check (
  public.is_promotor()
  and (
    user_id = auth.uid()
    or created_by = auth.uid()
  )
);

-- =========================
-- 8. POLÍTICAS: leads
-- =========================

-- Admin ve todos los leads.
create policy "leads_admin_select_all"
on public.leads
for select
to authenticated
using (public.is_admin());

-- Admin crea leads.
create policy "leads_admin_insert_all"
on public.leads
for insert
to authenticated
with check (public.is_admin());

-- Admin modifica leads.
create policy "leads_admin_update_all"
on public.leads
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Admin elimina leads.
create policy "leads_admin_delete_all"
on public.leads
for delete
to authenticated
using (public.is_admin());

-- Promotor ve solo sus propios leads.
create policy "leads_promotor_select_own"
on public.leads
for select
to authenticated
using (
  public.is_promotor()
  and created_by = auth.uid()
);

-- Promotor crea leads propios.
create policy "leads_promotor_insert_own"
on public.leads
for insert
to authenticated
with check (
  public.is_promotor()
  and created_by = auth.uid()
);

-- Promotor modifica solo sus propios leads.
create policy "leads_promotor_update_own"
on public.leads
for update
to authenticated
using (
  public.is_promotor()
  and created_by = auth.uid()
)
with check (
  public.is_promotor()
  and created_by = auth.uid()
);

-- =========================
-- 9. POLÍTICAS: commissions
-- =========================

-- Admin ve todas las comisiones.
create policy "commissions_admin_select_all"
on public.commissions
for select
to authenticated
using (public.is_admin());

-- Admin modifica todas las comisiones.
create policy "commissions_admin_update_all"
on public.commissions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Promotor ve solo sus propias comisiones.
create policy "commissions_promotor_select_own"
on public.commissions
for select
to authenticated
using (
  public.is_promotor()
  and exists (
    select 1
    from public.affiliates a
    where a.id = commissions.affiliate_id
    and (
      a.user_id = auth.uid()
      or a.created_by = auth.uid()
    )
  )
);