# Plan wdrożenia endpointu API: GET /orders

## 1. Przegląd punktu końcowego
- Endpoint udostępnia paginowaną listę zamówień na podstawie tabeli `orders`, wzbogaconą danymi o kontrahencie i autorze rekordu.
- Obsługuje filtrowanie po numerze zamówienia, kontrahencie i przedziale dat zgodnie z wymaganiami biznesowymi.
- Pozwala na kontrolowane sortowanie i w razie potrzeby zwraca miękko usunięte rekordy dla ról o podwyższonych uprawnieniach.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Ścieżka: `/api/orders`
- Nagłówki: `Authorization: Bearer <jwt>`, `Accept: application/json`
- Parametry zapytania:
  - Wymagane: brak (domyślnie `page=1`, `limit=25`)
  - Opcjonalne: `page`, `limit`, `customerId`, `orderNo`, `dateFrom`, `dateTo`, `sort`, `includeDeleted`
- Walidacja i transformacje (klasa `ListOrdersQueryDto` w `apps/api/src/app/orders/dto`):
  - `page`, `limit` → `@IsInt()`, `@Min(1)`, dodatkowo `@Max(100)` dla `limit`
  - `customerId` → `@IsUUID()`
  - `orderNo` → `@IsString()`, `@MaxLength(64)`, `@Transform` (trim, lower-case)
  - `dateFrom`, `dateTo` → `@IsDateString()` z kontrolą zakresu (`dateFrom <= dateTo`)
  - `sort` → walidacja względem białej listy pól (`orderDate`, `orderNo`, `customerName`, `totalNetPln`, `createdAt`) i kierunków (`asc|desc`)
  - Kontrola roli (`viewer` → blokada `includeDeleted`) w serwisie przed wywołaniem repozytorium
- Modele wejściowe: `ListOrdersQuery` (warstwa współdzielona) → `ListOrdersQueryDto`; brak Command modeli (endpoint tylko odczytu).

## 3. Szczegóły odpowiedzi
- Sukces: `200 OK`
- Format: `application/json`
- Struktura: `ListOrdersResponse` (`items`, `total`, `page`, `limit`)
- Element `items[]`: `OrderListItemDto` zawierający pola z `orders` (kwoty, daty, flagi) oraz relacje `customer: Pick<CustomerDto, "id" | "name">`, `createdBy: UserSummaryDto`
- Nagłówki: `Cache-Control: no-store`, `Content-Type: application/json`

## 4. Przepływ danych
1. Klient wywołuje `GET /api/v1/orders` z parametrami zapytania i nagłówkiem `Authorization`.
2. `SupabaseAuthGuard` oraz `RolesGuard` weryfikują token i role użytkownika, przekazując `RequestUser` do kontekstu.
3. `OrdersController.listOrders` przyjmuje `ListOrdersQueryDto` (globalny `ValidationPipe` z `transform` i `whitelist`).
4. Kontroler deleguje do `OrdersQueryService.list`, przekazując DTO oraz kontekst użytkownika.
5. Serwis:
   - Ujednolica sortowanie, paginację i flagi, sprawdza uprawnienia do `includeDeleted`.
   - Buduje parametry repozytorium, uwzględniając RLS (np. dozwolone `includeDeleted`).
   - Wywołuje `OrdersRepository.list`, które korzysta z Supabase/PostgREST do pobrania rekordów (JOIN z `customers`, `users`).
6. Repozytorium zwraca listę pozycji i `totalCount`; serwis mapuje wynik na `OrderListItemDto`, emituje telemetryczne zdarzenie `order.listed` i zwraca `ListOrdersResponse` do kontrolera.
7. Kontroler odsyła odpowiedź klientowi.

## 5. Względy bezpieczeństwa
- Wymagane uwierzytelnianie JWT (Supabase) i autoryzacja ról zgodnie z RLS.
- `includeDeleted` dostępne tylko dla ról `editor` i `owner`; naruszenie skutkuje `403 Forbidden`.
- Walidacja i whitelisting sortowania zapobiegają SQL injection i nadużyciom.
- Zapytania do Supabase są parametryzowane; brak bezpośredniej interpolacji parametrów.
- Logowanie (`Logger`) z korelacją `requestId`, bez ujawniania wrażliwych danych (maskowanie numerów zamówień).
- Wymuszone `HTTPS` i odpowiednia konfiguracja CORS zgodna z wytycznymi NestJS.

## 6. Obsługa błędów
- `400 Bad Request`: błędne parametry (np. `limit > 100`, `dateFrom > dateTo`, nieobsługiwane pole sortowania); zwracany obiekt `{ code, message, details }`.
- `401 Unauthorized`: brak lub nieprawidłowy token; obsługiwane przez guard i globalny filtr wyjątków.
- `403 Forbidden`: użytkownik o roli `viewer` próbuje użyć `includeDeleted` lub Supabase RLS odrzuca zapytanie.
- `404 Not Found`: nie dotyczy (lista przy braku wyników zwraca pustą kolekcję) — odnotować w dokumentacji.
- `500 Internal Server Error`: błędy Supabase/nieprzewidziane wyjątki; logowane z `Logger.error`, odpowiedź bez szczegółów bazy.

## 7. Wydajność
- Obowiązkowa paginacja i limit 100 minimalizują obciążenie bazy.
- Wykorzystanie indeksów (`orders_customer_idx`, `orders_order_date_idx`, `orders_lower_order_no_idx`) optymalizuje filtry i sortowanie.
- Jedno zapytanie z `JOIN` redukuje problem N+1.
- Telemetria/logowanie wykonywane asynchronicznie (np. `setImmediate` lub dedykowany serwis) by nie blokować odpowiedzi.
- Globalny `ThrottlerGuard` (np. 100 req/min) zapobiega nadużyciom.

## 8. Kroki implementacji
1. Utworzyć `ListOrdersQueryDto` w `apps/api/src/app/orders/dto/list-orders-query.dto.ts` z dekoratorami `class-validator` i transformacjami (białe listy sortowania, limit 100, kontrola zakresów dat).
2. Rozszerzyć `OrdersModule` o `OrdersQueryService`, wstrzykując zależności (`OrdersRepository`, `TelemetryService`, `Logger`).
3. Zaimplementować `OrdersRepository.list` (Supabase client) z obsługą filtrów, `includeDeleted`, paginacji (`range`), `order` i `count=exact`.
4. Dodać `OrdersQueryService.list` wykonujący kontrolę ról, budowę parametrów repozytorium, mapowanie wyników na `OrderListItemDto`, emisję telemetry.
5. Rozbudować `OrdersController` o trasę `@Get('/orders')` z dekoratorami Swagger (`@ApiOperation`, `@ApiQuery`, `@ApiOkResponse`) i wstrzykniętym serwisem.
6. Przygotować mapper (`OrderMapper`) konwertujący rekord Supabase do `OrderListItemDto` (`customer`, `createdBy`, pola walutowe).
7. Dodać testy jednostkowe DTO (walidacja), serwisu (scenariusze ról, filtry, sort), repozytorium (mock Supabase) oraz test e2e pokrywający role i `includeDeleted`.
8. Uzupełnić logowanie (`Logger.log/error`) i integrację telemetryczną; zapewnić maskowanie danych w logach.
9. Zaktualizować dokumentację Swagger i `.cursor/api-plan.md` w razie zmian parametrów; uzgodnić z zespołem QA scenariusze regresyjne.
