-- CRM Services — Fix activity_logs.module
-- Corrige:
-- null value in column "module" of relation "activity_logs" violates not-null constraint

-- 1. Asegurar columnas necesarias
alter table public.activity_logs
add column if not exists module text,
add column if not exists table_name text,
add column if not exists action text,
add column if not exists record_id text,
add column if not exists old_data jsonb,
add column if not exists new_data jsonb,
add column if not exists user_id uuid references public.profiles(id) on delete set null,
add column if not exists created_at timestamptz not null default now();

-- 2. Si record_id quedó como uuid, convertirlo a text
alter table public.activity_logs
alter column record_id type text
using record_id::text;

-- 3. Rellenar registros viejos incompletos
update public.activity_logs
set
  module = coalesce(module, table_name, 'unknown'),
  table_name = coalesce(table_name, module, 'unknown'),
  action = coalesce(action, 'unknown')
where module is null
   or table_name is null
   or action is null;

-- 4. Dar defaults para que no vuelva a explotar
alter table public.activity_logs
alter column module set default 'unknown';

alter table public.activity_logs
alter column table_name set default 'unknown';

alter table public.activity_logs
alter column action set default 'unknown';

-- 5. Mantener columnas obligatorias ya saneadas
alter table public.activity_logs
alter column module set not null;

alter table public.activity_logs
alter column table_name set not null;

alter table public.activity_logs
alter column action set not null;

-- 6. Recrear función de auditoría llenando module y table_name
create or replace function public.log_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
  v_module text;
begin
  v_module := TG_TABLE_NAME;

  if TG_OP = 'INSERT' then
    v_record_id := NEW.id::text;

    insert into public.activity_logs (
      user_id,
      module,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      v_module,
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
      module,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      v_module,
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
      module,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      v_module,
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