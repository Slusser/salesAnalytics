-- migration metadata ----------------------------------------------------------
-- purpose: create core tables, constraints, triggers, indexes, and rls policies
--          for the salesanalysis mvp domain (users, user_roles, customers,
--          orders, audit_log).
-- sources: derived from .cursor/db-plan.md
-- notes: 1) review the optional business rule for future-dated orders before
--           enabling additional checks.
--        2) audit triggers run as security definer to ensure inserts bypass rls
--           while retaining strict client-facing rules.
-- -----------------------------------------------------------------------------

begin;

-- ensure that required extensions exist before creating dependent objects
create extension if not exists citext with schema public;
create extension if not exists "pgcrypto" with schema public;

-- standardise timestamps and logging behaviour across tables
set statement_timeout to 0;
set lock_timeout to 0;
set idle_in_transaction_session_timeout to 0;
set client_min_messages to warning;
set search_path to public;

-- helper trigger to keep updated_at columns in sync with the current timestamp
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at_timestamp() is
  'normalizes updated_at columns to utc on write; applied via before update triggers';

-- audit trigger capturing row-level mutations for key transactional tables
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
  -- capture session actor; suppress errors when auth context is missing (e.g. service role)
  begin
    v_actor := auth.uid();
  exception
    when others then
      v_actor := null;
  end;

  -- attempt to correlate events using optional request identifier from jwt claims
  begin
    v_request_id_raw := current_setting('request.jwt.claim.request_id', true);
    if v_request_id_raw is not null and length(v_request_id_raw) > 0 then
      v_request_id := v_request_id_raw::uuid;
    end if;
  exception
    when others then
      v_request_id := null;
  end;

  if tg_op in ('insert', 'update') then
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
    case when tg_op in ('update', 'delete') then to_jsonb(old) end,
    case when tg_op in ('insert', 'update') then to_jsonb(new) end,
    v_actor,
    now(),
    v_request_id
  );

  if tg_op = 'delete' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.log_audit_event() is
  'writes row-level change events (insert/update/delete) into audit_log with actor/request context';

-- primary identity table synchronized with supabase auth users
create table public.users (
  id uuid primary key default auth.uid(),
  email citext not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'application-facing profile details linked to supabase auth users';

-- role assignments per user with composite primary key for fast membership checks
create table public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  granted_at timestamptz not null default now(),
  constraint user_roles_role_check check (role in ('owner', 'editor', 'viewer')),
  constraint user_roles_pk primary key (user_id, role)
);

comment on table public.user_roles is 'role memberships controlling access scopes (owner/editor/viewer)';

-- customer registry with soft-delete semantics and uniqueness enforced on active names
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customers_active_or_deleted check (is_active or deleted_at is not null)
);

comment on table public.customers is 'customer master data with soft-delete tracking for archival';

-- order records capturing transactional sales data with detailed monetary fields
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  order_no text not null,
  order_date date not null,
  item_name text not null,
  quantity numeric(12, 2) not null,
  is_eur boolean not null default false,
  currency_code text not null default 'PLN',
  eur_rate numeric(12, 6),
  total_net_pln numeric(18, 2) not null,
  total_gross_pln numeric(18, 2) not null,
  total_gross_eur numeric(18, 2),
  producer_discount_pct numeric(5, 2) not null default 0,
  distributor_discount_pct numeric(5, 2) not null default 0,
  vat_rate_pct numeric(5, 2) not null default 23,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint orders_quantity_positive check (quantity > 0),
  constraint orders_eur_rate_check check (
    (is_eur = false and eur_rate is null)
    or (is_eur = true and eur_rate is not null and eur_rate > 0)
  ),
  constraint orders_total_net_non_negative check (total_net_pln >= 0),
  constraint orders_total_gross_pln_check check (total_gross_pln >= total_net_pln),
  constraint orders_total_gross_eur_check check (
    (is_eur = false and total_gross_eur is null)
    or (is_eur = true and total_gross_eur is not null and total_gross_eur >= 0)
  ),
  constraint orders_producer_discount_range check (producer_discount_pct between 0 and 100),
  constraint orders_distributor_discount_range check (distributor_discount_pct between 0 and 100),
  constraint orders_vat_rate_range check (vat_rate_pct between 0 and 100),
  constraint orders_currency_alignment check (is_eur = (currency_code = 'EUR'))
);

