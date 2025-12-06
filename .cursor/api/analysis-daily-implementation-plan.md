# API Endpoint Implementation Plan: GET /analytics/daily

## 1. Przegląd punktu końcowego
- Zapewnia dzienny rozkład wartości sprzedaży (suma `total_net_pln` oraz liczba zamówień) dla wskazanego miesiąca.
- Wspiera filtrowanie po konkretnym kliencie oraz ogranicza zakres danych do tenantów dostępnych dla zalogowanego użytkownika.
- Zwraca dane gotowe do wizualizacji na dashboardzie trendów w aplikacji web (Angular 20).

## 2. Szczegóły żądania
- **Metoda HTTP:** `GET`
- **URL:** `/analytics/daily`
- **Parametry zapytania:**
  | Nazwa | Typ | Wymagane | Walidacja | Opis |
  | --- | --- | --- | --- | --- |
  | `year` | number | tak | `@IsInt()`, `@Min(2000)`, `@Max(currentYear)` | Rok referencyjny; ograniczony do danych historycznych. |
  | `month` | number | tak | `@IsInt()`, `@Min(1)`, `@Max(12)` | Miesiąc (1-12). |
  | `customerId` | string (UUID) | nie | `@IsUUID()` | Filtr po kliencie; domyślnie zasięg to lista klientów przypisana do użytkownika. |
- **Brak ciała żądania.**
- **DTO walidacyjne:** `GetDailyOrdersAnalyticsQueryDto` (extends `PaginationlessQueryDto` jeśli istnieje).
- **Command model przekazywany do serwisu:** `GetDailyOrdersAnalyticsCommand` z polami `{ year, month, customerId?, customerScope[] }`, gdzie `customerScope` pochodzi z `Request.currentUser`.
- **Walidacja dodatkowa:**
  - Blokowanie zakresów przyszłych (miesiąc+rok > aktualnej daty) – zwracamy `400`.
  - Weryfikacja, że `customerId` należy do listy klientów przypisanych użytkownikowi; inaczej `403`.
  - Przeliczenie zakresu dat (`monthStart`, `monthEnd`) w strefie UTC, zachowując typ `date` zgodny z kolumną `order_date`.

## 3. Szczegóły odpowiedzi
- **Status sukcesu:** `200 OK`.
- **Body:** tablica obiektów `DailyOrdersAnalyticsItemDto`:
  ```json
  {
    "date": "2024-05-12",
    "sumNetPln": 125000.45,
    "ordersCount": 7
  }
  ```
- **Reprezentacja pustego zakresu:** `[]`.
- **DTO odpowiedzi:** `DailyOrdersAnalyticsItemDto` + wrapper `DailyOrdersAnalyticsResponseDto = DailyOrdersAnalyticsItemDto[]`.
- **Serializacja liczb:** format `string` lub `number` zgodny z aktualnym kontraktem API (preferowany `string` jeśli w projekcie wszędzie serializujemy DECIMAL jako string; w przeciwnym razie `number` z dwoma miejscami po przecinku).

## 4. Przepływ danych
1. **Router / Controller (`AnalyticsController`)**
   - Dekoratory `@Get('daily')`, `@ApiQuery` dla wszystkich parametrów.
   - `ValidationPipe` z `transform: true` mapuje query do `GetDailyOrdersAnalyticsQueryDto`.
2. **Guardy i kontekst bezpieczeństwa**
   - `JwtAuthGuard` + ewentualny `RolesGuard` ustawiają `request.currentUser`.
   - `RequestContextService` pobiera `currentUser.customerIds`, wykonując zapytanie Supabase (z tokenem użytkownika) do tabeli `customers`, dzięki czemu RLS ogranicza zakres widocznych tenantów.
   - Wyciągamy `customerScope` (lista UUID) z `currentUser`.
3. **Service (`AnalyticsOrdersService`)**
   - Metoda `getDailyBreakdown(command: GetDailyOrdersAnalyticsCommand): Promise<DailyOrdersAnalyticsItemDto[]>`.
   - Oblicza `monthStart` (`DateTime.utc(year, month, 1)`) i `monthEnd` (`monthStart.plus({ months: 1 }).minus({ days: 1 })`).
   - Buduje zapytanie do tabeli `orders`:
     - `WHERE order_date BETWEEN :monthStart AND :monthEnd`.
     - `AND deleted_at IS NULL`.
     - `AND customer_id IN (:customerScope)` – jeśli przekazano `customerId`, ogranicza dodatkowo do jednego klienta.
     - `GROUP BY order_date`.
     - `SELECT order_date::date AS date, SUM(total_net_pln) AS sum_net_pln, COUNT(*) AS orders_count`.
   - Uzupełnia brakujące dni (opcjonalnie) poprzez mapowanie kalendarza miesiąca.
4. **Repozytorium / DataSource**
   - Wykorzystuje Supabase klienta albo query buildera (np. Knex/TypeORM) zgodnie z istniejącą warstwą.
   - Parametryzowane zapytania zapobiegają SQL injection.
