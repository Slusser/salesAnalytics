# API Endpoint Implementation Plan: GET /customers

## 1. Przegląd punktu końcowego
- Endpoint udostępnia paginowaną listę klientów z tabeli `customers`, respektując logikę soft-delete (`deleted_at`) i flagę aktywności.
- Służy jako źródło danych dla widoku listy kontrahentów w aplikacji webowej, wspierając wyszukiwanie tekstowe i filtr `includeInactive`.
- Dostępny dla ról `viewer`, `editor`, `owner`; poszerzone uprawnienia (np. widoczność nieaktywnych) ograniczone do `editor`/`owner`.
- Realizowany w module `CustomersModule` po stronie NestJS z wykorzystaniem klienta Supabase oraz współdzielonych DTO.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/customers`
- Nagłówki: `Authorization: Bearer <jwt>`, `Accept: application/json`
- Parametry:
  - Wymagane: brak (domyślne `page=1`, `limit=25`, `includeInactive=false`)
  - Opcjonalne:
    - `page: number` – `@IsInt()`, `@Min(1)`, domyślnie `1`
    - `limit: number` – `@IsInt()`, `@Min(1)`, `@Max(100)`, domyślnie `25`
    - `search: string` – `@IsString()`, `@MaxLength(120)`, `@Transform` (trim, lower-case do porównań)
    - `includeInactive: boolean` – `@IsBoolean()`, domyślnie `false`; kontrola ról w serwisie (tylko `editor`/`owner`), mapping `true|false`/`1|0`
- Treść żądania: brak
- Walidacja/transformacja: `ListCustomersQueryDto` (`apps/api/src/app/customers/dto`), globalny `ValidationPipe` z `transform: true`, `whitelist: true`, `forbidNonWhitelisted: true`; sanitizacja ciągów przy użyciu `class-transformer`.

## 3. Wykorzystywane typy
- `ListCustomersQuery` oraz `ListCustomersResponse` z `apps/shared/dtos/customers.dto.ts` jako kontrakty pomiędzy backendem a frontendem.
- `CustomerDto` jako element listy oraz szczegół odpowiedzi.
- Nowy `ListCustomersQueryDto` (Nest) implementujący `ListCustomersQuery` z dekoratorami walidacji.
- `RequestUser`/`CustomerMutatorContext` (jeśli istnieje) do przekazania `actorId` i ról do serwisu zapytań.
- Ewentualny mapper `CustomerMapper` do konwersji rekordów Supabase (`Tables<'customers'>`) na `CustomerDto`.

## 3. Szczegóły odpowiedzi
- Kod sukcesu: `200 OK`
- Format: `application/json`
- Struktura (`ListCustomersResponse`):
  - `items: CustomerDto[]` – `id`, `name`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
  - `total: number` – dokładna liczba rekordów spełniających warunki
  - `page: number`, `limit: number` – echo parametrów paginacji
- Nagłówki: `Cache-Control: no-store`, `Content-Type: application/json`
- Mapowanie dat/typów: `timestamptz` na ISO string, `boolean` z Supabase bez konwersji; brak pól wewnętrznych (`deleted_at` tylko jako `deletedAt`).

## 4. Przepływ danych
1. Klient wywołuje `GET /api/v1/customers` z nagłówkiem `Authorization`.
2. `SupabaseAuthGuard` sprawdza JWT i osadza kontekst użytkownika (ID, role); `RolesGuard` dopuszcza `viewer` i wyżej.
3. `CustomersController.list` odbiera `ListCustomersQueryDto` dzięki globalnemu `ValidationPipe`.
4. Kontroler przekazuje DTO i kontekst do `CustomersQueryService.list`.
5. Serwis:
   - Weryfikuje uprawnienia do `includeInactive`; w razie braku – rzutuje `ForbiddenException`.
   - Normalizuje `search` (trim, lower-case) i składa parametry filtrowania/paginacji.
   - Wywołuje `CustomersRepository.list` (Supabase client) z `select` ograniczonym do wymaganych kolumn, `ilike` dla `search`, `range` dla paginacji, `count='exact'`.
6. Repozytorium zwraca rekordy i licznik; serwis mapuje dane na `CustomerDto[]`, dołącza metadane paginacji.
7. Serwis loguje (na poziomie debug/verbose) zakres zapytania, bez ujawniania pełnych nazw klientów, i zwraca wynik kontrolerowi.
8. Kontroler odsyła odpowiedź `200 OK`; opcjonalnie emitowany jest event telemetry `customer.listed`.

## 5. Względy bezpieczeństwa
- Obowiązkowe JWT (`@ApiBearerAuth`, `SupabaseAuthGuard`) oraz role weryfikowane przez `RolesGuard`.
- `includeInactive` dostępny wyłącznie dla ról `editor` i `owner`; `viewer` widzi tylko aktywnych (`deleted_at IS NULL AND is_active=true`).
- RLS w Supabase zabezpiecza przed dostępem do danych innych tenantów oraz soft-delete tam, gdzie rola na to nie zezwala.
- Walidacja i whitelisting pól zapobiegają nadużyciom (np. duże `limit`, nieprawidłowe typy).
- Logowanie (`Logger`) bez danych wrażliwych; korelacja żądań przez `requestId`.
- Konfiguracja CORS/HTTPS zgodnie z polityką projektu; rate limiting guard globalnie (np. `ThrottlerGuard`).

## 6. Obsługa błędów
- `400 Bad Request`: nieprawidłowe parametry (`page<1`, `limit>100`, błędny typ boolean, `search` zbyt długie); komunikat `{ code: 'CUSTOMERS_LIST_VALIDATION', message, details }`.
- `401 Unauthorized`: brak/nieważny token – obsługiwane przez guard.
- `403 Forbidden`: próba `includeInactive=true` przez rolę `viewer` lub odrzucenie przez RLS; mapować na `{ code: 'FORBIDDEN', ... }`.
- `404 Not Found`: nie dotyczy listy (pusta lista przy braku wyników); dokumentacja powinna to podkreślić.
- `500 Internal Server Error`: błędy Supabase lub niespodziewane wyjątki; logować przez `Logger.error` wraz z `requestId`, zwracać `{ code: 'CUSTOMERS_LIST_FAILED', message }`.
- Brak dedykowanej tabeli błędów – wykorzystać standardowe logowanie NestJS oraz integrację telemetryczną (np. Sentry) jeśli skonfigurowana.

## 7. Rozważania dotyczące wydajności
- Wymuszona paginacja i limit ≤100 ograniczają obciążenie.
- Wykorzystanie indeksów `customers_lower_name_idx` (wyszukiwanie) oraz `customers_soft_delete_idx` (filtr aktywnych).
- Supabase `count='exact'` może być kosztowny przy dużej liczbie rekordów; rozważyć cache wyników `total` lub `estimated` w przyszłości.
- Eliminacja N+1 – wszystkie dane pochodzą z jednej tabeli, brak dodatkowych zapytań.
- Telemetria i logowanie uruchamiane asynchronicznie (np. `setImmediate`) aby nie blokować odpowiedzi.

## 8. Etapy wdrożenia
1. Utworzyć `ListCustomersQueryDto` w `apps/api/src/app/customers/dto/list-customers-query.dto.ts` z dekoratorami `class-validator` i transformacjami (trim, boolean parsing).
2. Zaktualizować `CustomersModule` tak, aby udostępniał `CustomersQueryService` oraz wstrzykiwał repozytorium/klienta Supabase.
3. Dodać/rozszerzyć `CustomersRepository` o metodę `list(params, actorContext)` obsługującą filtry, `includeInactive`, paginację i `count`.
4. Zaimplementować `CustomersQueryService.list`, który kontroluje role, mapuje parametry na zapytanie repozytorium, transformuje wynik do `ListCustomersResponse` i obsługuje wyjątki.
5. Rozbudować `CustomersController` (`apps/api/src/app/customers/customers.controller.ts`) o handler `@Get()` z dekoratorami Swagger (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`, `@ApiQuery`) oraz integracją guardów.
6. Dodać mapper (`CustomerMapper.toDto`) w module lub bibliotece współdzielonej, zapewniający transformację pól i gwarancję zgodności typów.
7. Zaimplementować logowanie (`Logger`) i ewentualną telemetrię (`customer.listed`) z maskowaniem danych wrażliwych.
9. Zaktualizować dokumentację Swagger oraz `.cursor/api-plan.md` (jeśli zmiany parametrów).
