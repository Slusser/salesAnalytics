# API Endpoint Implementation Plan: POST /customers

## 1. Przegląd punktu końcowego
- Endpoint umożliwia utworzenie nowego klienta w systemie, wypełniając rekord w tabeli `customers` z zachowaniem reguł soft-delete i unikalności nazwy.
- Operacja dostępna jest wyłącznie dla zalogowanych użytkowników z rolą `editor` lub `owner`; wykorzystuje istniejące zabezpieczenia JWT oraz guardy NestJS.
- Zwracany jest `CustomerDto`, co pozwala interfejsowi błyskawicznie zaktualizować listę kontrahentów lub przekierować do widoku szczegółów.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/api/customers`
- Nagłówki: `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- Parametry
  - Wymagane: brak parametrów ścieżki i zapytania; wszystkie dane w ciele.
  - Opcjonalne: brak dodatkowych parametrów.
- Treść żądania (`CreateCustomerDto` → `CreateCustomerCommand`)
  - `name: string` – wymagane; trim, min. 1 i maks. 120 znaków; walidacja unikalności case-insensitive względem aktywnych klientów.
  - `isActive: boolean` – opcjonalne; domyślnie `true`; przy wartości `false` ustawiamy `deleted_at` i `is_active` zgodnie z regułami spójności.
- Automatycznie ustalane pola (po stronie serwera): `id`, `createdAt`, `updatedAt`, `deletedAt`.

## 3. Szczegóły odpowiedzi
- Kod sukcesu: `201 Created`
- Nagłówki: `Location: /customers/{id}`, `Content-Type: application/json`
- Body (`CustomerDto`):
  - `id`, `name`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
- Błędy:
  - `400 Bad Request` – niepoprawne dane wejściowe lub naruszenie unikalności.
  - `401 Unauthorized` – brak lub nieważny token.
  - `403 Forbidden` – użytkownik bez odpowiedniej roli.
  - `500 Internal Server Error` – błędy niesklasyfikowane (np. Supabase).

## 4. Przepływ danych
- Klient wysyła żądanie POST z JSON do kontrolera `CustomersController`.
- Guardy (`JwtAuthGuard`, `RolesGuard`) walidują token i rolę (`editor`/`owner`).
- `ValidationPipe` mapuje payload na `CreateCustomerDto`, uruchamia class-validator i sanitizację.
- Kontroler przekazuje `CreateCustomerCommand` oraz `CustomerMutatorContext` (actorId, roles) do `CustomersService.create`.
- Serwis wykonuje:
  - Trim nazwy i normalizację (np. lower-case do porównania).
  - Walidację biznesową (duplikat sprawdzony w repozytorium lub obsługa błędu Supabase).
  - Wywołanie repozytorium (Supabase client) w transakcji insert + ewentualny update `deleted_at`.
  - Odbiera rekord i mapuje do `CustomerDto`.
  - Emituje wpis audytu (trigger w DB) i ewentualne telemetry.
- Kontroler zwraca DTO wraz z kodem 201 i nagłówkiem `Location`.

## 5. Względy bezpieczeństwa
- Wymagane uwierzytelnienie JWT; brak tokena → `401`.
- Autoryzacja ról: tylko `editor` i `owner` mogą tworzyć klientów; guard odrzuca innych.
- RLS Supabase wymusza, aby tylko uprawnieni użytkownicy mogli pisać do `customers`.
- Walidacja i sanitizacja wejścia chronią przed SQL Injection i XSS (trim, escape).
- Upewnić się, że logger nie ujawnia danych wrażliwych (np. tokenów) w błędach.

## 6. Obsługa błędów
- Walidacja DTO (`class-validator`): brak nazwy, zbyt długi ciąg → `400` z `code: "CUSTOMER_VALIDATION_ERROR"`.
- Duplikat nazwy: mapować błąd Supabase `unique_violation` na `400` z `code: "CUSTOMER_DUPLICATE_NAME"`.
- Brak uprawnień/roli: guard zwraca `403` z `code: "FORBIDDEN"`.
- Brak tokena lub nieważny token: `401` z `code: "UNAUTHORIZED"`.
- Błąd komunikacji z Supabase: `500` z `code: "CUSTOMER_CREATE_FAILED"`, logowany przez `Logger.error`, ewentualnie telemetry.
- Wszystkie odpowiedzi błędów zgodne ze schematem `{ code, message, details }`.

## 7. Wydajność
- Operacja jednostkowa; wykorzystuje indeks `customers_lower_name_idx` dla kontroli duplikatów.
- Minimalizować round-trip: pojedyncze wywołanie insert + select (z `select()` w supabase query).
- Brak konieczności cache; rozważyć wysyłkę telemetry asynchronicznie, by nie blokować odpowiedzi.
- Upewnić się, że walidacje wykonywane w pamięci (trim) są lekkie.

## 8. Kroki implementacji
1. Dodaj `CreateCustomerDto` w `apps/api/src/customers/dto/create-customer.dto.ts` z `class-validator`, `class-transformer` (trim, default `true`).
2. Zaktualizuj `CustomersController` (`apps/api/src/customers/customers.controller.ts`): dodaj akcję `@Post()` z dekoratorami `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@Roles('editor','owner')`.
3. Rozszerz `CustomersService` (`apps/api/src/customers/customers.service.ts`) o metodę `create(command: CreateCustomerCommand, context: CustomerMutatorContext)` implementującą logikę biznesową i obsługę duplikatów.
4. W repozytorium/adapterze Supabase (`apps/api/src/customers/customers.repository.ts` lub analogicznym) zaimplementuj insert z wykorzystaniem transakcji i mapowania do `CustomerDto`.
5. Dodaj mapper `CustomerMapper` (jeśli brak) do translacji rekordu DB na DTO (`customer: Tables<'customers'> -> CustomerDto`).
6. Upewnij się, że moduł `CustomersModule` eksportuje serwis i wstrzykuje repozytorium; zarejestruj DTO w `providers` jeśli używa pipeline z `ValidationPipe`.
7. Zaimplementuj logowanie błędów w serwisie przy pomocy `Logger` oraz ewentualne zdarzenia telemetry (`customer.created`).
9. Uzupełnij dokumentację Swagger: @ApiResponse dla 201/400/401/403/500, przykład payloadu, schema DTO.
