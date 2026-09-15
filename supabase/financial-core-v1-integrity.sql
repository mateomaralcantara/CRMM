-- FINANCIAL CORE V1 — integrity hardening
-- Apply after financial-core-v1.sql and financial-core-v1-hardening.sql.

-- ------------------------------------------------------------
-- 1. Ensure affiliate attribution/rate columns exist
-- ------------------------------------------------------------

alter table public.affiliates
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
  add column if not exists commission_rate numeric(7,2) not null default 0;

update public.affiliates
set commission_rate = case lower(coalesce(affiliate_type::text, ''))
  when 'referidor' then 5
  when 'promotor' then 8
  when 'premium' then 12
  when 'agencia' then 15
  when 'empresa' then 10
  when 'influencer' then 10
  when 'aliado' then 8
  when 'vendedor_externo' then 8
  else commission_rate
end
where commission_rate = 0;

-- Canonical rate lookup: explicit sale commission first, then affiliate rate.
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

  if v_affiliate_id is null then return 0; end if;

  select c.rate into v_rate
  from public.commissions c
  where c.sale_id = target_sale_id
    and c.affiliate_id = v_affiliate_id
    and c.rate is not null
    and c.rate > 0
  order by case when c.origin = 'legacy' then 0 else 1 end, c.created_at asc
  limit 1;

  if v_rate is not null then return v_rate; end if;

  select a.commission_rate into v_rate
  from public.affiliates a
  where a.id = v_affiliate_id;

  return coalesce(v_rate, 0);
end;
$$;

-- ------------------------------------------------------------
-- 2. Correct auto-commission reactivation/cancellation behavior
-- ------------------------------------------------------------

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
    set amount = 0,
        status = case when status = 'pagada' then status else 'cancelada' end
    where sale_id = target_sale_id
      and origin = 'payment'
      and status <> 'pagada';
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
        when excluded.amount <= 0 then 'cancelada'
        when public.commissions.status = 'cancelada' then 'generada'
        else public.commissions.status
      end;

    v_allocated := v_allocated + v_amount;
  end loop;

  update public.commissions c
  set amount = 0,
      status = 'cancelada'
  where c.sale_id = target_sale_id
    and c.origin = 'payment'
    and c.payment_id is not null
    and c.status <> 'pagada'
    and not exists (
      select 1
      from public.payments p2
      where p2.id = c.payment_id
        and p2.status in ('parcial','completado')
    );
end;
$$;

-- ------------------------------------------------------------
-- 3. Payments are never physically deleted
-- ------------------------------------------------------------

-- Ledger accounting should preserve the original payment row.
drop policy if exists payments_delete_privileged on public.payments;

create or replace function public.prevent_payment_physical_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Los pagos no se eliminan: cambie el estado a rechazado/anulado para conservar trazabilidad';
end;
$$;

drop trigger if exists trg_prevent_payment_physical_delete on public.payments;
create trigger trg_prevent_payment_physical_delete
before delete on public.payments
for each row execute function public.prevent_payment_physical_delete();

-- ------------------------------------------------------------
-- 4. Safe bootstrap for the first super admin
-- ------------------------------------------------------------

create or replace function public.bootstrap_super_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_text() <> 'admin' then
    raise exception 'Solo un admin activo puede iniciar el primer Super Admin';
  end if;

  if exists (
    select 1 from public.profiles
    where role::text = 'super_admin'
      and status::text in ('activo','active')
  ) then
    raise exception 'Ya existe un Super Admin activo';
  end if;

  update public.profiles
  set role = 'super_admin', updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.bootstrap_super_admin() to authenticated;
