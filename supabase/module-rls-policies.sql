-- CRM Services — RLS por módulos
-- Ejecutar después de roles-permissions.sql

-- IMPORTANTE:
-- Este archivo asume que ya existen:
-- profiles, clients, leads, affiliates, referrals, commissions,
-- tickets, documents y service_requests.

-- =========================
-- Helpers
-- =========================

create or replace function public.current_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.affiliates
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.clients
  where user_id = auth.uid()
  limit 1;
$$;

-- =========================
-- Columnas recomendadas
-- =========================

alter table public.clients
add column if not exists user_id uuid references public.profiles(id),
add column if not exists assigned_to uuid references public.profiles(id),
add column if not exists created_by uuid references public.profiles(id);

alter table public.leads
add column if not exists assigned_to uuid references public.profiles(id),
add column if not exists created_by uuid references public.profiles(id),
add column if not exists affiliate_id uuid references public.affiliates(id);

alter table public.affiliates
add column if not exists user_id uuid references public.profiles(id),
add column if not exists responsible_id uuid references public.profiles(id);

alter table public.referrals
add column if not exists affiliate_id uuid references public.affiliates(id),
add column if not exists lead_id uuid references public.leads(id),
add column if not exists client_id uuid references public.clients(id);

alter table public.commissions
add column if not exists affiliate_id uuid references public.affiliates(id);

alter table public.tickets
add column if not exists client_id uuid references public.clients(id),
add column if not exists assigned_to uuid references public.profiles(id),
add column if not exists created_by uuid references public.profiles(id);

alter table public.documents
add column if not exists owner_user_id uuid references public.profiles(id),
add column if not exists client_id uuid references public.clients(id),
add column if not exists affiliate_id uuid references public.affiliates(id),
add column if not exists service_request_id uuid references public.service_requests(id);

alter table public.service_requests
add column if not exists client_id uuid references public.clients(id),
add column if not exists assigned_to uuid references public.profiles(id),
add column if not exists created_by uuid references public.profiles(id);

-- =========================
-- Activar RLS
-- =========================

alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.affiliates enable row level security;
alter table public.referrals enable row level security;
alter table public.commissions enable row level security;
alter table public.tickets enable row level security;
alter table public.documents enable row level security;
alter table public.service_requests enable row level security;

-- =========================
-- CLIENTS
-- =========================

drop policy if exists "clients_admin_supervisor_all" on public.clients;
drop policy if exists "clients_internal_assigned_select" on public.clients;
drop policy if exists "clients_internal_assigned_update" on public.clients;
drop policy if exists "clients_internal_create" on public.clients;
drop policy if exists "clients_client_own_select" on public.clients;

create policy "clients_admin_supervisor_all"
on public.clients
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "clients_internal_assigned_select"
on public.clients
for select
to authenticated
using (
  public.has_role(array['vendedor','responsable','soporte']::public.app_role[])
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
  )
);

create policy "clients_internal_assigned_update"
on public.clients
for update
to authenticated
using (
  public.has_role(array['vendedor','responsable','soporte']::public.app_role[])
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
  )
)
with check (
  public.has_role(array['vendedor','responsable','soporte']::public.app_role[])
);

create policy "clients_internal_create"
on public.clients
for insert
to authenticated
with check (
  public.has_role(array['admin','supervisor','vendedor']::public.app_role[])
);

create policy "clients_client_own_select"
on public.clients
for select
to authenticated
using (user_id = auth.uid());

-- =========================
-- LEADS
-- =========================

drop policy if exists "leads_admin_supervisor_all" on public.leads;
drop policy if exists "leads_internal_assigned_select" on public.leads;
drop policy if exists "leads_internal_assigned_update" on public.leads;
drop policy if exists "leads_internal_create" on public.leads;
drop policy if exists "leads_affiliate_own_select" on public.leads;
drop policy if exists "leads_affiliate_create" on public.leads;

create policy "leads_admin_supervisor_all"
on public.leads
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "leads_internal_assigned_select"
on public.leads
for select
to authenticated
using (
  public.has_role(array['vendedor','responsable']::public.app_role[])
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
  )
);

create policy "leads_internal_assigned_update"
on public.leads
for update
to authenticated
using (
  public.has_role(array['vendedor','responsable']::public.app_role[])
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
  )
)
with check (
  public.has_role(array['vendedor','responsable']::public.app_role[])
);

create policy "leads_internal_create"
on public.leads
for insert
to authenticated
with check (
  public.has_role(array['admin','supervisor','vendedor']::public.app_role[])
);

create policy "leads_affiliate_own_select"
on public.leads
for select
to authenticated
using (affiliate_id = public.current_affiliate_id());

create policy "leads_affiliate_create"
on public.leads
for insert
to authenticated
with check (
  public.has_role(array['afiliado']::public.app_role[])
  and affiliate_id = public.current_affiliate_id()
);

-- =========================
-- AFFILIATES
-- =========================

drop policy if exists "affiliates_admin_supervisor_all" on public.affiliates;
drop policy if exists "affiliates_internal_select" on public.affiliates;
drop policy if exists "affiliates_own_select" on public.affiliates;
drop policy if exists "affiliates_own_update" on public.affiliates;

create policy "affiliates_admin_supervisor_all"
on public.affiliates
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "affiliates_internal_select"
on public.affiliates
for select
to authenticated
using (
  public.has_role(array['vendedor','responsable','soporte']::public.app_role[])
);

create policy "affiliates_own_select"
on public.affiliates
for select
to authenticated
using (user_id = auth.uid());

