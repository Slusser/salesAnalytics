# API Endpoint Implementation Plan: PUT /customers/{customerId}

## 1. Przegląd punktu końcowego
- Endpoint aktualizuje istniejącego klienta w tabeli `customers`, pozwalając na zmianę nazwy, flagi aktywności oraz pól soft-delete zgodnie z zasadami spójności (`is_active` ↔ `deleted_at`).
- Przeznaczony do użytku w panelu administracyjnym/webowym przez role `editor` i `owner`; `viewer` posiada tylko dostęp odczytu.
- Implementacja realizowana w module `CustomersModule` po stronie NestJS z wykorzystaniem klienta Supabase i współdzielonych typów z `apps/shared/dtos`.
- Operacja powinna respektować triggery audytu oraz RLS Supabase, aby utrzymać historię zmian i ograniczyć dostęp do rekordów.

## 2. Szczegóły żądania
- Metoda HTTP: `PUT`.
- Struktura URL: `/api/customers/{customerId}` (prefiks wersji zależny od globalnej konfiguracji Nest).
- Nagłówki: `Authorization: Bearer <jwt>`, `Content-Type: application/json`, `Accept: application/json`.
- Parametry:
  - Wymagane: `customerId` (segment ścieżki, `uuid` v4; DTO `CustomerIdParamDto` z `@IsUUID('4')`).
  - Opcjonalne parametry zapytania: brak.
- Request Body (`UpdateCustomerDto` mapowane na `UpdateCustomerCommand`):
  - `name?: string` – trim, min. 1, max. ~120 znaków, `@Matches` dla bezpiecznego zestawu znaków; unikalność case-insensitive wobec aktywnych klientów.
  - `isActive?: boolean` – gdy przesłane `false`, ustawiamy `deletedAt` (obliczane w serwisie) aby spełnić constraint; przy `true` wymuszamy `deletedAt = null`.
  - `deletedAt?: string | null` – akceptuje `ISO 8601`; walidacja flagi `isActive` (jeśli `deletedAt` ≠ null ⇒ `isActive` musi być `false`).
  - Dodatkowe pola wejściowe mają być odrzucone przez `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).
- Kontekst aktora (`CustomerMutatorContext`) przekazywany z guardów (`actorId`, `actorRoles`).
- Walidacja i transformacje: `class-validator`/`class-transformer` (trim, konwersja string→boolean, parsing dat) oraz dodatkowe funkcje serwisowe dla reguł biznesowych (np. normalizacja nazwy do porównania).
- Powiązane typy: `UpdateCustomerCommand`, `CustomerDto`, `CustomerMutatorContext`, `Tables<'customers'>` (repozytorium), ewentualny `CustomerMapper`.

## 3. Szczegóły odpowiedzi
- Sukces: `200 OK`.
- Treść odpowiedzi: `CustomerDetailResponse` (alias `CustomerDto`) zawierająca `id`, `name`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`.
- Nagłówki: `Content-Type: application/json`, `Cache-Control: no-store`.
- W przypadku aktualizacji statusu na nieaktywny odpowiedź powinna odzwierciedlać nowe wartości (`isActive=false`, `deletedAt` ≠ null).
- Brak dodatkowych pól technicznych; zachować zgodność typową z dtos frontendowych.

## 4. Przepływ danych
1. Klient (frontend) wysyła `PUT` z JWT oraz payloadem do bramy API (`/api/v1/customers/{customerId}`).
2. `SupabaseAuthGuard` weryfikuje token i buduje kontekst użytkownika; `RolesGuard` ogranicza dostęp do ról `editor`/`owner`.
3. `CustomersController.putCustomer` (nowa metoda) przyjmuje `CustomerIdParamDto` oraz `UpdateCustomerDto`; globalny `ValidationPipe` dokonuje transformacji i walidacji.
4. Kontroler przekazuje `customerId`, skomponowany `UpdateCustomerCommand` oraz `CustomerMutatorContext` do `CustomersMutationService.update` (lub rozszerzonego `CustomersService`).
5. Serwis:
   - Ponownie weryfikuje uprawnienia (`if viewer ⇒ ForbiddenException`).
   - Pobiera obecny rekord poprzez `CustomersRepository.findById(customerId, { includeDeleted: true })`.
   - Rzuca `NotFoundException`, jeśli rekord nie istnieje albo jest soft-delete i użytkownik nie ma uprawnień do jego reaktywacji.
   - Normalizuje dane (`trim`, `toLower` do porównań) i wykonuje reguły spójności (`isActive`/`deletedAt`).
   - Sprawdza kolizję nazwy (zapytanie do repozytorium z filtrem `lower(name)` wśród aktywnych, z wyłączeniem bieżącego ID); mapuje wykryty konflikt na wyjątek.
   - W transakcji Supabase aktualizuje rekord (`update ... select()`) oraz odczytuje zaktualizowane dane.
   - Deleguje do `CustomerMapper.toDto` w celu mapowania kolumn Postgrest → DTO.
   - Asynchronicznie emituje telemetrię (`customer.updated`) i loguje operację na poziomie debug (bez pełnych danych).
6. Kontroler zwraca DTO do klienta z kodem `200`.

