-- FINANCIAL CORE V1 — PREFLIGHT
-- Run FIRST. Makes the migration independent from historical migration order.

create extension if not exists "pgcrypto";

-- Affiliate type/rate catalog may come from an older optional migration.
create table if not exists public.affiliate_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  default_commission_rate numeric(7,2) not null default 0,
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Affiliate identity/assignment fields used by RLS and payment attribution.
alter table public.affiliates
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists affiliate_type_id uuid references public.affiliate_types(id) on delete set null,
  add column if not exists commission_rate numeric(7,2) not null default 0;

-- Core commercial fields expected by Financial Core.
alter table public.sales
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists business_unit text,
  add column if not exists collected_amount numeric(12,2) not null default 0;

alter table public.clients
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

alter table public.leads
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

alter table public.referrals
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

-- Payments/commissions may come from the original schema or later specializations.
alter table public.payments
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

alter table public.commissions
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete cascade,
  add column if not exists sale_id uuid references public.sales(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();

-- Seed canonical types only when missing. Existing custom rates are preserved.
insert into public.affiliate_types (code, name, default_commission_rate, status)
values
  ('referidor', 'Afiliado referidor', 5, 'activo'),
  ('promotor', 'Afiliado promotor', 8, 'activo'),
  ('premium', 'Afiliado premium', 12, 'activo'),
  ('agencia', 'Agencia afiliada', 15, 'activo'),
  ('empresa', 'Empresa afiliada', 10, 'activo'),
  ('influencer', 'Influencer', 10, 'activo')
on conflict (code) do nothing;

-- Ensure opportunities exists before Financial Core attempts scoped RLS/sync.
-- Normally created by reto-111-specialization.sql.
do $$
begin
  if to_regclass('public.opportunities') is null then
    raise exception 'Financial Core requires public.opportunities. Apply supabase/reto-111-specialization.sql first.';
  end if;
end $$;
