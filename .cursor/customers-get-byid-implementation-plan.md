# API Endpoint Implementation Plan: GET /customers/{customerId}

## 1. Przegląd punktu końcowego
- Zwraca szczegółowy rekord klienta z tabeli `customers`, w tym status soft-delete, na potrzeby widoku detalu w aplikacji webowej.
- Obsługiwany w module NestJS `CustomersModule` z wykorzystaniem Supabase oraz współdzielonych DTO.
- Wspiera role `viewer`, `editor`, `owner`; rekordy usunięte miękko pozostają niewidoczne dla `viewer`.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/customers/{customerId}`.
- Nagłówki: `Authorization: Bearer <jwt>`, `Accept: application/json`.
- Parametry:
  - Wymagane: `customerId` (segment ścieżki, `uuid` v4).
  - Opcjonalne: brak.
- Walidacja wejścia: `CustomerIdParamDto` (`apps/api/src/app/customers/dto/customer-id-param.dto.ts`) z `@IsUUID('4')`, `@ApiParam`; globalny `ValidationPipe` (`transform`, `whitelist`, `forbidNonWhitelisted`).
- Wykorzystywane typy wejściowe i kontekstowe: `CustomerIdParamDto`, `CustomerMutatorContext` (rola i `actorId`), `Tables<'customers'>` jako typ repozytorium.

## 3. Szczegóły odpowiedzi
- Kod sukcesu: `200 OK` z payloadem `CustomerDetailResponse` (`apps/shared/dtos/customers.dto.ts`).
- Struktura: `id`, `name`, `isActive`, `createdAt`, `updatedAt`, `deletedAt` (mapowane z `customers`); format `application/json`.
- Konwersje typów: `timestamptz` → ISO 8601 string, wartości boolean i uuid bez zmian, numeric brak (nie dotyczy).
- Nagłówki: `Content-Type: application/json`, `Cache-Control: no-store`.
- Wykorzystywane typy wyjściowe: `CustomerDetailResponse`, `CustomerDto` (element struktury), ewentualny mapper `CustomerMapper` w module do konwersji rekordów Supabase → DTO.

## 4. Przepływ danych
1. Klient wysyła żądanie `GET` z tokenem Supabase.
2. `SupabaseAuthGuard` i `RolesGuard` weryfikują uwierzytelnienie oraz rolę (`viewer`+), osadzając kontekst użytkownika.
3. `CustomersController.getById` przyjmuje `CustomerIdParamDto`, loguje żądanie (poziom `debug`) bez pełnej nazwy klienta.
4. Kontroler deleguje do `CustomersQueryService.getById(customerId, actorContext)`.
5. Serwis ustala `includeDeleted` na podstawie roli (`viewer` → false), wywołuje `CustomersRepository.findById` (Supabase `.single()` z selekcją wymaganych kolumn).
6. Serwis weryfikuje soft-delete: jeśli `deletedAt` i aktor to `viewer`, rzuca `NotFoundException` dla maskowania rekordu.
7. Serwis mapuje wynik przez `CustomerMapper` na `CustomerDetailResponse`, opcjonalnie emituje telemetryczne `customer.viewed` asynchronicznie.
8. Kontroler zwraca DTO do klienta.

## 5. Względy bezpieczeństwa
- Obowiązkowe JWT (`@ApiBearerAuth`) i guardy Nest; brak dostępu anonimowego.
- Supabase RLS ogranicza rekordy do tenantów/organizacji oraz kontroluje widoczność soft-delete.
- Upewnić się, że logi nie zawierają pełnych nazw klientów lub danych identyfikujących; stosować `requestId` do korelacji.
- `viewer` otrzymuje `404` dla soft-delete, aby zapobiec enumeracji rekordów.
- Zapewnić, że DTO nie zwraca pól wewnętrznych ani danych wrażliwych; sanitizacja nagłówków i kontekstu.
- Globalny throttling (np. `ThrottlerGuard`) i HTTPS zgodnie z polityką projektu.

## 6. Obsługa błędów
- `400 Bad Request`: niepoprawny `customerId` – `ValidationPipe` rzuca `BadRequestException` (kod `CUSTOMERS_GET_BY_ID_VALIDATION`).
- `401 Unauthorized`: brak/nieważny token – `SupabaseAuthGuard`.
- `403 Forbidden`: ewentualne customowe ograniczenia ról (np. brak dostępu do danych historycznych) – mapowane przez guard lub serwis.
- `404 Not Found`: rekord nie istnieje lub jest soft-delete, a rola to `viewer`.
- `500 Internal Server Error`: błędy Supabase lub niespodziewane wyjątki; logować `Logger.error` z `requestId`, zwracać `{ code: 'CUSTOMERS_GET_BY_ID_FAILED', message }`.
- Rejestrowanie błędów: wykorzystać globalny logger NestJS oraz obecne mechanizmy telemetryczne; brak dedykowanej tabeli błędów w tym przepływie.

## 7. Wydajność
- Zapytanie jednostkowe korzysta z indeksu PK `customers_pkey`; ograniczyć projekcję do wymaganych kolumn.
- Unikać dodatkowych round-tripów; repozytorium wykonuje pojedyncze zapytanie `.single()`.
- Asynchroniczne logowanie/telemetria, aby nie blokować odpowiedzi.
- Monitorować opóźnienia Supabase; wdrożyć retry z backoff tylko dla błędów transient (np. status 503).

## 8. Kroki implementacji
1. Dodać `CustomerIdParamDto` z walidacją UUID i opisem Swagger w `apps/api/src/app/customers/dto/customer-id-param.dto.ts`.
2. Rozszerzyć lub utworzyć `CustomersRepository` z metodą `findById(customerId: string, options)` korzystającą z Supabase clienta (`.select(...).eq('id', customerId).maybeSingle()`), normalizującą błędy.
3. Zaimplementować `CustomersQueryService.getById`, który kontroluje dostęp do soft-delete, mapuje rekord i zgłasza wyjątki (`NotFoundException`, `ForbiddenException`).
4. Zaktualizować/utworzyć `CustomerMapper` (`customers.mapper.ts`) do konwersji rekordów Supabase → `CustomerDetailResponse` (ISO daty, aliasy pól).
5. Rozbudować `CustomersController` o handler `@Get(':customerId')`, wstrzykujący serwis, stosujący guardy i dekoratory Swagger (`@ApiOperation`, `@ApiOkResponse`, `@ApiNotFoundResponse`, `@ApiForbiddenResponse`).
6. Zapewnić logowanie (`Logger`) z maskowaniem danych i emisję telemetryczną (jeśli dostępna) w trybie asynchronicznym.
8. Uaktualnić dokumentację Swagger i `.cursor/api-plan.md`, jeśli parametry/odpowiedzi zostały rozszerzone.
