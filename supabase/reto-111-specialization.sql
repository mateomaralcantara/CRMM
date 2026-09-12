-- ============================================================
-- CRM SERVICES — ESPECIALIZACIÓN COMERCIAL RETO 111
-- Ejecutar en Supabase SQL Editor después de aplicar el código.
-- ============================================================

alter table public.clients
  add column if not exists business_unit text;

alter table public.leads
  add column if not exists business_unit text,
  add column if not exists opportunity_value numeric(12,2) not null default 0,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz;

alter table public.quotes
  add column if not exists business_unit text;

alter table public.sales
  add column if not exists business_unit text,
  add column if not exists collected_amount numeric(12,2) not null default 0;

alter table public.service_requests
  add column if not exists business_unit text;

alter table public.clients drop constraint if exists clients_business_unit_check;
alter table public.clients add constraint clients_business_unit_check
  check (business_unit is null or business_unit in (
    'migrapro','tributario','genelibros','libroseller','b2b','ia_capacitaciones'
  ));

alter table public.leads drop constraint if exists leads_business_unit_check;
alter table public.leads add constraint leads_business_unit_check
  check (business_unit is null or business_unit in (
    'migrapro','tributario','genelibros','libroseller','b2b','ia_capacitaciones'
  ));

alter table public.quotes drop constraint if exists quotes_business_unit_check;
alter table public.quotes add constraint quotes_business_unit_check
  check (business_unit is null or business_unit in (
    'migrapro','tributario','genelibros','libroseller','b2b','ia_capacitaciones'
  ));

alter table public.sales drop constraint if exists sales_business_unit_check;
alter table public.sales add constraint sales_business_unit_check
  check (business_unit is null or business_unit in (
    'migrapro','tributario','genelibros','libroseller','b2b','ia_capacitaciones'
  ));

alter table public.service_requests drop constraint if exists service_requests_business_unit_check;
alter table public.service_requests add constraint service_requests_business_unit_check
  check (business_unit is null or business_unit in (
    'migrapro','tributario','genelibros','libroseller','b2b','ia_capacitaciones'
  ));

-- Pipeline definitivo
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in (
    'nuevo','contactado','respondio','calificado','consulta','propuesta',
    'negociacion','pago_pendiente','ganado','en_ejecucion','finalizado',
    'referido_upsell','perdido'
  ));

-- Oportunidades
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  business_unit text not null,
  source text,
  stage text not null default 'nuevo',
  opportunity_value numeric(12,2) not null default 0,
  sold_amount numeric(12,2) not null default 0,
  collected_amount numeric(12,2) not null default 0,
  outstanding_balance numeric(12,2)
    generated always as (greatest(sold_amount - collected_amount, 0)) stored,
  conversion_probability integer not null default 20,
  next_action text,
  next_action_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  loss_reason text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_business_unit_check check (business_unit in (
    'migrapro','tributario','genelibros','libroseller','b2b','ia_capacitaciones'
  )),
  constraint opportunities_stage_check check (stage in (
    'nuevo','contactado','respondio','calificado','consulta','propuesta',
    'negociacion','pago_pendiente','ganado','en_ejecucion','finalizado',
    'referido_upsell','perdido'
  )),
  constraint opportunities_probability_check
    check (conversion_probability between 0 and 100),
  constraint opportunities_open_next_action_check check (
    stage in ('finalizado','referido_upsell','perdido')
    or (
      next_action is not null
      and length(trim(next_action)) > 0
      and next_action_at is not null
    )
  )
);

alter table public.sales
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

alter table public.quotes
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

-- Saldo por cobrar automático
alter table public.sales
  add column if not exists outstanding_balance numeric(12,2)
  generated always as (greatest(amount - collected_amount, 0)) stored;

create or replace function public.recalculate_sale_collection(target_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_total numeric(12,2);
begin
  if target_sale_id is null then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into paid_total
  from public.payments
  where sale_id = target_sale_id
    and status in ('parcial','completado');

  update public.sales
  set
    collected_amount = paid_total,
    payment_status = case
      when amount > 0 and paid_total >= amount then 'pagado'
      when paid_total > 0 then 'parcial'
      else 'pendiente'
    end
  where id = target_sale_id;
end;
$$;

create or replace function public.refresh_sale_collection_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_sale_collection(old.sale_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.sale_id is distinct from new.sale_id then
    perform public.recalculate_sale_collection(old.sale_id);
  end if;

  perform public.recalculate_sale_collection(new.sale_id);
  return new;
end;
$$;

drop trigger if exists trg_payments_refresh_sale_totals on public.payments;
create trigger trg_payments_refresh_sale_totals
after insert or update or delete on public.payments
for each row execute function public.refresh_sale_collection_totals();

-- Backfill de cobros existentes
update public.sales s
set collected_amount = coalesce((
  select sum(p.amount)
  from public.payments p
  where p.sale_id = s.id
    and p.status in ('parcial','completado')
), 0);

update public.sales
set payment_status = case
  when amount > 0 and collected_amount >= amount then 'pagado'
  when collected_amount > 0 then 'parcial'
  else 'pendiente'
end;

drop trigger if exists trg_opportunities_updated_at on public.opportunities;
create trigger trg_opportunities_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

create index if not exists idx_clients_business_unit on public.clients(business_unit);
create index if not exists idx_leads_business_unit on public.leads(business_unit);
create index if not exists idx_leads_next_action_at on public.leads(next_action_at);
create index if not exists idx_quotes_business_unit on public.quotes(business_unit);
create index if not exists idx_sales_business_unit on public.sales(business_unit);
create index if not exists idx_sales_outstanding_balance on public.sales(outstanding_balance);
create index if not exists idx_opportunities_business_unit on public.opportunities(business_unit);
create index if not exists idx_opportunities_stage on public.opportunities(stage);
create index if not exists idx_opportunities_next_action_at on public.opportunities(next_action_at);
create index if not exists idx_opportunities_assigned_to on public.opportunities(assigned_to);

-- RLS oportunidades
alter table public.opportunities enable row level security;

drop policy if exists opportunities_select_authenticated on public.opportunities;
create policy opportunities_select_authenticated
on public.opportunities for select to authenticated
using (true);

drop policy if exists opportunities_insert_authenticated on public.opportunities;
create policy opportunities_insert_authenticated
on public.opportunities for insert to authenticated
with check (created_by = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists opportunities_update_owner_or_manager on public.opportunities;
create policy opportunities_update_owner_or_manager
on public.opportunities for update to authenticated
using (
  public.is_supervisor_or_admin()
  or created_by = auth.uid()
  or assigned_to = auth.uid()
)
with check (
  public.is_supervisor_or_admin()
  or created_by = auth.uid()
  or assigned_to = auth.uid()
);

drop policy if exists opportunities_delete_manager on public.opportunities;
create policy opportunities_delete_manager
on public.opportunities for delete to authenticated
using (public.is_supervisor_or_admin());

create or replace view public.commercial_sales_summary
with (security_invoker = true)
as
select
  s.id,
  s.title,
  s.client_id,
  s.business_unit,
  s.opportunity_id,
  s.amount as sold_amount,
  s.collected_amount,
  s.outstanding_balance,
  s.status,
  s.payment_status,
  s.responsible_id,
  s.created_at,
  s.closed_at
from public.sales s;
