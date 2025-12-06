# API Endpoint Implementation Plan: GET /analytics/kpi

## 1. Przegląd punktu końcowego
- Cel: zwrócenie zagregowanych KPI sprzedażowych (`sumNetPln`, `ordersCount`, `avgOrderValue`) dla zadanego zakresu dat oraz, opcjonalnie, pojedynczego klienta.
- Kontekst: wykorzystywane na dashboardzie analitycznym do szybkiej oceny wolumenu sprzedaży.
- Moduł: `AnalyticsModule` (nowy) lub rozszerzony `OrdersModule` — preferowany dedykowany moduł dla czytelności i separacji odpowiedzialności.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- URL: `/analytics/kpi`
- Parametry zapytania:
  - **Wymagane**:  
    - `dateFrom` (`string` w formacie ISO-8601, interpretowany jako `Date`) — dolna granica `order_date`.  
    - `dateTo` (`string` w formacie ISO-8601) — górna granica włącznie.
  - **Opcjonalne**:  
    - `customerId` (`uuid`) — filtr po kliencie, dozwolony tylko, gdy użytkownik ma dostęp do tego klienta.
- Reguły walidacji:
  - `dateFrom <= dateTo`, maksymalny zakres np. `366` dni (konfigurowalny).
  - Format ISO sprawdzany przez `@IsISO8601`, konwersja przez `@Type(() => Date)`.
  - `customerId` walidowane przez `@IsUUID(4)` oraz guard domenowy (np. `CustomerAccessGuard`).
- Brak body; parametry tylko w query string.

## 3. Wykorzystywane typy
- `GetKpiAnalyticsQueryDto` (controller): pola `dateFrom`, `dateTo`, `customerId`; dekoratory `class-validator`.
- `AnalyticsKpiQuery` (command model w warstwie serwisu): daty jako `Date`, `customerId?: string`, `requester: CustomerMutatorContext`.
- `AnalyticsKpiResult` (typ serwisowy) z właściwościami `sumNetPln: number`, `ordersCount: number`, `avgOrderValue: number`.
- `AnalyticsKpiResponseDto` (mapper controller) — zwraca liczby w formacie JSON (`avgOrderValue` zaokrąglone do 2 miejsc).
- Ewentualny `AnalyticsRepository` z metodą `fetchKpiAggregates(query: AnalyticsKpiQuery): Promise<RawAggregateRow>`.

## 4. Szczegóły odpowiedzi
- Kod sukcesu: `200 OK`.
- Body:
  ```json
  {
    "sumNetPln": 0.0,
    "ordersCount": 0,
    "avgOrderValue": 0.0
  }
  ```
- Reguły formatowania:
  - `sumNetPln` i `avgOrderValue` jako liczby zmiennoprzecinkowe (precyzja 2) reprezentujące PLN.
  - `ordersCount` jako liczba całkowita.
  - `avgOrderValue = ordersCount > 0 ? sumNetPln / ordersCount : 0`.
- Nagłówki: standardowe `application/json; charset=utf-8`.

## 5. Przepływ danych
1. Klient wysyła `GET /analytics/kpi?dateFrom=...&dateTo=...&customerId=...`.
2. `AnalyticsController.getKpi()` (nowy endpoint) weryfikuje prawa dostępu (`JwtAuthGuard`, `RolesGuard`/`CustomerScopeGuard`) i aplikuje `ValidationPipe` z DTO.
3. Kontroler mapuje DTO → `AnalyticsKpiQuery` (konwersja typów, domyślne wartości, przypięcie `currentUser` z `CurrentUserRequest`).
4. `AnalyticsService.getKpiAggregates(query)` deleguje do repozytorium (`AnalyticsRepository` lub metoda w `OrdersRepository`), przekazując parametry filtra.
5. Repozytorium wykonuje zapytanie agregujące na tabeli `orders`:
   ```sql
   SELECT
     COALESCE(SUM(total_net_pln), 0) AS sum_net_pln,
     COUNT(*) AS orders_count
   FROM orders
   WHERE deleted_at IS NULL
     AND order_date BETWEEN :dateFrom AND :dateTo
     AND (:customerId IS NULL OR customer_id = :customerId)
   ```
   (możliwe rozszerzenie o `created_by` w zależności od uprawnień użytkownika).
6. Serwis wylicza `avgOrderValue`, mapuje wynik do DTO i odsyła kontrolerowi.
7. Kontroler zwraca `200 OK` z JSON.

