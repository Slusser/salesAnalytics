# API Endpoint Implementation Plan: DELETE /customers/{customerId}

## 1. Przegląd punktu końcowego
- Endpoint służy do miękkiego usuwania klienta poprzez ustawienie `is_active = false` i wypełnienie `deleted_at`, pozostawiając rekord w bazie dla celów audytu.
- Obsługiwany w module `CustomersModule` po stronie NestJS; korzysta z Supabase jako warstwy danych oraz współdzielonych DTO z `apps/shared/dtos`.
- Uprawnienia posiadają role `editor` oraz `owner`; `viewer` ma dostęp tylko do odczytu i otrzymuje `403`.
- Operacja musi wywołać audyt (`audit_log`) oraz telemetryjne zdarzenie `customer.deleted`, zachowując zgodność z polityką RLS Supabase.

## 2. Szczegóły żądania
- Metoda HTTP: `DELETE`
- Struktura URL: `/api/v1/customers/{customerId}` (prefiks wersji zgodny z globalną konfiguracją API)
- Nagłówki: `Authorization: Bearer <jwt>`, `Accept: application/json`
- Parametry:
  - Wymagane: `customerId` (segment ścieżki, `uuid` v4, walidowany w `CustomerIdParamDto`)
  - Opcjonalne: brak
- Request Body: brak; kontroler wymusza puste body poprzez `@Body(new ParseEmptyPipe())` lub brak dekoratora `@Body()`
- Powiązane DTO/Commandy:
  - `CustomerIdParamDto` – walidacja identyfikatora
  - `DeleteCustomerCommand` – przekazywany do serwisu (np. `{ customerId: string; actorId: string; actorRoles: UserRoleValue[] }`)
  - `CustomerMutatorContext` – przekazanie informacji o aktorze

## 3. Szczegóły odpowiedzi
- Sukces: `200 OK`
- Treść: `CustomerDetailResponse` (`CustomerDto`) zaktualizowany o `isActive=false`, `deletedAt=<ISO timestamp>`
- Nagłówki: `Content-Type: application/json`, `Cache-Control: no-store`
- Brak dodatkowych pól technicznych; daty w formacie ISO 8601, typy boolean i uuid bez konwersji

## 4. Przepływ danych
1. Klient wysyła `DELETE` z nagłówkiem `Authorization` do `API Gateway`/NestJS.
2. `SupabaseAuthGuard` weryfikuje JWT; `RolesGuard` dopuszcza tylko role `editor` i `owner`, uzupełniając kontekst użytkownika.
3. `CustomersController.delete` przyjmuje `CustomerIdParamDto` (globalny `ValidationPipe` transformuje i waliduje).
4. Kontroler wywołuje `CustomersMutationService.delete(command)` przekazując `customerId` i `CustomerMutatorContext`.
5. Serwis:
   - Loguje żądanie (`Logger.debug`) z `requestId` bez danych wrażliwych.
   - Pobiera rekord przez `CustomersRepository.findById(customerId, { includeDeleted: true })`.
   - Rzuca `NotFoundException`, jeśli rekord nie istnieje lub jest niedostępny zgodnie z rolą.
   - Jeżeli `deletedAt` już ustawione, zwraca idempotentnie aktualny rekord (bez kolejnego update) i loguje informację.
   - W transakcji Supabase aktualizuje `is_active=false`, `deleted_at=now()` oraz `updated_at=now()` (można użyć `.update({...}).eq('id', customerId).select().single()`).
   - Mapuje wynik na `CustomerDto` przy pomocy `CustomerMapper`.
   - Asynchronicznie emituje `customer.deleted` i przekazuje `actorId` do audytu (trigger w DB).
6. Kontroler zwraca DTO z kodem `200`.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagany token Supabase; dokumentować `@ApiBearerAuth()`.
- **Autoryzacja**: guard ról + dodatkowa walidacja w serwisie (rola `viewer` → `ForbiddenException`).
- **RLS**: Supabase polityki zabezpieczają rekordy przed manipulacją spoza dozwolonych ról; serwis nie nadpisuje `created_by`.
- **Audyt**: DB trigger zapisuje operację w `audit_log`; serwis przekazuje `actorId` oraz `requestId` do loggera.
- **Logowanie**: maskowanie identyfikatorów w logach, korelacja `requestId` z interceptora MDC.

## 6. Obsługa błędów
- `400 Bad Request` – niepoprawny `customerId` (walidacja DTO)
- `401 Unauthorized` – nieważny/brakujący token (guard)
- `403 Forbidden` – rola `viewer` lub brak uprawnień wynikających z RLS
- `404 Not Found` – klient nie istnieje lub nie jest dostępny w kontekście roli
- `500 Internal Server Error` – błędy Supabase, problemy z połączeniem, nieobsłużone wyjątki; logować `Logger.error` i zwracać `{ code: 'CUSTOMERS_DELETE_FAILED', message }`
- Wszystkie odpowiedzi błędów ujednolicone do struktury `{ code, message, details? }`

## 7. Wydajność
- Pojedyncza aktualizacja + ewentualne pojedyncze `SELECT`; wykorzystanie indeksu PK oraz `customers_soft_delete_idx` minimalizuje koszty.
- Brak paginacji ani złożonych zapytań; ensure `select()` ogranicza kolumny do potrzeb DTO.
- Operacje telemetryczne wykonywane asynchronicznie, aby nie wydłużać czasu odpowiedzi.
- Rozważyć pojedynczy retry w serwisie dla transientnych błędów sieciowych Supabase (z ograniczonym backoffem).

## 8. Kroki implementacji
1. **DTO**: dodać `CustomerIdParamDto` (jeśli brak) w `apps/api/src/app/customers/dto`, z `@IsUUID('4')`, `@ApiParam` i opisem Swagger.
2. **Command**: utworzyć `DeleteCustomerCommand` i ewentualny mapper kontekstu w `customers.command.ts` (lub rozszerzyć istniejące kontrakty) tak, aby serwis otrzymywał komplet informacji.
3. **Repository**: rozszerzyć `CustomersRepository` o metody `findById` i `softDelete` korzystające z Supabase (`.from('customers')`...).
4. **Serwis**: zaimplementować `CustomersMutationService.delete(command)` z walidacją ról, spójnością danych, mapowaniem błędów Supabase (np. `PostgrestError` → NestJS exceptions).
5. **Kontroler**: dodać handler `@Delete(':customerId')` z guardami, dekoratorami Swagger (`@ApiOperation`, `@ApiOkResponse`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse`, `@ApiInternalServerErrorResponse`).
6. **Swagger**: zaktualizować dokumentację, w tym przykładową odpowiedź `200` i komunikaty błędów.
8. **Telemetry i logi**: upewnić się, że `TelemetryService` (jeśli dostępny) emituje `customer.deleted`, a logger korzysta z MDC.
9. **Konfiguracja**: sprawdzić ustawienia RLS Supabase (INSERT/UPDATE/DELETE dla ról `editor`/`owner`) i dostosować, jeśli brak polityki dla soft-delete.
