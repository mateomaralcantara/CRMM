-- ============================================================
-- CRM SERVICES — FINANCIAL CORE V1 + ROLES/RLS V2
-- Payment = source of truth for real cash.
-- Admin + super_admin = only globally privileged roles.
-- Normal users only see their own/assigned/attributed data.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Roles and security helpers
-- ------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role'
  ) then
    begin
      alter type public.app_role add value if not exists 'super_admin';
    exception when others then null;
    end;
    begin
      alter type public.app_role add value if not exists 'promotor';
    exception when others then null;
    end;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
check (role::text in (
  'super_admin','admin','supervisor','responsable','vendedor','soporte','afiliado','promotor','cliente'
));

create or replace function public.current_role_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
    and p.status::text in ('activo','active')
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_text() = 'super_admin', false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_text() in ('super_admin','admin'), false);
$$;

create or replace function public.is_financial_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_text() = any(allowed_roles), false);
$$;

create or replace function public.owns_affiliate(target_affiliate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.affiliates a
    where a.id = target_affiliate_id
      and (
        a.user_id = auth.uid()
        or a.profile_id = auth.uid()
        or a.created_by = auth.uid()
      )
  );
$$;

-- ------------------------------------------------------------
-- 2. Payment attribution snapshot
-- ------------------------------------------------------------

alter table public.payments
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists business_unit text,
  add column if not exists attribution_locked boolean not null default false;

create index if not exists idx_payments_affiliate_id on public.payments(affiliate_id);
create index if not exists idx_payments_responsible_id on public.payments(responsible_id);
create index if not exists idx_payments_business_unit on public.payments(business_unit);
create index if not exists idx_payments_paid_at on public.payments(paid_at);

create or replace function public.snapshot_payment_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sales%rowtype;
begin
  if new.sale_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.attribution_locked = true
     and old.sale_id is not distinct from new.sale_id then
    new.client_id := old.client_id;
    new.affiliate_id := old.affiliate_id;
    new.responsible_id := old.responsible_id;
    new.business_unit := old.business_unit;
    new.attribution_locked := true;
    return new;
  end if;

  select * into s from public.sales where id = new.sale_id;

  if found then
    new.client_id := coalesce(new.client_id, s.client_id);
    new.affiliate_id := s.affiliate_id;
    new.responsible_id := s.responsible_id;
    new.business_unit := s.business_unit;
    new.attribution_locked := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_snapshot_attribution on public.payments;
create trigger trg_payments_snapshot_attribution
before insert or update of sale_id on public.payments
for each row execute function public.snapshot_payment_attribution();

-- Backfill current payments without changing historical payment amounts/statuses.
update public.payments p
set
  client_id = coalesce(p.client_id, s.client_id),
  affiliate_id = coalesce(p.affiliate_id, s.affiliate_id),
  responsible_id = coalesce(p.responsible_id, s.responsible_id),
  business_unit = coalesce(p.business_unit, s.business_unit),
  attribution_locked = true
from public.sales s
where p.sale_id = s.id
  and p.attribution_locked = false;

