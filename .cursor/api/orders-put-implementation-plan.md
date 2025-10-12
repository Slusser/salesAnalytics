# API Endpoint Implementation Plan: PUT /orders/{orderId}

## 1. Przegląd punktu końcowego
- Aktualizuje istniejące zamówienie w tabeli `orders`, zapewniając spójność finansową, audyt oraz telemetry `order.saved`.
- Wymaga autentykacji Supabase JWT i jest dostępny dla ról `editor` oraz `owner` zgodnie z RLS.
- Obejmuje ponowną walidację danych biznesowych, aktualizację rowków zależnych oraz konsekwentne logowanie zdarzeń.

## 2. Szczegóły żądania
- Metoda HTTP: `PUT`.
- Struktura URL: `/api/orders/{orderId}` (uwzględnić globalny prefiks, np. `/api/v1`).
- Nagłówki: `Authorization: Bearer <jwt>`, `Content-Type: application/json`.
- Parametry:
  - Path: `orderId` (`uuid`, walidacja `@IsUUID('4')`).
  - Query: brak.
- Body (`UpdateOrderCommand` w trybie pełnej aktualizacji):
  - Wymagane pola: `orderNo`, `customerId`, `orderDate`, `itemName`, `quantity`, `isEur`, `producerDiscountPct`, `distributorDiscountPct`, `vatRatePct`, `totalNetPln`, `totalGrossPln`.
  - Wymagane warunkowo: `eurRate`, `totalGrossEur` gdy `isEur=true`; zakazane gdy `isEur=false`.
  - Opcjonalne: `comment` (trim, limit znaków, sanitizacja XSS).
- Walidacja DTO (`UpdateOrderDto`, `OrderIdParamDto`):
  - `@IsString`, `@Length`, `@Matches` dla `orderNo`, `itemName` (dozwolone znaki, max 120).
  - `@IsDateString()` oraz custom `@ValidateIf(() => featureFlag.orderDatePastOnly)` → `orderDate <= current_date`.
  - `@IsNumber`, `@IsPositive`, `@Min(0)`, `@Max(100)` dla rabatów, `@Min(0)` dla kwot.
  - `@ValidateIf`, `@IsOptional` dla pól zależnych; transformacje `@Transform(({ value }) => value?.trim())`.
- Powiązane DTO/Command modele: `UpdateOrderCommand`, `OrderResponse`, `OrderDetailDto`, `CustomerDto`, `UserSummaryDto` (z bibliotek współdzielonych `apps/shared/dtos`).

## 3. Szczegóły odpowiedzi
- Status sukcesu: `200 OK`.
- Body: `OrderResponse` (`OrderDetailDto`) obejmujący zaktualizowane pola kwotowe, informacje o kliencie (`Pick<CustomerDto, 'id' | 'name'>`), autorze (`UserSummaryDto`) oraz znaczniki czasu.
- Nagłówki: `Content-Type: application/json`, `Cache-Control: no-store`.
- Brak odpowiedzi dla błędów poza strukturalnym `ErrorResponse` (`{ code, message, details? }`).

## 4. Przepływ danych
- Klient wysyła `PUT /orders/{orderId}` z JWT i kompletnym payloadem.
- `SupabaseAuthGuard` oraz `RolesGuard` autentykują i autoryzują użytkownika; kontekst (`actorId`, `roles`) trafia do żądania.
- `OrdersController.updateOrder`:
  - Parsuje `OrderIdParamDto`, `UpdateOrderDto` przy użyciu globalnego `ValidationPipe` (`whitelist`, `transform`).
  - Loguje próbę (Logger, poziom debug) z maskowanym `orderNo`.
  - Deleguje do `OrdersService.update` (lub analogicznego serwisu poleceń).
- `OrdersService.update`:
  - Potwierdza role (blokuje `viewer`) i sprawdza flagę `includeDeleted` (zawsze false dla PUT).
  - Pobiera aktualny rekord (`OrdersRepository.findByIdForUpdate(orderId)`) i weryfikuje `deletedAt IS NULL`; brak → `NotFoundException`.
  - Weryfikuje, że `customerId` wskazuje aktywnego klienta (`CustomersRepository.findActiveById`).
  - Wywołuje helper walidacji biznesowej (`AmountsValidator.validateTolerances`, `DiscountValidator.validateRange`, `CurrencyValidator.ensureConsistency`).
  - W transakcji Supabase:
    - Aktualizuje rekord `orders` (set payload + `updated_at`).
    - Zapisuje wpis w `audit_log` z `old_row`, `new_row`, `actor`.
  - Emisja telemetry `order.saved`/`order.updated` poprzez `TelemetryService.emitAsync()` (fire-and-forget) oraz ewentualne metryki.
  - Mapuje wynik na `OrderResponse` (`OrdersMapper.toResponse`).
