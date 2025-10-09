-- migration metadata ----------------------------------------------------------
-- purpose: remove legacy public.users table and switch foreign keys to
--          reference the built-in auth.users catalog managed by supabase auth.
-- impacted: user_roles.user_id, orders.created_by, security policies on
--           public.users.
-- notes: this is a destructive change (drops table public.users). ensure that
--        all required profile data resides in auth.users before applying.
-- -----------------------------------------------------------------------------

begin;

set statement_timeout to 0;
set lock_timeout to 0;
set idle_in_transaction_session_timeout to 0;
set client_min_messages to warning;
set search_path to public;

-- adjust dependent foreign keys before dropping the users table
alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey;

alter table public.orders
  drop constraint if exists orders_created_by_fkey;

-- drop all rls policies attached to public.users prior to removing the table
drop policy if exists users_select_authenticated on public.users;
drop policy if exists users_select_anon on public.users;
drop policy if exists users_insert_authenticated on public.users;
drop policy if exists users_insert_anon on public.users;
drop policy if exists users_update_authenticated on public.users;
drop policy if exists users_update_anon on public.users;
drop policy if exists users_delete_authenticated on public.users;
drop policy if exists users_delete_anon on public.users;

-- destructive operation: remove application-managed users table entirely
-- this operation is irreversible and will delete any data stored in
-- public.users. confirm that auth.users contains the authoritative dataset.
drop table if exists public.users cascade;

-- re-create foreign keys pointing to auth.users to preserve referential integrity
alter table public.user_roles
  add constraint user_roles_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

alter table public.orders
  add constraint orders_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete restrict;

commit;