-- ------------------------------------------------------------
-- 3. Central financial ledger
-- ------------------------------------------------------------

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid unique references public.payments(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  responsible_id uuid references public.profiles(id) on delete set null,
  business_unit text,
  transaction_type text not null default 'income'
    check (transaction_type in ('income','refund','adjustment')),
  amount numeric(14,2) not null default 0,
  status text not null default 'posted'
    check (status in ('posted','voided')),
  method text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financial_transactions_occurred_at
  on public.financial_transactions(occurred_at desc);
create index if not exists idx_financial_transactions_responsible
  on public.financial_transactions(responsible_id, occurred_at desc);
create index if not exists idx_financial_transactions_affiliate
  on public.financial_transactions(affiliate_id, occurred_at desc);
create index if not exists idx_financial_transactions_business_unit
  on public.financial_transactions(business_unit, occurred_at desc);

create or replace function public.sync_payment_to_financial_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.financial_transactions
    set status = 'voided', updated_at = now()
    where payment_id = old.id;
    return old;
  end if;

  if new.status in ('parcial','completado') then
    insert into public.financial_transactions (
      payment_id, sale_id, client_id, affiliate_id, responsible_id,
      business_unit, transaction_type, amount, status, method,
      occurred_at, created_by, snapshot, updated_at
    )
    values (
      new.id, new.sale_id, new.client_id, new.affiliate_id, new.responsible_id,
      new.business_unit, 'income', new.amount, 'posted', new.method,
      coalesce(new.paid_at, new.created_at, now()), new.created_by,
      jsonb_build_object(
        'sale_id', new.sale_id,
        'client_id', new.client_id,
        'affiliate_id', new.affiliate_id,
        'responsible_id', new.responsible_id,
        'business_unit', new.business_unit
      ),
      now()
    )
    on conflict (payment_id) do update set
      amount = excluded.amount,
      status = 'posted',
      method = excluded.method,
      occurred_at = excluded.occurred_at,
      updated_at = now();
  else
    update public.financial_transactions
    set status = 'voided', updated_at = now()
    where payment_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_financial_ledger on public.payments;
create trigger trg_payment_financial_ledger
after insert or update or delete on public.payments
for each row execute function public.sync_payment_to_financial_ledger();

-- Backfill ledger from real historical collections.
insert into public.financial_transactions (
  payment_id, sale_id, client_id, affiliate_id, responsible_id,
  business_unit, transaction_type, amount, status, method,
  occurred_at, created_by, snapshot
)
select
  p.id, p.sale_id, p.client_id, p.affiliate_id, p.responsible_id,
  p.business_unit, 'income', p.amount, 'posted', p.method,
  coalesce(p.paid_at, p.created_at, now()), p.created_by,
  jsonb_build_object(
    'sale_id', p.sale_id,
    'client_id', p.client_id,
    'affiliate_id', p.affiliate_id,
    'responsible_id', p.responsible_id,
    'business_unit', p.business_unit
  )
from public.payments p
where p.status in ('parcial','completado')
on conflict (payment_id) do nothing;

-- ------------------------------------------------------------
-- 4. Commission engine based on collected cash
-- ------------------------------------------------------------

alter table public.commissions
  add column if not exists payment_id uuid references public.payments(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists business_unit text,
  add column if not exists basis_amount numeric(14,2) not null default 0,
  add column if not exists origin text not null default 'legacy'
    check (origin in ('legacy','payment'));

create unique index if not exists uq_commissions_payment_auto
  on public.commissions(payment_id)
  where payment_id is not null and origin = 'payment';

create index if not exists idx_commissions_affiliate_created
  on public.commissions(affiliate_id, created_at desc);
create index if not exists idx_commissions_responsible_created
  on public.commissions(responsible_id, created_at desc);

create or replace function public.get_sale_commission_rate(target_sale_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_rate numeric;
begin
  select s.affiliate_id into v_affiliate_id
  from public.sales s
  where s.id = target_sale_id;

  if v_affiliate_id is null then
    return 0;
  end if;

  select c.rate into v_rate
  from public.commissions c
  where c.sale_id = target_sale_id
    and c.affiliate_id = v_affiliate_id
    and c.rate is not null
    and c.rate > 0
  order by case when c.origin = 'legacy' then 0 else 1 end, c.created_at asc
  limit 1;

  if v_rate is not null then
    return v_rate;
  end if;

  select at.default_commission_rate into v_rate
  from public.affiliates a
  left join public.affiliate_types at on at.id = a.affiliate_type_id
  where a.id = v_affiliate_id;

  return coalesce(v_rate, 0);
end;
$$;

create or replace function public.recalculate_sale_commissions(target_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_responsible_id uuid;
  v_business_unit text;
  v_rate numeric := 0;
  v_legacy_total numeric := 0;
  v_allocated numeric := 0;
  v_cumulative numeric := 0;
  v_expected numeric := 0;
  v_amount numeric := 0;
  p record;
begin
  if target_sale_id is null then return; end if;

  select affiliate_id, responsible_id, business_unit
  into v_affiliate_id, v_responsible_id, v_business_unit
  from public.sales
  where id = target_sale_id;

  if v_affiliate_id is null then
    update public.commissions
    set amount = 0, status = case when status = 'pagada' then status else 'cancelada' end
    where sale_id = target_sale_id and origin = 'payment' and status <> 'pagada';
    return;
  end if;

  v_rate := public.get_sale_commission_rate(target_sale_id);

  select coalesce(sum(amount), 0) into v_legacy_total
  from public.commissions
  where sale_id = target_sale_id
    and affiliate_id = v_affiliate_id
    and origin = 'legacy'
    and status <> 'cancelada';

  v_allocated := v_legacy_total;

  for p in
    select *
    from public.payments
    where sale_id = target_sale_id
      and status in ('parcial','completado')
    order by coalesce(paid_at, created_at) asc, created_at asc, id asc
  loop
    v_cumulative := v_cumulative + coalesce(p.amount, 0);
    v_expected := round((v_cumulative * v_rate / 100.0)::numeric, 2);
    v_amount := greatest(v_expected - v_allocated, 0);

    insert into public.commissions (
      affiliate_id, sale_id, payment_id, responsible_id, business_unit,
      type, rate, basis_amount, amount, status, origin, created_by,
      approved_at, paid_at
    )
    values (
      v_affiliate_id, target_sale_id, p.id, v_responsible_id, v_business_unit,
      'porcentual', v_rate, p.amount, v_amount,
      case when v_amount > 0 then 'generada' else 'cancelada' end,
      'payment', p.created_by, null, null
    )
    on conflict (payment_id) where payment_id is not null and origin = 'payment'
    do update set
      affiliate_id = excluded.affiliate_id,
      responsible_id = excluded.responsible_id,
      business_unit = excluded.business_unit,
      rate = excluded.rate,
      basis_amount = excluded.basis_amount,
      amount = case
        when public.commissions.status = 'pagada' then public.commissions.amount
        else excluded.amount
      end,
      status = case
        when public.commissions.status = 'pagada' then 'pagada'
        when excluded.amount > 0 then public.commissions.status
        else 'cancelada'
      end;

    v_allocated := v_allocated + v_amount;
  end loop;

  update public.commissions c
  set amount = 0,
      status = case when c.status = 'pagada' then c.status else 'cancelada' end
  where c.sale_id = target_sale_id
    and c.origin = 'payment'
    and c.payment_id is not null
    and not exists (
      select 1
      from public.payments p2
      where p2.id = c.payment_id
        and p2.status in ('parcial','completado')
    )
    and c.status <> 'pagada';
end;
$$;

create or replace function public.refresh_commissions_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_sale_commissions(old.sale_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.sale_id is distinct from new.sale_id then
    perform public.recalculate_sale_commissions(old.sale_id);
  end if;

  perform public.recalculate_sale_commissions(new.sale_id);
  return new;
end;
$$;

drop trigger if exists trg_payment_recalculate_commissions on public.payments;
create trigger trg_payment_recalculate_commissions
after insert or update or delete on public.payments
for each row execute function public.refresh_commissions_from_payment();

create or replace function public.prevent_paid_commission_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.id else old.id end;

  if exists (
    select 1 from public.commissions c
    where c.payment_id = target_id
      and c.status = 'pagada'
  ) then
    raise exception 'No se puede modificar/eliminar un pago cuya comisión ya fue pagada';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_paid_commission_payment on public.payments;
create trigger trg_guard_paid_commission_payment
before update or delete on public.payments
for each row execute function public.prevent_paid_commission_payment_mutation();

-- ------------------------------------------------------------
-- 5. Opportunity cash synchronization
-- ------------------------------------------------------------

create or replace function public.recalculate_opportunity_financials(target_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$;
declare
  sold numeric := 0;
  collected numeric := 0;
begin
  if target_opportunity_id is null then return; end if;

  select coalesce(sum(amount),0), coalesce(sum(collected_amount),0)
  into sold, collected
  from public.sales
  where opportunity_id = target_opportunity_id
    and status <> 'cancelada';

  update public.opportunities
  set sold_amount = sold,
      collected_amount = collected,
      updated_at = now()
  where id = target_opportunity_id;
end;
$$;

create or replace function public.refresh_opportunity_from_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_opportunity_financials(old.opportunity_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.opportunity_id is distinct from new.opportunity_id then
    perform public.recalculate_opportunity_financials(old.opportunity_id);
  end if;

  perform public.recalculate_opportunity_financials(new.opportunity_id);
  return new;
end;
$$;

drop trigger if exists trg_sales_refresh_opportunity_financials on public.sales;
create trigger trg_sales_refresh_opportunity_financials
after insert or update or delete on public.sales
for each row execute function public.refresh_opportunity_from_sale();

-- ------------------------------------------------------------
-- 6. Affiliate totals from commissions
-- ------------------------------------------------------------

create or replace function public.recalculate_affiliate_commission_totals(target_affiliate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$;
declare
  accumulated numeric := 0;
  paid numeric := 0;
  pending numeric := 0;
begin
  if target_affiliate_id is null then return; end if;

  select
    coalesce(sum(amount) filter (where status <> 'cancelada'), 0),
    coalesce(sum(amount) filter (where status = 'pagada'), 0),
    coalesce(sum(amount) filter (where status in ('generada','retenida','aprobada')), 0)
  into accumulated, paid, pending
  from public.commissions
  where affiliate_id = target_affiliate_id;

  update public.affiliates
  set commission_accumulated = accumulated,
      commission_paid = paid,
      commission_pending = pending,
      updated_at = now()
  where id = target_affiliate_id;
end;
$$;

create or replace function public.refresh_affiliate_commission_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_affiliate_commission_totals(old.affiliate_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.affiliate_id is distinct from new.affiliate_id then
    perform public.recalculate_affiliate_commission_totals(old.affiliate_id);
  end if;

  perform public.recalculate_affiliate_commission_totals(new.affiliate_id);
  return new;
end;
$$;

drop trigger if exists trg_commissions_refresh_affiliate_totals on public.commissions;
create trigger trg_commissions_refresh_affiliate_totals
after insert or update or delete on public.commissions
for each row execute function public.refresh_affiliate_commission_totals();

-- ------------------------------------------------------------
-- 7. Security-invoker financial views
-- ------------------------------------------------------------

create or replace view public.financial_transactions_view
with (security_invoker = true)
as
select
  ft.id,
  ft.payment_id,
  ft.sale_id,
  s.title as sale_title,
  ft.client_id,
  c.name as client_name,
  ft.affiliate_id,
  a.name as affiliate_name,
  ft.responsible_id,
  p.full_name as responsible_name,
  ft.business_unit,
  ft.transaction_type,
  ft.amount,
  ft.status,
  ft.method,
  ft.occurred_at,
  ft.created_at
from public.financial_transactions ft
left join public.sales s on s.id = ft.sale_id
left join public.clients c on c.id = ft.client_id
left join public.affiliates a on a.id = ft.affiliate_id
left join public.profiles p on p.id = ft.responsible_id;

grant select on public.financial_transactions_view to authenticated;

create or replace view public.commission_financial_view
with (security_invoker = true)
as
select
  c.id,
  c.affiliate_id,
  a.name as affiliate_name,
  c.sale_id,
  s.title as sale_title,
  c.payment_id,
  c.responsible_id,
  p.full_name as responsible_name,
  c.business_unit,
  c.basis_amount,
  c.rate,
  c.amount,
  c.status,
  c.origin,
  c.retention_reason,
  c.approved_at,
  c.paid_at,
  c.created_at
from public.commissions c
left join public.affiliates a on a.id = c.affiliate_id
left join public.sales s on s.id = c.sale_id
left join public.profiles p on p.id = c.responsible_id;

grant select on public.commission_financial_view to authenticated;

create or replace view public.financial_summary_by_responsible
with (security_invoker = true)
as
select
  responsible_id,
  business_unit,
  count(*) filter (where status = 'posted') as payment_count,
  coalesce(sum(amount) filter (where status = 'posted' and transaction_type = 'income'),0) as collected_amount,
  min(occurred_at) as first_payment_at,
  max(occurred_at) as last_payment_at
from public.financial_transactions
group by responsible_id, business_unit;

grant select on public.financial_summary_by_responsible to authenticated;

create or replace view public.financial_summary_by_affiliate
with (security_invoker = true)
as
select
  affiliate_id,
  business_unit,
  count(*) filter (where status = 'posted') as payment_count,
  coalesce(sum(amount) filter (where status = 'posted' and transaction_type = 'income'),0) as collected_amount,
  min(occurred_at) as first_payment_at,
  max(occurred_at) as last_payment_at
from public.financial_transactions
group by affiliate_id, business_unit;

grant select on public.financial_summary_by_affiliate to authenticated;

-- ------------------------------------------------------------
-- 8. One authority for financial/core RLS
-- ------------------------------------------------------------

alter table public.financial_transactions enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.commissions enable row level security;
alter table public.opportunities enable row level security;
alter table public.affiliates enable row level security;
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.referrals enable row level security;

-- Remove prior policies from these tables so policy composition cannot leak rows.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'financial_transactions','sales','payments','commissions','opportunities',
        'affiliates','clients','leads','referrals'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- SALES
create policy sales_select_scoped on public.sales
for select to authenticated
using (
  public.is_financial_admin()
  or responsible_id = auth.uid()
  or created_by = auth.uid()
  or public.owns_affiliate(affiliate_id)
);

create policy sales_insert_scoped on public.sales
for insert to authenticated
with check (
  public.is_financial_admin()
  or responsible_id = auth.uid()
  or created_by = auth.uid()
);

create policy sales_update_scoped on public.sales
for update to authenticated
using (public.is_financial_admin() or responsible_id = auth.uid() or created_by = auth.uid())
with check (public.is_financial_admin() or responsible_id = auth.uid() or created_by = auth.uid());

create policy sales_delete_privileged on public.sales
for delete to authenticated
using (public.is_financial_admin());

-- PAYMENTS: own/attributed read; only privileged can mutate after creation.
create policy payments_select_scoped on public.payments
for select to authenticated
using (
  public.is_financial_admin()
  or responsible_id = auth.uid()
  or created_by = auth.uid()
  or public.owns_affiliate(affiliate_id)
);

create policy payments_insert_scoped on public.payments
for insert to authenticated
with check (
  public.is_financial_admin()
  or responsible_id = auth.uid()
  or created_by = auth.uid()
);

create policy payments_update_privileged on public.payments
for update to authenticated
using (public.is_financial_admin())
with check (public.is_financial_admin());

create policy payments_delete_privileged on public.payments
for delete to authenticated
using (public.is_financial_admin());

-- LEDGER: read-only to application users; writes happen via security-definer trigger.
create policy financial_transactions_select_scoped on public.financial_transactions
for select to authenticated
using (
  public.is_financial_admin()
  or responsible_id = auth.uid()
  or created_by = auth.uid()
  or public.owns_affiliate(affiliate_id)
);

-- COMMISSIONS
create policy commissions_select_scoped on public.commissions
for select to authenticated
using (
  public.is_financial_admin()
  or responsible_id = auth.uid()
  or public.owns_affiliate(affiliate_id)
);

create policy commissions_update_privileged on public.commissions
for update to authenticated
using (public.is_financial_admin())
with check (public.is_financial_admin());

create policy commissions_delete_super_admin on public.commissions
for delete to authenticated
using (public.is_super_admin());

-- OPPORTUNITIES
create policy opportunities_select_scoped on public.opportunities
for select to authenticated
using (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy opportunities_insert_scoped on public.opportunities
for insert to authenticated
with check (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy opportunities_update_scoped on public.opportunities
for update to authenticated
using (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy opportunities_delete_privileged on public.opportunities
for delete to authenticated
using (public.is_financial_admin());

-- AFFILIATES
create policy affiliates_select_scoped on public.affiliates
for select to authenticated
using (
  public.is_financial_admin()
  or user_id = auth.uid()
  or profile_id = auth.uid()
  or responsible_id = auth.uid()
  or created_by = auth.uid()
);

create policy affiliates_insert_scoped on public.affiliates
for insert to authenticated
with check (public.is_financial_admin() or created_by = auth.uid() or user_id = auth.uid());

create policy affiliates_update_scoped on public.affiliates
for update to authenticated
using (public.is_financial_admin() or user_id = auth.uid() or profile_id = auth.uid() or responsible_id = auth.uid())
with check (public.is_financial_admin() or user_id = auth.uid() or profile_id = auth.uid() or responsible_id = auth.uid());

create policy affiliates_delete_privileged on public.affiliates
for delete to authenticated
using (public.is_financial_admin());

-- CLIENTS
create policy clients_select_scoped on public.clients
for select to authenticated
using (
  public.is_financial_admin()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.owns_affiliate(affiliate_id)
);

create policy clients_insert_scoped on public.clients
for insert to authenticated
with check (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy clients_update_scoped on public.clients
for update to authenticated
using (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy clients_delete_privileged on public.clients
for delete to authenticated
using (public.is_financial_admin());

-- LEADS
create policy leads_select_scoped on public.leads
for select to authenticated
using (
  public.is_financial_admin()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1 from public.referrals r
    where r.lead_id = leads.id and public.owns_affiliate(r.affiliate_id)
  )
);

create policy leads_insert_scoped on public.leads
for insert to authenticated
with check (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy leads_update_scoped on public.leads
for update to authenticated
using (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid())
with check (public.is_financial_admin() or assigned_to = auth.uid() or created_by = auth.uid());

create policy leads_delete_privileged on public.leads
for delete to authenticated
using (public.is_financial_admin());

-- REFERRALS
create policy referrals_select_scoped on public.referrals
for select to authenticated
using (
  public.is_financial_admin()
  or created_by = auth.uid()
  or public.owns_affiliate(affiliate_id)
  or exists (
    select 1 from public.affiliates a
    where a.id = referrals.affiliate_id and a.responsible_id = auth.uid()
  )
);

create policy referrals_insert_scoped on public.referrals
for insert to authenticated
with check (public.is_financial_admin() or created_by = auth.uid() or public.owns_affiliate(affiliate_id));

create policy referrals_update_scoped on public.referrals
for update to authenticated
using (public.is_financial_admin() or created_by = auth.uid() or public.owns_affiliate(affiliate_id))
with check (public.is_financial_admin() or created_by = auth.uid() or public.owns_affiliate(affiliate_id));

create policy referrals_delete_privileged on public.referrals
for delete to authenticated
using (public.is_financial_admin());

-- ------------------------------------------------------------
-- 9. Profiles: super_admin/admin privilege boundary
-- ------------------------------------------------------------

alter table public.profiles enable row level security;

do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy profiles_select_scoped on public.profiles
for select to authenticated
using (public.is_financial_admin() or id = auth.uid());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role::text = public.current_role_text());

create policy profiles_super_admin_update_all on public.profiles
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy profiles_admin_update_non_privileged on public.profiles
for update to authenticated
using (
  public.current_role_text() = 'admin'
  and role::text not in ('super_admin','admin')
)
with check (
  public.current_role_text() = 'admin'
  and role::text not in ('super_admin','admin')
);

-- ------------------------------------------------------------
-- 10. Initial recalculation
-- ------------------------------------------------------------

do $$
declare r record;
begin
  for r in select id from public.sales loop
    perform public.recalculate_sale_commissions(r.id);
    perform public.recalculate_opportunity_financials((select opportunity_id from public.sales where id = r.id));
  end loop;

  for r in select id from public.affiliates loop
    perform public.recalculate_affiliate_commission_totals(r.id);
  end loop;
end $$;

-- ============================================================
-- END FINANCIAL CORE V1
-- ============================================================
