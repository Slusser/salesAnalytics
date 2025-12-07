begin;

alter table public.orders
  add column if not exists catalog_unit_gross_pln numeric(12,2) not null default 0,
  add column if not exists distributor_price_pln numeric(12,2) not null default 0,
  add column if not exists customer_price_pln numeric(12,2) not null default 0,
  add column if not exists profit_pln numeric(12,2) not null default 0;

commit;