create policy "affiliates_own_update"
on public.affiliates
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================
-- REFERRALS
-- =========================

drop policy if exists "referrals_admin_supervisor_all" on public.referrals;
drop policy if exists "referrals_internal_select" on public.referrals;
drop policy if exists "referrals_affiliate_own_select" on public.referrals;
drop policy if exists "referrals_affiliate_create" on public.referrals;

create policy "referrals_admin_supervisor_all"
on public.referrals
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "referrals_internal_select"
on public.referrals
for select
to authenticated
using (
  public.has_role(array['vendedor','responsable','soporte']::public.app_role[])
);

create policy "referrals_affiliate_own_select"
on public.referrals
for select
to authenticated
using (affiliate_id = public.current_affiliate_id());

create policy "referrals_affiliate_create"
on public.referrals
for insert
to authenticated
with check (
  public.has_role(array['afiliado']::public.app_role[])
  and affiliate_id = public.current_affiliate_id()
);

-- =========================
-- COMMISSIONS
-- =========================

drop policy if exists "commissions_admin_supervisor_all" on public.commissions;
drop policy if exists "commissions_affiliate_own_select" on public.commissions;

create policy "commissions_admin_supervisor_all"
on public.commissions
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "commissions_affiliate_own_select"
on public.commissions
for select
to authenticated
using (affiliate_id = public.current_affiliate_id());

-- =========================
-- TICKETS
-- =========================

drop policy if exists "tickets_admin_supervisor_soporte_all" on public.tickets;
drop policy if exists "tickets_internal_assigned_select" on public.tickets;
drop policy if exists "tickets_internal_assigned_update" on public.tickets;
drop policy if exists "tickets_client_own_select" on public.tickets;
drop policy if exists "tickets_client_create" on public.tickets;

create policy "tickets_admin_supervisor_soporte_all"
on public.tickets
for all
to authenticated
using (
  public.has_role(array['admin','supervisor','soporte']::public.app_role[])
)
with check (
  public.has_role(array['admin','supervisor','soporte']::public.app_role[])
);

create policy "tickets_internal_assigned_select"
on public.tickets
for select
to authenticated
using (
  public.has_role(array['vendedor','responsable']::public.app_role[])
  and assigned_to = auth.uid()
);

create policy "tickets_internal_assigned_update"
on public.tickets
for update
to authenticated
using (
  public.has_role(array['vendedor','responsable']::public.app_role[])
  and assigned_to = auth.uid()
)
with check (
  public.has_role(array['vendedor','responsable']::public.app_role[])
);

create policy "tickets_client_own_select"
on public.tickets
for select
to authenticated
using (
  client_id = public.current_client_id()
);

create policy "tickets_client_create"
on public.tickets
for insert
to authenticated
with check (
  public.has_role(array['cliente']::public.app_role[])
  and client_id = public.current_client_id()
);

-- =========================
-- DOCUMENTS
-- =========================

drop policy if exists "documents_admin_supervisor_all" on public.documents;
drop policy if exists "documents_internal_select" on public.documents;
drop policy if exists "documents_owner_select" on public.documents;
drop policy if exists "documents_owner_create" on public.documents;
drop policy if exists "documents_affiliate_own_select" on public.documents;
drop policy if exists "documents_client_own_select" on public.documents;

create policy "documents_admin_supervisor_all"
on public.documents
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "documents_internal_select"
on public.documents
for select
to authenticated
using (
  public.has_role(array['vendedor','responsable','soporte']::public.app_role[])
);

create policy "documents_owner_select"
on public.documents
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "documents_owner_create"
on public.documents
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "documents_affiliate_own_select"
on public.documents
for select
to authenticated
using (affiliate_id = public.current_affiliate_id());

create policy "documents_client_own_select"
on public.documents
for select
to authenticated
using (client_id = public.current_client_id());

-- =========================
-- SERVICE REQUESTS
-- =========================

drop policy if exists "service_requests_admin_supervisor_all" on public.service_requests;
drop policy if exists "service_requests_responsable_assigned_select" on public.service_requests;
drop policy if exists "service_requests_responsable_assigned_update" on public.service_requests;
drop policy if exists "service_requests_internal_create" on public.service_requests;
drop policy if exists "service_requests_client_own_select" on public.service_requests;
drop policy if exists "service_requests_client_create" on public.service_requests;

create policy "service_requests_admin_supervisor_all"
on public.service_requests
for all
to authenticated
using (public.has_role(array['admin','supervisor']::public.app_role[]))
with check (public.has_role(array['admin','supervisor']::public.app_role[]));

create policy "service_requests_responsable_assigned_select"
on public.service_requests
for select
to authenticated
using (
  public.has_role(array['responsable','vendedor','soporte']::public.app_role[])
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
  )
);

create policy "service_requests_responsable_assigned_update"
on public.service_requests
for update
to authenticated
using (
  public.has_role(array['responsable','vendedor','soporte']::public.app_role[])
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
  )
)
with check (
  public.has_role(array['responsable','vendedor','soporte']::public.app_role[])
);

create policy "service_requests_internal_create"
on public.service_requests
for insert
to authenticated
with check (
  public.has_role(array['admin','supervisor','responsable','vendedor','soporte']::public.app_role[])
);

create policy "service_requests_client_own_select"
on public.service_requests
for select
to authenticated
using (client_id = public.current_client_id());

create policy "service_requests_client_create"
on public.service_requests
for insert
to authenticated
with check (
  public.has_role(array['cliente']::public.app_role[])
  and client_id = public.current_client_id()
);