comment on table public.orders is 'individual order lines with pricing, discount, and vat metrics for analytics';

-- append-only audit journal for sensitive tables with optional request correlation
create table public.audit_log (
  id bigserial primary key,
  schema_name text not null default current_schema(),
  table_name text not null,
  record_pk text not null,
  operation text not null,
  old_row jsonb,
  new_row jsonb,
  actor uuid,
  occured_at timestamptz not null default now(),
  request_id uuid,
  constraint audit_log_operation_check check (operation in ('INSERT', 'UPDATE', 'DELETE'))
);

comment on table public.audit_log is 'immutable audit trail capturing row mutations across transactional tables';

-- designed to facilitate case-insensitive uniqueness on logical keys without blocking soft deletes
create unique index customers_lower_name_idx on public.customers (lower(name)) where deleted_at is null;
create unique index orders_lower_order_no_idx on public.orders (lower(order_no)) where deleted_at is null;

-- operational indexes supporting typical query filters and sorts
create index orders_customer_idx on public.orders (customer_id);
create index orders_order_date_idx on public.orders (order_date);
create index orders_created_by_idx on public.orders (created_by);
create index orders_deleted_at_idx on public.orders (deleted_at);
create index user_roles_role_idx on public.user_roles (role);

-- audit indexes enabling efficient browsing and json-based filtering
create index audit_log_table_occurred_idx on public.audit_log (table_name, occured_at desc);
create index audit_log_old_row_gin_idx on public.audit_log using gin (old_row);
create index audit_log_new_row_gin_idx on public.audit_log using gin (new_row);

-- keep updated_at values consistent without requiring manual maintenance
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at_timestamp();

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at_timestamp();

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at_timestamp();

-- attach audit triggers; destructive operations are logged automatically
create trigger customers_audit_log
after insert or update or delete on public.customers
for each row
execute function public.log_audit_event();

create trigger orders_audit_log
after insert or update or delete on public.orders
for each row
execute function public.log_audit_event();

-- enable row level security across all domain tables for principle-of-least-privilege
alter table public.users enable row level security;
alter table public.users force row level security;

alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

alter table public.customers enable row level security;
alter table public.customers force row level security;

alter table public.orders enable row level security;
alter table public.orders force row level security;

alter table public.audit_log enable row level security;

-- rls policies for users ------------------------------------------------------
-- authenticated users can only see themselves or require owner role escalation
create policy users_select_authenticated on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

-- anonymous users must never access user profiles directly
create policy users_select_anon on public.users
  for select
  to anon
  using (false);

-- prevent direct inserts from both authenticated and anonymous contexts
create policy users_insert_authenticated on public.users
  for insert
  to authenticated
  with check (false);

create policy users_insert_anon on public.users
  for insert
  to anon
  with check (false);

-- block updates unless future administrative functions explicitly override
create policy users_update_authenticated on public.users
  for update
  to authenticated
  using (false)
  with check (false);

create policy users_update_anon on public.users
  for update
  to anon
  using (false)
  with check (false);

-- disallow hard deletes for application roles; managed by service routines only
create policy users_delete_authenticated on public.users
  for delete
  to authenticated
  using (false);

create policy users_delete_anon on public.users
  for delete
  to anon
  using (false);

-- rls policies for user_roles -------------------------------------------------
-- allow authenticated users to read their assignments or when they hold owner role
create policy user_roles_select_authenticated on public.user_roles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

-- prevent select exposure for anonymous callers
create policy user_roles_select_anon on public.user_roles
  for select
  to anon
  using (false);

-- restrict inserts to owners (e.g. administrative ui)
create policy user_roles_insert_authenticated on public.user_roles
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

create policy user_roles_insert_anon on public.user_roles
  for insert
  to anon
  with check (false);

-- updates are disallowed; prefer revoke and re-grant semantics
create policy user_roles_update_authenticated on public.user_roles
  for update
  to authenticated
  using (false)
  with check (false);

