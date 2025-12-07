-- migration metadata ----------------------------------------------------------
-- purpose: add default_distributor_discount_pct column to customers table
-- notes: ensures every customer can define default discount used when creating orders
-- -----------------------------------------------------------------------------

begin;

alter table public.customers
  add column if not exists default_distributor_discount_pct numeric(5, 2) not null default 0;

commit;