## 6. Względy bezpieczeństwa
- **Uwierzytelnienie**: `JwtAuthGuard` obowiązkowy; endpoint dostępny wyłącznie po zalogowaniu.
- **Autoryzacja**: 
  - Domyślnie użytkownik widzi dane własnego klienta (`currentUser.customerId`). 
  - Role administracyjne mogą filtrować po dowolnym `customerId`; weryfikacja w guardzie lub serwisie (np. `AnalyticsAccessPolicy`).
- **Walidacja wejścia**: `ValidationPipe({ transform: true, whitelist: true })`.
- **Ochrona danych**: Filtr `deleted_at IS NULL`, ograniczenie do rekordów należących do użytkownika (np. `customer_id = currentUser.customerId` dla zwykłych użytkowników).
- **Logowanie bezpieczeństwa**: próby użycia niedozwolonego `customerId` rejestrowane w `SecurityLogger`/`AuditService`.
- **Brak danych wrażliwych**: endpoint zwraca tylko zagregowane kwoty, więc brak dodatkowego maskowania.

## 7. Obsługa błędów
- 400 Bad Request:
  - Brak `dateFrom`/`dateTo`.
  - Format daty niezgodny z ISO.
  - `dateFrom > dateTo` lub zakres > dozwolonego limitu.
  - Nieprawidłowy `customerId` (nie UUID lub brak uprawnień).
- 401 Unauthorized: brak/niepoprawny token.
- 403 Forbidden: użytkownik nie ma dostępu do wskazanego `customerId`.
- 404 Not Found: opcjonalnie, jeżeli walidujemy istnienie `customerId` w `customers`.
- 500 Internal Server Error: awarie repozytorium/DB. Przy takim błędzie logować w `ErrorLogsService`/`error_logs` z kontekstem (`path`, `userId`, payload, stack).
- Struktura odpowiedzi błędów zgodna z globalnym `HttpExceptionFilter` (kod, message, timestamp, path).

## 8. Wydajność
- Użycie pojedynczego zapytania agregującego z wykorzystaniem indeksów na `orders(order_date)` oraz `orders(customer_id, order_date)`.
- Opcjonalne cache (np. `@UseInterceptors(CacheInterceptor)` z kluczem `userId+dateRange`) dla dashboardu, TTL np. 60 s.
- Pagina niepotrzebna, ale ograniczenie zakresu dat zapobiega dużym skanom tabeli.
- Możliwość dodania materializowanego widoku KPI w przyszłości; plan powinien pozostawać kompatybilny (repo zwróci te same pola).

## 9. Kroki implementacji
1. **Moduł/struktura**: utwórz `apps/api/src/analytics` z `analytics.module.ts`, `analytics.controller.ts`, `analytics.service.ts`, `analytics.repository.ts`.
2. **DTO i walidacja**: dodaj `GetKpiAnalyticsQueryDto` w `analytics/dto`, użyj `@IsISO8601`, `@Validate(DataRangeValidator)`, `@IsUUID` z `@ValidateIf`.
3. **Command model + mapper**: zaimplementuj `AnalyticsKpiQuery` + funkcję mapującą z DTO (uwzględnij `currentUser`).
4. **Serwis**: w `AnalyticsService` dodaj `getKpiAggregates(query)`; oblicz `avgOrderValue`, obsłuż brak wyników.
5. **Repozytorium**: przygotuj zapytanie SQL (Supabase client lub knex/pg) agregujące, filtrujące `deleted_at IS NULL`; obsłuż parametry opcjonalne.
6. **Kontroler**: dodaj metodę `@Get('kpi')`, zastosuj `@UseGuards(JwtAuthGuard, RolesGuard)`, `@ApiQuery` dekoratory dla Swaggera, oraz `ValidationPipe`.
7. **Security/guards**: jeżeli brak, dodaj `CustomerScopeGuard` lub rozszerz istniejący guard, aby ograniczać `customerId`.
8. **Logowanie błędów**: w serwisie otocz repo try/catch, loguj w `ErrorLogsService` (lub `Logger`) z identyfikatorem zapytania; propaguj `InternalServerErrorException`.
9. **Testy**: 
   - Jednostkowe dla DTO (walidacje) oraz serwisu (wyliczenia, mapowanie).  
   - Integracyjne/e2e dla kontrolera (`supertest`) weryfikujące kody 200/400/403/500.
10. **Swagger**: dodaj `@ApiTags('Analytics')`, `@ApiOperation`, `@ApiResponse` (200, 400, 401, 403, 500).
11. **Nx konfiguracja**: zarejestruj nowy moduł w `app.module.ts`, zaktualizuj `tsconfig` ścieżki jeżeli potrzebne, dodaj targety `lint/test` dla aplikacji w Nx.
12. **Weryfikacja**: uruchom `nx lint api-analytics`, `nx test api-analytics`, e2e dla `api`; zdeployuj po pozytywnych testach.


