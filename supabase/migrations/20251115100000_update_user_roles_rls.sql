-- adjust user_roles RLS policies to avoid self-referencing queries
begin;

drop policy if exists user_roles_select_authenticated on public.user_roles;
drop policy if exists user_roles_select_anon on public.user_roles;
drop policy if exists user_roles_insert_authenticated on public.user_roles;
drop policy if exists user_roles_insert_anon on public.user_roles;
drop policy if exists user_roles_update_authenticated on public.user_roles;
drop policy if exists user_roles_update_anon on public.user_roles;
drop policy if exists user_roles_delete_authenticated on public.user_roles;
drop policy if exists user_roles_delete_anon on public.user_roles;

create policy user_roles_select_authenticated on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_roles_select_anon on public.user_roles
  for select
  to anon
  using (false);

create policy user_roles_insert_authenticated on public.user_roles
  for insert
  to authenticated
  with check (false);

create policy user_roles_insert_anon on public.user_roles
  for insert
  to anon
  with check (false);

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

create policy user_roles_delete_authenticated on public.user_roles
  for delete
  to authenticated
  using (false);

create policy user_roles_delete_anon on public.user_roles
  for delete
  to anon
  using (false);

commit;