5. **Mapper / Presenter**
   - Konwertuje wynik `sum_net_pln` do liczby z dwoma miejscami lub stringa.
   - Sortuje rosnąco po `date`.
6. **Controller Response**
   - `return dailyBreakdown;` – NestJS serializuje DTO do JSON.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie:** Wymagany `JwtAuthGuard`; brak tokenu → `401`.
- **Autoryzacja tenantowa:** Weryfikacja, że żądany `customerId` mieści się w `currentUser.customerIds`; w przeciwnym razie `403`.
- **Walidacja danych wejściowych:** `class-validator` + `ValidationPipe` z `whitelist` i `forbidNonWhitelisted`.
- **Ochrona przed enumeracją danych:** nawet bez `customerId` ograniczamy wynik do klientów przypisanych użytkownikowi.
- **Rate limiting / Throttling:** Reużycie globalnego `ThrottlerGuard` (jeśli skonfigurowany) – zapewnia ochronę przed masowym pobieraniem danych.
- **Audyt i logi:** użycie `Logger` do logowania prób nadużyć (np. nieuprawniony `customerId`).
- **Komunikacja:** endpoint dostępny wyłącznie przez HTTPS, zgodnie z globalną konfiguracją.

## 6. Obsługa błędów
- **400 Bad Request**
  - Nieprawidłowy `year`/`month` (format, zakres, data przyszła).
  - Nieprawidłowy `customerId` (nie-UUID).
  - Implementacja: rzucenie `BadRequestException` z kodem błędu `ANALYTICS_INVALID_RANGE`.
- **401 Unauthorized**
  - Brak/niepoprawny token JWT. Obsługiwane przez `JwtAuthGuard`.
- **403 Forbidden**
  - `customerId` spoza zakresu użytkownika.
  - Brak przypisanych klientów w kontekście użytkownika.
- **404 Not Found**
  - Nieużywany – brak danych zwracamy jako pustą tablicę (spełnia wymagania dashboardu).
- **500 Internal Server Error**
  - Błędy bazy danych lub niespodziewane wyjątki.
  - Obsługa: `try/catch` w serwisie, logowanie przy pomocy `AppLogger` oraz zapis rekordu w tabeli błędów (np. `system_errors`) zawierającego `endpoint`, `payload`, `userId`, `correlationId`.
- Wszystkie wyjątki mapowane przez globalny `HttpExceptionFilter`, zapewniający spójny format odpowiedzi.

## 7. Wydajność
- **Optymalne zapytanie:** użycie agregacji po `order_date` z selektywnymi predykatami (`customer_id`, `deleted_at IS NULL`).
- **Indeksy:** upewnić się, że istnieje indeks złożony `(order_date, customer_id, deleted_at)`; jeśli brak – wnioskujemy migrację.
- **Limit zakresu:** maksymalnie jeden miesiąc na zapytanie – chroni przed skanami pełnej tabeli.
- **Cache aplikacyjny:** rozważyć `InMemoryCache`/Redis dla często odpytywanych miesięcy (opcjonalne po zmierzeniu potrzeb).
- **Strumieniowanie danych:** wynik mały (max 31 rekordów), więc nie potrzeba stronicowania.
- **Obsługa równoległa:** endpoint jest tylko do odczytu – zapewnić `READ COMMITTED` (domyślnie) i brak blokad poprzez unikanie `FOR UPDATE`.

## 8. Kroki implementacji (status 2025-12-05)
1. ✅ **Analiza modułu** – struktura `analytics` przygotowana, nowe pliki umieszczone w `apps/api/src/app/analytics`.
2. ✅ **Definicja DTO** – `GetDailyOrdersAnalyticsQueryDto` oraz `DailyOrdersAnalyticsItemDto` dostępne w `apps/api/src/app/analytics/dto`.
3. ✅ **Aktualizacja modułu** – `AnalyticsModule` rejestruje `AnalyticsOrdersService` oraz istniejące zależności.
4. ✅ **Implementacja serwisu** – `AnalyticsOrdersService.getDailyBreakdown` waliduje zakres, zaciąga scope i obsługuje błędy.
5. ✅ **Warstwa danych** – `AnalyticsRepository.fetchDailyBreakdown` agreguje dane dzienne i wspiera `customerScope`.
6. ✅ **Controller** – endpoint `GET /analytics/daily` z pełną dokumentacją Swagger.
7. ✅ **Obsługa błędów/logowanie** – serwis loguje niepowodzenia i zwraca spójne kody (`ANALYTICS_DAILY_*`).
8. ✅ **Testy jednostkowe** – dodano testy dla serwisu i repozytorium (`vitest`), pokrywające zakresy, scope i błędy.
9. ✅ **Integracja Swagger/dokumentacja** – kontroler i plan wdrożenia odzwierciedlają aktualny kontrakt.
10. ✅ **Checklist wdrożeniowy** – lint/test (`vitest`) wykonane; e2e świadomie pominięte na tym etapie zgodnie z ustaleniami.

