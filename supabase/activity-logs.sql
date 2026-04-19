-- CRM Services — Activity Logs / Auditoría
-- Permite que el admin vea qué hacen los usuarios.

create extension if not exists "pgcrypto";

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete set null,

  action text not null,
  table_name text not null,
  record_id text,

  old_data jsonb,
  new_data jsonb,

  ip_address text,
  user_agent text,

  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_admin_select_all" on public.activity_logs;
drop policy if exists "activity_logs_admin_insert_all" on public.activity_logs;

create policy "activity_logs_admin_select_all"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
    and p.status in ('activo', 'active')
  )
);

create policy "activity_logs_admin_insert_all"
on public.activity_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
    and p.status in ('activo', 'active')
  )
);