- Kontroler zwraca `200 OK` wraz z odpowiedzią.

## 5. Względy bezpieczeństwa
- Autentykacja: obowiązkowe JWT (`@ApiBearerAuth()` w dokumentacji Swagger).
- Autoryzacja: `RolesGuard` sprawdza role `editor`/`owner`; serwis ponownie weryfikuje role aktora przed wywołaniem repozytorium.
- Supabase RLS `WITH CHECK` ogranicza aktualizacje do dozwolonych rekordów (zależne od `created_by` i tenant).
- Walidacja wejścia i sanitizacja (`class-transformer`, `class-validator`) chronią przed injection; `comment` przepuszczany przez helper oczyszczający (np. `stripTags`).
- Logowanie minimalizuje wyciek danych (maskowanie `orderNo`, brak kwot w logach na poziomie info).
- Ograniczenie częstości wywołań (`ThrottlerGuard`, np. 50 req/min/user) minimalizuje próby brute force.
- Opcjonalna kontrola współbieżności (porównanie `updatedAt` z klienta) – jeśli wdrożona, rzuca `409` i wzmacnia bezpieczeństwo danych.

## 6. Obsługa błędów
- `400 Bad Request`: błędy walidacji DTO, niespójne pola EUR/PLN, przekroczenie tolerancji (±0.01), rabaty/VAT poza zakresem, klient nieaktywny.
- `401 Unauthorized`: brak/niepoprawny token (guard zwraca `UnauthorizedException`).
- `403 Forbidden`: niewystarczające role lub odrzucenie przez RLS; rzuca `ForbiddenException` z kodem `ORDERS_FORBIDDEN`.
- `404 Not Found`: zamówienie nie istnieje lub `deletedAt` ≠ null; ewentualnie brak aktywnego klienta (mapować na `NotFound` lub `BadRequest` w zależności od polityki, preferowana spójność `404`).
- `409 Conflict`: naruszenie unikalności `orderNo` (`PostgrestError` kod `23505`) lub konflikt optymistyczny przy `updatedAt` (jeśli wdrożony).
- `500 Internal Server Error`: błędy Supabase, audytu, telemetry. Logować `Logger.error` z `requestId`; brak dedykowanej tabeli błędów, więc monitorować poprzez istniejący stack (np. Sentry).

## 7. Wydajność
- Minimalizacja zapytań: jedno pobranie rekordu + jedno `update` w transakcji; użyć `select().single()`/`rpc` z `rollback` w razie błędów.
- Indeksy (`orders_soft_delete_idx`, `orders_lower_order_no_idx`, `orders_customer_idx`) wspierają pobranie i weryfikację konfliktów.
- Telemetria/logowanie asynchroniczne (`void telemetryService.emitOrderSaved(...)`) zapobiega wydłużeniu czasu odpowiedzi.
- Możliwe wykorzystanie cache kursów EUR w serwisie (jeśli walidacja wymaga ponownego pobrania) z TTL.
- Dbałość o limit payloadu (np. maksymalna długość `comment`) zmniejsza koszt serializacji/deserializacji.

## 8. Kroki implementacji
1. **DTO i mapowanie**: utworzyć `update-order.dto.ts` (body) oraz `order-id-param.dto.ts` (param) w `apps/api/src/orders/dto`; dodać funkcję mapującą DTO → `UpdateOrderCommand`.
2. **Controller**: dodać metodę `@Put(':orderId')` w `OrdersController` z guardami, `@ApiOperation`, `@ApiParam`, `@ApiOkResponse`, `@ApiBadRequestResponse`, `@ApiConflictResponse`.
3. **Serwis**: zaimplementować `OrdersService.update(orderId, command, actor)` obejmującą walidacje biznesowe, pobranie obecnego stanu, obsługę transakcji i mapowanie do odpowiedzi.
4. **Repozytorium**: rozszerzyć `OrdersRepository` o metody `findByIdForUpdate`, `updateOrder` obsługujące Supabase (transakcje, mapowanie błędów `PostgrestError` → wyjątki Nest, w tym `ConflictException`).
5. **Walidatory pomocnicze**: dodać/rozszerzyć helpery walidacji kwot (`validateTolerances`), rabatów, logiki EUR; zapewnić pokrycie testami jednostkowymi.
6. **Telemetria i logowanie**: wstrzyknąć `TelemetryService`, `Logger`; emitować `order.saved` (lub dedykowane `order.updated`) asynchronicznie oraz logować błędy z maskowaniem danych.
7. **Swagger i dokumentacja**: zaktualizować Swagger (schematy ciała/odpowiedzi, kody błędów, przykłady) i wewnętrzną dokumentację `.cursor/api-plan.md` jeśli parametry się zmienią.
9. **Kontrola jakości**: uruchomić `nx lint api-orders`
