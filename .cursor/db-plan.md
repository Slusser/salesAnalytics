1. Lista tabel z ich kolumnami, typami danych i ograniczeniami

- `users`
  - Kolumny:

    | Kolumna | Typ | Ograniczenia / domyślne / opis |
    | --- | --- | --- |
    | `id` | `uuid` | PK; wartość równa `auth.uid()`; wstawiana przez Supabase Auth |
    | `email` | `citext` | `NOT NULL`, `UNIQUE`; synch. z Supabase Auth |
    | `display_name` | `text` | `NOT NULL`; nazwa wyświetlana |
    | `created_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` |
    | `updated_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` aktualizowane triggerem |
  - Ograniczenia dodatkowe: trigger `set_updated_at()` aktualizuje `updated_at`.
  - Ta tabela jest zarządzana przez Supabase Auth

- `user_roles`
  - Kolumny:

    | Kolumna | Typ | Ograniczenia / domyślne / opis |
    | --- | --- | --- |
    | `user_id` | `uuid` | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` |
    | `role` | `text` | `NOT NULL`, `CHECK (role IN ('owner','editor','viewer'))` |
    | `granted_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` |
  - Klucze: PK złożony (`user_id`, `role`).

- `customers`
  - Kolumny:

    | Kolumna | Typ | Ograniczenia / domyślne / opis |
    | --- | --- | --- |
    | `id` | `uuid` | PK, domyślnie `gen_random_uuid()` |
    | `name` | `text` | `NOT NULL` |
    | `is_active` | `boolean` | `NOT NULL`, domyślnie `true` |
    | `created_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` |
    | `updated_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` aktualizowane triggerem |
    | `deleted_at` | `timestamptz` | `NULL`; soft-delete |
  - Ograniczenia dodatkowe: `CHECK (is_active OR deleted_at IS NOT NULL)` zapewniający spójność flagi aktywności; unikalność częściowa `UNIQUE (lower(name)) WHERE deleted_at IS NULL` (do weryfikacji z biznesem).

- `orders`
  - Kolumny:

    | Kolumna | Typ | Ograniczenia / domyślne / opis |
    | --- | --- | --- |
    | `id` | `uuid` | PK, domyślnie `gen_random_uuid()` |
    | `customer_id` | `uuid` | `NOT NULL`, FK → `customers(id)` `ON DELETE RESTRICT` |
    | `created_by` | `uuid` | `NOT NULL`, FK → `users(id)` `ON DELETE RESTRICT` |
    | `order_no` | `text` | `NOT NULL`; unikalność częściowa `UNIQUE (lower(order_no)) WHERE deleted_at IS NULL` |
    | `order_date` | `date` | `NOT NULL` |
    | `item_name` | `text` | `NOT NULL` |
    | `quantity` | `numeric(12,2)` | `NOT NULL`, `CHECK (quantity > 0)` |
    | `is_eur` | `boolean` | `NOT NULL`, domyślnie `false` |
    | `eur_rate` | `numeric(12,6)` | `NULL`; `CHECK ((is_eur = false AND eur_rate IS NULL) OR (is_eur = true AND eur_rate IS NOT NULL AND eur_rate > 0))` |
    | `total_net_pln` | `numeric(18,2)` | `NOT NULL`, `CHECK (total_net_pln >= 0)` |
    | `total_gross_pln` | `numeric(18,2)` | `NOT NULL`, `CHECK (total_gross_pln >= total_net_pln)` |
    | `total_gross_eur` | `numeric(18,2)` | `NULL`; `CHECK ((is_eur = false AND total_gross_eur IS NULL) OR (is_eur = true AND total_gross_eur IS NOT NULL AND total_gross_eur >= 0))` |
    | `producer_discount_pct` | `numeric(5,2)` | `NOT NULL`, domyślnie `0`, `CHECK (producer_discount_pct BETWEEN 0 AND 100)` |
    | `distributor_discount_pct` | `numeric(5,2)` | `NOT NULL`, domyślnie `0`, `CHECK (distributor_discount_pct BETWEEN 0 AND 100)` |
    | `vat_rate_pct` | `numeric(5,2)` | `NOT NULL`, domyślnie `23` |
    | `comment` | `text` | `NULL` |
    | `created_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` |
    | `updated_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` aktualizowane triggerem |
    | `deleted_at` | `timestamptz` | `NULL`; soft-delete |
  - Ograniczenia dodatkowe: `CHECK (is_eur = (currency_code = 'EUR'))`; opcjonalny `CHECK (order_date <= current_date)` do potwierdzenia; trigger walidujący tolerancję brutto/netto (±0,01) podczas INSERT/UPDATE.

- `audit_log`
  - Kolumny:

    | Kolumna | Typ | Ograniczenia / domyślne / opis |
    | --- | --- | --- |
    | `id` | `bigserial` | PK |
    | `schema_name` | `text` | `NOT NULL`, domyślnie `current_schema` w triggerze |
    | `table_name` | `text` | `NOT NULL` |
    | `record_pk` | `text` | `NOT NULL`; klucz główny rekordu źródłowego |
    | `operation` | `text` | `NOT NULL`, `CHECK (operation IN ('INSERT','UPDATE','DELETE'))` |
    | `old_row` | `jsonb` | `NULL`; wypełniane dla UPDATE/DELETE |
    | `new_row` | `jsonb` | `NULL`; wypełniane dla INSERT/UPDATE |
    | `actor` | `uuid` | `NULL`; `auth.uid()` z kontekstu Supabase |
    | `occured_at` | `timestamptz` | `NOT NULL`, domyślnie `now()` |
    | `request_id` | `uuid` | `NULL`; korelacja zdarzeń (opcjonalnie) |
  - Ograniczenia dodatkowe: indeks GIN na polach JSON zapewniony w sekcji indeksów.

2. Relacje między tabelami

- `users 1:N user_roles` (klucz główny użytkownika → role nadane użytkownikowi).
- `users 1:N orders` przez `orders.created_by` (twórca/edytor rekordu zamówienia).
- `customers 1:N orders` przez `orders.customer_id` (zamówienia przypisane do kontrahenta).
- `audit_log` przechowuje relacje logiczne do wszystkich tabel objętych audytem przez `record_pk` i `table_name`.

3. Indeksy

- `orders_lower_order_no_idx` na `orders(lower(order_no))` (`WHERE deleted_at IS NULL`) – wymuszenie i obsługa wyszukiwania po numerze zamówienia (case-insensitive).
- `orders_customer_idx` na `orders(customer_id)` – filtry listy zamówień po kontrahencie.
- `orders_order_date_idx` na `orders(order_date)` – sortowanie i filtry dat.
- `orders_created_by_idx` na `orders(created_by)` – raporty aktywności użytkowników.
- `orders_soft_delete_idx` na `orders(deleted_at)` – przyspiesza zapytania filtrujące aktywne rekordy (`WHERE deleted_at IS NULL`).
- `customers_lower_name_idx` na `customers(lower(name))` – wyszukiwanie kontrahentów z tolerancją wielkości liter.
- `customers_soft_delete_idx` na `customers(deleted_at)` – filtrowanie aktywnych kontrahentów.
- `user_roles_role_idx` na `user_roles(role)` – zapytania agregujące po roli.
- `audit_log_table_occurred_idx` na `audit_log(table_name, occured_at DESC)` – przegląd audytu po tabeli i czasie.
- `audit_log_old_row_gin_idx` oraz `audit_log_new_row_gin_idx` – indeksy GIN na `jsonb` do wyszukiwania w treści audytu (opcjonalnie z `pg_trgm`).

4. Zasady PostgreSQL (RLS)

- Aktywacja RLS na `users`, `user_roles`, `customers`, `orders`, `audit_log`.
- Przykładowe polityki:
  - `users`: polityka SELECT `USING (id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner'))`; brak INSERT/UPDATE/DELETE bez dedykowanych funkcji `SECURITY DEFINER`.
  - `user_roles`: polityka SELECT `USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner'))`; INSERT/DELETE tylko poprzez funkcję `assign_role(auth.uid())` dostępną dla `owner`.
  - `customers`: polityka SELECT `USING (deleted_at IS NULL)`; polityki INSERT/UPDATE/DELETE wymagają roli `editor` lub `owner` (`WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('editor','owner')))`).
  - `orders`: polityka SELECT `USING (deleted_at IS NULL)`; polityka INSERT/UPDATE/DELETE dla `editor`/`owner` z warunkiem `customer_id` wskazującym istniejącego, nieusuniętego kontrahenta; dodatkowo `WITH CHECK` wymuszające `created_by = auth.uid()` przy INSERT oraz `deleted_at IS NULL` przy modyfikacjach.
  - `audit_log`: domyślnie tylko `owner` ma SELECT (`USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'))`).
- Zestaw funkcji `SECURITY DEFINER` do operacji administracyjnych (np. przypisanie ról, hard-delete, raporty audytu) z kontrolą uprawnień wewnątrz funkcji.

5. Dodatkowe uwagi

- Wymagana implementacja triggerów: `set_updated_at` (before update) dla tabel `users`, `customers`, `orders`; triggery audytu `after insert/update/delete` dla `customers` i `orders` (możliwe rozszerzenie na `user_roles`).
- Trzeba potwierdzić politykę unikalności nazw kontrahentów oraz ewentualne wyjątki (np. duplikaty dla grup kapitałowych). W razie potrzeby usunąć/zmodyfikować unikalność częściową.
- Do potwierdzenia ograniczenie `CHECK (order_date <= current_date)` – obecnie rekomendacja, ale może wymagać obsługi zamówień przyszłych (np. pre-ordery).
- Walidacja tolerancji brutto/netto (±0,01) powinna zostać zaimplementowana w warstwie aplikacji i/lub triggerze `BEFORE INSERT/UPDATE`; baza przechowuje wartości końcowe.
- Retencja danych audytowych wymaga osobnej decyzji (np. `PARTITION BY` po roku lub polityka czyszczenia). Na potrzeby MVP przewiduje się nieograniczoną retencję z możliwością archiwizacji.
- `citext` wymaga rozszerzenia `CREATE EXTENSION IF NOT EXISTS citext;`; podobnie GIN/`pg_trgm` dla indeksów tekstowych jeśli będzie używany fuzzy search.

