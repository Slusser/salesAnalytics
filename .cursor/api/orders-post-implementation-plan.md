# Plan implementacji endpointu API: POST /orders

## 1. Przegląd punktu końcowego
- Cel: umożliwienie ról `editor` i `owner` tworzenia nowych zamówień z jednoczesnym wyliczeniem pól kwotowych, zapisem audytu oraz emisją telemetry `order.saved`.
- Zakres: backend NestJS (apps/api) z integracją Supabase/PostgreSQL dla tabel `orders`, `customers`, `audit_log`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`.
- Struktura URL: `/api/orders` (zależne od globalnego prefiksu API).
- Nagłówki: `Authorization: Bearer <jwt>`, `Content-Type: application/json`.
- Body (`CreateOrderCommand`):
  - Wymagane: `orderNo`, `customerId`, `orderDate`, `itemName`, `quantity`, `isEur`, `producerDiscountPct`, `distributorDiscountPct`, `vatRatePct`, `totalNetPln`, `totalGrossPln`.
  - Wymagane warunkowo: `eurRate`, `totalGrossEur` gdy `isEur=true`; zabronione gdy `isEur=false`.
  - Opcjonalne: `comment`.
- Walidacja: dekoratory class-validator (`IsString`, `IsUUID`, `IsDateString`, `IsNumber`, `IsPositive`, `Min`, `Max`, `ValidateIf`, `IsOptional`, `Length`, ewentualnie niestandardowy `@IsCurrencyAmount`).
- Autoryzacja wejścia: guard zapewniający role `editor` lub `owner`.

## 3. Szczegóły odpowiedzi
- Status sukcesu: `201 Created`.
- Body: `OrderResponse` (`OrderDetailDto`) z pełnymi danymi zamówienia, powiązanym klientem i autorem (`UserSummaryDto`).
- Nagłówki: `Location: /orders/{id}`, `Content-Type: application/json`.
- Brak ciała dla błędów 4xx/5xx poza standardowym `{ code, message, details? }`.

## 4. Przepływ danych
- Controller `OrdersController` (apps/api/src/orders) wykorzystuje `ValidationPipe` i mapuje DTO na `CreateOrderCommand`.
- Guard autentykacyjny Supabase (JWT) dostarcza kontekst użytkownika (`actorId`, `roles`).
- Serwis `OrdersService.createOrder(command, actor)`:
  - Weryfikuje role, ładuje klienta (aktywny, nieusunięty) przez repozytorium Supabase.
  - Normalizuje tekst (`trim`, limit długości), waliduje warunkowe pola EUR, sprawdza tolerancję brutto/netto (±0,01), zakres rabatów i VAT.
  - Wykonuje transakcję: INSERT do `orders`, zapis do `audit_log`, ustawienie `created_by` na aktora.
  - Emituje zdarzenie telemetry `order.saved` (EventEmitter/serwis telemetry) asynchronicznie.
- Repozytorium/adapter do Supabase wykorzystuje RLS oraz mapuje błędy DB (np. `23505` → duplikat `orderNo`).

## 5. Względy bezpieczeństwa
- Autentykacja: obowiązkowy Supabase JWT w `Authorization`.
- Autoryzacja: `RolesGuard` blokuje role inne niż `editor`/`owner`.
- Walidacja wejścia jako pierwsza linia obrony przed nadużyciami (limit długości, sanityzacja `comment`).
- Ochrona przed duplikatami: unikalność `order_no` (case-insensitive) egzekwowana przez bazę i obsługiwana jako `409 Conflict`.
- Bezpieczne logowanie błędów (Nest Logger), brak ujawniania danych wrażliwych w odpowiedzi.

## 6. Obsługa błędów
- `400 Bad Request`: walidacja DTO, niespójne pola EUR, brak aktywnego klienta, przekroczenie tolerancji kwot, rabaty/VAT poza zakresem.
- `401 Unauthorized`: brak/niepoprawny token JWT (obsługa w guardzie).
- `403 Forbidden`: niewystarczające role użytkownika.
- `404 Not Found`: wskazany `customerId` nie istnieje lub jest soft-delete (opcjonalnie mapowane jako `400` z kodem biznesowym, zależnie od decyzji).
- `409 Conflict`: duplikat `orderNo` z constraintu Supabase.
- `500 Internal Server Error`: awaria bazy, audytu lub telemetry; logowanie i alerting poprzez istniejącą infrastrukturę (np. Sentry).
- Zgodność z globalnym filtrem wyjątków zapewnia jednolitą strukturę błędów.

## 7. Wydajność
- Minimalizować liczbę zapytań (po klienta + insert w transakcji).
- Wykorzystać indeksy (`orders_lower_order_no_idx`, `orders_customer_idx`) dla walidacji i późniejszych zapytań.
- Telemetry realizować asynchronicznie (kolejka/event bus) by nie blokować odpowiedzi.
- Opcjonalnie cache kursów EUR w warstwie serwisu, aby uniknąć dodatkowych zapytań podczas walidacji.

## 8. Kroki implementacji
1. Zdefiniować `CreateOrderDto` w `apps/api/src/orders/dto` z odpowiednimi dekoratorami walidacyjnymi i mapowaniem do `CreateOrderCommand`.
2. Dodać endpoint `@Post()` w `OrdersController` z `AuthGuard`, `RolesGuard`, `ApiTags`, `ApiOperation`, `ApiResponse` oraz `Location` header.
3. Rozszerzyć `OrdersService` o metodę `createOrder`, obejmując walidację biznesową, kalkulacje i obsługę konfliktów.
4. Zaimplementować repozytorium/adapter Supabase (lub rozszerzyć istniejące) wykonujące transakcję INSERT + audyt + RLS; dodać mapowanie błędów Supabase na wyjątki Nest.
5. Podłączyć emisję telemetry (`TelemetryService.emitOrderSaved`) i zapewnić poprawne logowanie błędów asynchronicznych.
7. Zaktualizować dokumentację Swagger (schematy, przykłady) oraz checklistę wdrożenia.
8. Uruchomić lint, format; zrewidować logowanie i monitoring przed wdrożeniem.