## 5. Względy bezpieczeństwa
- **Uwierzytelnienie**: obowiązkowe JWT Supabase, dokumentowane `@ApiBearerAuth`.
- **Autoryzacja**: `RolesGuard` + sprawdzenie w serwisie, aby tylko `editor`/`owner` mogli wywołać operację; `viewer` otrzymuje `403`.
- **RLS**: Supabase polityki wymuszają, że tylko uprawnione role mogą modyfikować klientów; zapewnia dodatkowe zabezpieczenie przy bezpośrednich zapytaniach.
- **Walidacja i sanitizacja**: `class-validator` blokuje wstrzyknięcia, `trim` i `escape` w polach tekstowych chronią przed XSS; ewentualne użycie helpera `sanitizeText`.
- **Audyt**: triggery DB zapisują zmiany do `audit_log`; serwis powinien przekazywać `actorId` (np. w nagłówku `Authorization` → kontekst Supabase) aby audyt był kompletny.
- **Logowanie**: korzystać z `Logger` (maskowanie identyfikujących danych); powiązać logi z `requestId` z interceptora MDC jeśli wdrożony.
- **Rate limiting / CORS**: endpoint objęty globalnym throttlingiem i CORS zgodnie z polityką projektu.

## 6. Obsługa błędów
- `400 Bad Request` – nieprawidłowe dane wejściowe (walidacja DTO, konflikt `isActive`/`deletedAt`, pusta nazwa, zbyt długi string, `deletedAt` bez `isActive=false`).
- `401 Unauthorized` – brak lub nieważny token (obsługiwane przez guardy).
- `403 Forbidden` – użytkownik z rolą `viewer` lub brak uprawnień wynikający z polityk RLS.
- `404 Not Found` – rekord nie istnieje lub jest soft-delete, a aktor nie ma uprawnień do reaktywacji; także gdy wskazany `customerId` nie znajduje się w schemacie tenant.
- `500 Internal Server Error` – błędy Supabase/PostgREST, problemy transakcji, niespodziewane wyjątki; logować `Logger.error` z kontekstem `requestId` i mapować na `{ code: 'CUSTOMERS_UPDATE_FAILED', message }`.
- Błędy duplikatu nazwy mapować na `400` z kodem biznesowym (`CUSTOMERS_NAME_TAKEN`); rozważyć `409` w przyszłości, ale utrzymać zgodność z obecnymi zasadami.
- Rejestrowanie błędów: brak dedykowanej tabeli – korzystać z globalnego loggera, ewentualnej integracji telemetrycznej (np. Sentry) konfigurując poziom `error`.

## 7. Wydajność
- Pojedyncze żądanie update; repozytorium powinno wykonywać maksymalnie dwa zapytania (select bieżący rekord + update z `returning`).
- Indeks `customers_lower_name_idx` przyspiesza kontrolę unikalności; `customers_soft_delete_idx` wspiera filtrowanie aktywnych rekordów.
- Zapewnienie, że `count='exact'` nie jest używane w tym przepływie, aby zminimalizować koszt.
- Asynchroniczne logowanie/telemetria (np. `void telemetryService.emit(...)`) aby nie blokować czasu odpowiedzi.
- Monitorować retry logic Supabase – w przypadku błędów transient można zastosować ograniczony retry (np. 1 próbę z backoffem) na poziomie serwisu.

## 8. Kroki implementacji
1. **DTO**: utworzyć `UpdateCustomerDto` (body) oraz `CustomerIdParamDto` (param) w `apps/api/src/app/customers/dto/`, dodając dekoratory `class-validator`, transformacje (trim, optional -> undefined) i metadane Swagger (`@ApiProperty`, `@ApiParam`).
2. **Mapper**: zaimplementować lub rozszerzyć `CustomerMapper` (`apps/api/src/app/customers/customer.mapper.ts`) konwertujący `Tables<'customers'>` na `CustomerDto` z aliasami pól (`created_at` → `createdAt`).
3. **Repository**: dodać metody `findById` i `update` w `CustomersRepository` (`apps/api/src/app/customers/customers.repository.ts`) wykorzystujące Supabase client (`.from('customers')`).
4. **Serwis**: rozbudować `CustomersMutationService` (`customers.service.ts`) o metodę `update(customerId: string, command: UpdateCustomerCommand, context: CustomerMutatorContext)`, zawierającą walidacje biznesowe, kontrolę unikalności i mapowanie błędów Supabase.
5. **Kontroler**: dodać handler `@Put(':customerId')` w `CustomersController` (`apps/api/src/app/customers/customers.controller.ts`) z guardami (`@UseGuards(SupabaseAuthGuard, RolesGuard)`), dekoratorami Swagger (`@ApiOperation`, `@ApiOkResponse`, `@ApiBadRequestResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse`).
6. **Autoryzacja**: zaktualizować `Roles` decorator/guard, aby wymagał ról `editor` lub `owner`; upewnić się, że moduł wstrzykuje `SupabaseService` oraz `CustomersRepository`.
7. **Logowanie i telemetry**: wstrzyknąć `Logger` oraz ewentualny `TelemetryService`, dodając logi na poziomie `debug` i emisję zdarzenia `customer.updated` (fire-and-forget).

