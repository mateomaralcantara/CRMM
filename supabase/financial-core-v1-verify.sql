-- FINANCIAL CORE V1 — POST-MIGRATION VERIFICATION
-- Read-only. Run after all Financial Core migrations.

-- 1. Core objects
select
  to_regclass('public.financial_transactions') is not null as financial_transactions_ok,
  to_regclass('public.financial_transactions_view') is not null as financial_transactions_view_ok,
  to_regclass('public.commission_financial_view') is not null as commission_financial_view_ok,
  to_regclass('public.financial_summary_by_responsible') is not null as responsible_summary_ok,
  to_regclass('public.financial_summary_by_affiliate') is not null as affiliate_summary_ok;

-- 2. Core functions
select
  to_regprocedure('public.current_role_text()') is not null as current_role_ok,
  to_regprocedure('public.is_super_admin()') is not null as super_admin_helper_ok,
  to_regprocedure('public.is_financial_admin()') is not null as financial_admin_helper_ok,
  to_regprocedure('public.bootstrap_super_admin()') is not null as bootstrap_super_admin_ok,
  to_regprocedure('public.recalculate_sale_commissions(uuid)') is not null as commission_engine_ok,
  to_regprocedure('public.recalculate_opportunity_financials(uuid)') is not null as opportunity_sync_ok;

-- 3. Payment attribution columns
select
  count(*) = 4 as payment_snapshot_columns_ok
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payments'
  and column_name in ('affiliate_id','responsible_id','business_unit','attribution_locked');

-- 4. Affiliate financial columns
select
  count(*) = 4 as affiliate_financial_columns_ok
from information_schema.columns
where table_schema = 'public'
  and table_name = 'affiliates'
  and column_name in ('user_id','responsible_id','affiliate_type_id','commission_rate');

-- 5. Commission trace columns
select
  count(*) = 5 as commission_trace_columns_ok
from information_schema.columns
where table_schema = 'public'
  and table_name = 'commissions'
  and column_name in ('payment_id','responsible_id','business_unit','basis_amount','origin');

-- 6. RLS enabled on sensitive tables
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'financial_transactions','sales','payments','commissions','opportunities',
    'affiliates','clients','leads','referrals','profiles'
  )
order by c.relname;

-- 7. Canonical policies expected
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and policyname in (
    'financial_transactions_select_scoped',
    'sales_select_scoped','sales_insert_scoped','sales_update_scoped','sales_delete_privileged',
    'payments_select_scoped','payments_insert_scoped','payments_update_privileged',
    'commissions_select_scoped','commissions_update_privileged','commissions_delete_super_admin',
    'opportunities_select_scoped','opportunities_insert_scoped','opportunities_update_scoped','opportunities_delete_privileged',
    'profiles_select_scoped','profiles_update_self','profiles_super_admin_update_all','profiles_admin_update_non_privileged'
  )
order by tablename, policyname;

-- 8. There must NOT be a permissive authenticated select-all opportunity policy.
select
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunities'
      and cmd = 'SELECT'
      and coalesce(qual, '') in ('true', '(true)')
  ) as opportunities_not_globally_readable;

-- 9. Payment physical deletion is blocked by trigger.
select exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'payments'
    and t.tgname = 'trg_prevent_payment_physical_delete'
    and not t.tgisinternal
) as payment_delete_guard_ok;

-- 10. Financial attribution guards installed.
select
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sales'
      and t.tgname = 'trg_enforce_sale_financial_attribution' and not t.tgisinternal
  ) as sale_attribution_guard_ok,
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'affiliates'
      and t.tgname = 'trg_protect_affiliate_financial_assignment' and not t.tgisinternal
  ) as affiliate_attribution_guard_ok;

-- 11. Quick accounting consistency: sale collected amount vs eligible payments.
select
  s.id,
  s.title,
  s.collected_amount,
  coalesce(sum(p.amount) filter (where p.status in ('parcial','completado')), 0) as payment_total,
  s.collected_amount - coalesce(sum(p.amount) filter (where p.status in ('parcial','completado')), 0) as difference
from public.sales s
left join public.payments p on p.sale_id = s.id
group by s.id, s.title, s.collected_amount
having abs(
  s.collected_amount - coalesce(sum(p.amount) filter (where p.status in ('parcial','completado')), 0)
) > 0.01
order by abs(
  s.collected_amount - coalesce(sum(p.amount) filter (where p.status in ('parcial','completado')), 0)
) desc;

-- Expected result for query 11: ZERO ROWS.
