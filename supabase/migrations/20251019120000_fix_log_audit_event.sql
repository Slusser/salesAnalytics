-- purpose: fix audit trigger function to compare TG_OP using uppercase values
--          ensuring record_pk, old_row, and new_row are populated correctly

begin;

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_request_id uuid;
  v_request_id_raw text;
  v_record_pk text;
begin
  begin
    v_actor := auth.uid();
  exception
    when others then
      v_actor := null;
  end;

  begin
    v_request_id_raw := current_setting('request.jwt.claim.request_id', true);
    if v_request_id_raw is not null and length(v_request_id_raw) > 0 then
      v_request_id := v_request_id_raw::uuid;
    end if;
  exception
    when others then
      v_request_id := null;
  end;

  if tg_op in ('INSERT', 'UPDATE') then
    v_record_pk := (new.id)::text;
  else
    v_record_pk := (old.id)::text;
  end if;

  insert into public.audit_log (
    schema_name,
    table_name,
    record_pk,
    operation,
    old_row,
    new_row,
    actor,
    occured_at,
    request_id
  )
  values (
    tg_table_schema,
    tg_table_name,
    v_record_pk,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    v_actor,
    now(),
    v_request_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

commit;