create policy user_roles_update_anon on public.user_roles
  for update
  to anon
  using (false)
  with check (false);

-- allow owners to remove role assignments explicitly; others blocked
create policy user_roles_delete_authenticated on public.user_roles
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

create policy user_roles_delete_anon on public.user_roles
  for delete
  to anon
  using (false);

-- rls policies for customers --------------------------------------------------
-- authenticated users may only see active (non-deleted) customers
create policy customers_select_authenticated on public.customers
  for select
  to authenticated
  using (deleted_at is null);

-- hide all customer data from anonymous callers
create policy customers_select_anon on public.customers
  for select
  to anon
  using (false);

-- inserts allowed for editors and owners; enforce creation of active records only
create policy customers_insert_authenticated on public.customers
  for insert
  to authenticated
  with check (
    deleted_at is null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('editor', 'owner')
    )
  );

create policy customers_insert_anon on public.customers
  for insert
  to anon
  with check (false);

-- updates require editor/owner role; allow soft-delete by ensuring inactive flag when deleted_at set
create policy customers_update_authenticated on public.customers
  for update
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('editor', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('editor', 'owner')
    )
    and (
      deleted_at is null
      or (deleted_at is not null and is_active = false)
    )
  );

create policy customers_update_anon on public.customers
  for update
  to anon
  using (false)
  with check (false);

-- hard deletes are disabled to protect history; handled by service routines only
create policy customers_delete_authenticated on public.customers
  for delete
  to authenticated
  using (false);

create policy customers_delete_anon on public.customers
  for delete
  to anon
  using (false);

-- rls policies for orders -----------------------------------------------------
-- authenticated users can list only non-deleted orders for reporting
create policy orders_select_authenticated on public.orders
  for select
  to authenticated
  using (deleted_at is null);

-- anonymised sessions are prevented from accessing order data
create policy orders_select_anon on public.orders
  for select
  to anon
  using (false);

-- inserts allowed for editors/owners acting on their own behalf with active customers
create policy orders_insert_authenticated on public.orders
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and deleted_at is null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('editor', 'owner')
    )
    and exists (
      select 1
      from public.customers c
      where c.id = customer_id
        and c.deleted_at is null
    )
  );

create policy orders_insert_anon on public.orders
  for insert
  to anon
  with check (false);

-- updates enforce ownership plus editor/owner privileges; soft deletes allowed via deleted_at column
create policy orders_update_authenticated on public.orders
  for update
  to authenticated
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('editor', 'owner')
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('editor', 'owner')
    )
    and (
      deleted_at is not null
      or exists (
        select 1
        from public.customers c
        where c.id = customer_id
          and c.deleted_at is null
      )
    )
  );

create policy orders_update_anon on public.orders
  for update
  to anon
  using (false)
  with check (false);

-- hard deletes are disabled; application should rely on soft-delete semantics
create policy orders_delete_authenticated on public.orders
  for delete
  to authenticated
  using (false);

create policy orders_delete_anon on public.orders
  for delete
  to anon
  using (false);

-- rls policies for audit_log --------------------------------------------------
-- only owners can view audit data through the authenticated channel
create policy audit_log_select_authenticated on public.audit_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

-- block audit log access for anonymous calls entirely
create policy audit_log_select_anon on public.audit_log
  for select
  to anon
  using (false);

-- disallow direct inserts from client contexts; trigger-based inserts bypass rls via table ownership
create policy audit_log_insert_authenticated on public.audit_log
  for insert
  to authenticated
  with check (false);

create policy audit_log_insert_anon on public.audit_log
  for insert
  to anon
  with check (false);

-- updates and deletes are prohibited to maintain immutability
create policy audit_log_update_authenticated on public.audit_log
  for update
  to authenticated
  using (false)
  with check (false);

create policy audit_log_update_anon on public.audit_log
  for update
  to anon
  using (false)
  with check (false);

create policy audit_log_delete_authenticated on public.audit_log
  for delete
  to authenticated
  using (false);

create policy audit_log_delete_anon on public.audit_log
  for delete
  to anon
  using (false);

commit;

