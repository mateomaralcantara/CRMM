-- FINANCIAL CORE V1 — PREFLIGHT
-- Run FIRST. Makes the migration independent from historical migration order.

create extension if not exists "pgcrypto";

-- Affiliate identity/assignment fields used by RLS and payment attribution.
alter table public.affiliates
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists commission_rate numeric(7,2) not null default 0;

-- Core commercial fields expected by Financial Core.
alter table public.sales
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists business_unit text,
  add column if not exists collected_amount numeric(12,2) not null default 0,
  add column if not exists opportunity_id uuid;

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

-- Ensure opportunities exists before Financial Core attempts scoped RLS/sync.
-- Normally created by reto-111-specialization.sql.
do $$
begin
  if to_regclass('public.opportunities') is null then
    raise exception 'Financial Core requires public.opportunities. Apply supabase/reto-111-specialization.sql first.';
  end if;
end $$;
