-- CRM Services — Admin: ver sesiones de usuarios

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

create or replace function public.admin_list_sessions()
returns table (
  session_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  not_after timestamptz,
  ip_address text,
  user_agent text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    (session_data->>'id')::uuid as session_id,
    (session_data->>'user_id')::uuid as user_id,
    p.full_name::text,
    p.email::text,
    p.role::text,
    p.status::text,
    nullif(session_data->>'created_at', '')::timestamptz as created_at,
    nullif(session_data->>'updated_at', '')::timestamptz as updated_at,
    nullif(session_data->>'refreshed_at', '')::timestamptz as refreshed_at,
    nullif(session_data->>'not_after', '')::timestamptz as not_after,
    session_data->>'ip' as ip_address,
    session_data->>'user_agent' as user_agent
  from (
    select to_jsonb(s) as session_data
    from auth.sessions s
  ) sessions
  left join public.profiles p
    on p.id = (session_data->>'user_id')::uuid
  order by nullif(session_data->>'updated_at', '')::timestamptz desc nulls last;
end;
$$;

revoke all on function public.admin_list_sessions() from public;
grant execute on function public.admin_list_sessions() to authenticated;