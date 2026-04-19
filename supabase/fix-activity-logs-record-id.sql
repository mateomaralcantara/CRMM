-- CRM Services — Fix record_id en activity_logs
-- Corrige:
-- column "record_id" is of type uuid but expression is of type text

-- 1. Convertir record_id a text si actualmente es uuid
alter table public.activity_logs
alter column record_id type text
using record_id::text;

-- 2. Asegurar que las columnas principales existen
alter table public.activity_logs
add column if not exists user_id uuid references public.profiles(id) on delete set null,
add column if not exists action text,
add column if not exists table_name text,
add column if not exists old_data jsonb,
add column if not exists new_data jsonb,
add column if not exists ip_address text,
add column if not exists user_agent text,
add column if not exists created_at timestamptz not null default now();

-- 3. Asegurar valores válidos en registros viejos
update public.activity_logs
set
  action = coalesce(action, 'unknown'),
  table_name = coalesce(table_name, 'unknown')
where action is null
   or table_name is null;

alter table public.activity_logs
alter column action set not null;

alter table public.activity_logs
alter column table_name set not null;

-- 4. Recrear función de auditoría
create or replace function public.log_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
begin
  if TG_OP = 'INSERT' then
    v_record_id := NEW.id::text;

    insert into public.activity_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      'create',
      TG_TABLE_NAME,
      v_record_id,
      null,
      to_jsonb(NEW)
    );

    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    v_record_id := NEW.id::text;

    insert into public.activity_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      'update',
      TG_TABLE_NAME,
      v_record_id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );

    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    v_record_id := OLD.id::text;

    insert into public.activity_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      'delete',
      TG_TABLE_NAME,
      v_record_id,
      to_jsonb(OLD),
      null
    );

    return OLD;
  end if;

  return null;
end;
$$;