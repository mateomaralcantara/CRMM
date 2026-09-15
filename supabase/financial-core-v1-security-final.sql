-- FINANCIAL CORE V1 — final attribution security
-- Apply last.

alter table public.affiliates
  drop constraint if exists affiliates_commission_rate_check;
alter table public.affiliates
  add constraint affiliates_commission_rate_check
  check (commission_rate between 0 and 100);

-- Only Admin/Super Admin can change financial ownership/rate of an affiliate.
create or replace function public.protect_affiliate_financial_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_financial_admin() then
    if new.commission_rate is distinct from old.commission_rate
       or new.responsible_id is distinct from old.responsible_id
       or new.user_id is distinct from old.user_id then
      raise exception 'Solo Admin/Super Admin puede cambiar tasa, responsable o identidad financiera del afiliado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_affiliate_financial_assignment on public.affiliates;
create trigger trg_protect_affiliate_financial_assignment
before update on public.affiliates
for each row execute function public.protect_affiliate_financial_assignment();

-- Sale attribution inherits the affiliate from the client when possible.
-- Non-privileged commercial users are always the responsible of sales they create
-- and cannot later rewrite financial attribution.
create or replace function public.enforce_sale_financial_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_affiliate uuid;
begin
  if new.client_id is not null then
    select c.affiliate_id into v_client_affiliate
    from public.clients c
    where c.id = new.client_id;
  end if;

  if tg_op = 'INSERT' then
    if public.is_financial_admin() then
      new.affiliate_id := coalesce(new.affiliate_id, v_client_affiliate);
    else
      new.responsible_id := auth.uid();
      new.affiliate_id := v_client_affiliate;
    end if;
    return new;
  end if;

  if not public.is_financial_admin() then
    if new.responsible_id is distinct from old.responsible_id
       or new.affiliate_id is distinct from old.affiliate_id then
      raise exception 'Solo Admin/Super Admin puede reasignar responsable o afiliado de una venta';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_sale_financial_attribution on public.sales;
create trigger trg_enforce_sale_financial_attribution
before insert or update on public.sales
for each row execute function public.enforce_sale_financial_attribution();

-- Explicitly prevent normal roles from assigning themselves global scope through role_permissions.
-- The application no longer uses this table as authority; RLS is authoritative.
do $$
begin
  if to_regclass('public.role_permissions') is not null then
    alter table public.role_permissions enable row level security;
  end if;
end $$;
