begin;

alter table public.orders
  drop constraint if exists orders_currency_alignment,
  drop constraint if exists orders_total_gross_eur_check,
  drop constraint if exists orders_eur_rate_check;

alter table public.orders
  drop column if exists eur_rate,
  drop column if exists total_gross_eur,
  drop column if exists currency_code;

update public.orders
set is_eur = false
where is_eur is distinct from false;

commit;

