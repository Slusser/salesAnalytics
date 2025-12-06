# API Endpoint Implementation Plan: GET /analytics/trend

## 0. Status wdrożenia (2025-12-03)
- ✅ Endpoint zaimplementowany w `AnalyticsController.getTrend` z guardami (`JwtAuthGuard`, `RolesGuard`) oraz nagłówkiem `Cache-Control: no-store`.
- ✅ `AnalyticsService.getTrend` zawiera walidację domenową (limit 24 miesięcy, brak dat w przyszłości, kontrola ról `viewer`/`editor`/`owner`).
- ✅ `AnalyticsRepository.fetchMonthlyTrend` wspiera zarówno RPC `analytics_monthly_trend`, jak i fallback PostgREST (zagregowane po stronie aplikacji).
- ✅ Testy jednostkowe pokrywają główne ścieżki (`analytics.service.spec.ts`, `analytics.repository.spec.ts` – scenariusze RPC oraz fallback).
- ⏳ Testy e2e / kontraktowe pozostają do uzupełnienia (warto dodać po stabilizacji środowiska Supabase).

## 1. Przegląd punktu końcowego
- Cel: zwrócenie trendu sprzedaży (sumy `total_net_pln`) zagregowanego miesiąc do miesiąca w zadanym przedziale dat, opcjonalnie filtrowanego po kliencie.
- Istotne komponenty: nowy moduł `AnalyticsModule` z kontrolerem, serwisem i repozytorium opartym o `SupabaseClient`; wykorzystanie współdzielonych DTO z `apps/shared/dtos/analytics.dto.ts`.
- Kluczowe zasady: tylko uwierzytelnieni użytkownicy (`viewer`/`editor`/`owner`) mogą odczytywać dane; walidacja parametrów w kontrolerze, logika agregacji w serwisie/repozytorium, hermetyczne mapowanie odpowiedzi.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/analytics/trend`
- Wymagane nagłówki: `Authorization: Bearer <JWT>` (obsługiwane przez `JwtAuthGuard`)
- Parametry zapytania:

| Parametr    | Typ         | Wymagalność | Walidacja                                                                 | Opis                                                                                             |
|-------------|-------------|-------------|---------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `dateFrom`  | `YYYY-MM-DD`| wymagany    | `@IsDateString()`, `@MaxDate(today)`, custom validator `dateFrom <= dateTo`| Początek zakresu raportu (włącznie).                                                             |
| `dateTo`    | `YYYY-MM-DD`| wymagany    | `@IsDateString()`, `@MaxDate(today)`, limit długości zakresu (np. ≤ 24 mies.)| Koniec zakresu raportu (włącznie).                                                               |
| `customerId`| UUID        | opcjonalny  | `@IsUUID('4')`, `@ValidateIf(() => Boolean(customerId))`                  | Filtrowanie trendu do pojedynczego klienta; brak oznacza agregację globalną.                     |

- Request body: brak.
- DTO i modele:
  - `AnalyticsTrendQueryDto` (extends `AnalyticsRangeQuery` + dekoratory `class-validator`) – transport danych z query string.
  - `AnalyticsTrendCommand` – wewnętrzny model serwisu (`dateFrom: string`, `dateTo: string`, `customerId?: string`, `actorId`, `actorRoles`).
  - `AnalyticsTrendEntryDto` – odpowiedź pojedynczego okresu (już zdefiniowane w shared DTO).
  - `AnalyticsTrendResponseDto = AnalyticsTrendEntryDto[]` – alias odpowiedzi kontrolera (ew. wrapper `{ items: AnalyticsTrendEntryDto[] }` jeśli chcemy zachować spójność).

## 3. Szczegóły odpowiedzi
- Sukces `200 OK`: tablica posortowana rosnąco po `period` (format `YYYY-MM`).
  - Struktura elementu: `{ period: string; sumNetPln: number }`.
  - Przykład odpowiedzi z bieżącej implementacji (zakres 2024-01–2024-03, bez `customerId`):
    ```json
    [
      { "period": "2024-01", "sumNetPln": 45120.25 },
      { "period": "2024-02", "sumNetPln": 39870.00 },
      { "period": "2024-03", "sumNetPln": 42310.78 }
    ]
    ```
- Brak danych → zwracamy pustą tablicę (nadal `200`).
- Headery odpowiedzi: `Cache-Control: no-store` (dane wrażliwe), `Content-Type: application/json`.

## 4. Przepływ danych
1. Klient (web) wysyła `GET /analytics/trend?dateFrom=...&dateTo=...`.
2. `AnalyticsController.getTrend()`:
   - Oznaczony `@UseGuards(JwtAuthGuard, RolesGuard)` i `@Roles('viewer','editor','owner')`.
   - Używa `ValidationPipe` + `AnalyticsTrendQueryDto`.
   - Tworzy `AnalyticsTrendCommand` wzbogacony o `currentUser`.
3. `AnalyticsService.getTrend(command)`:
   - Waliduje domenowo (limit długości zakresu, `dateFrom <= dateTo`).
   - Tworzy instancję `SupabaseClient` przez `SupabaseFactory` (z tokenem użytkownika).
   - Deleguje do repozytorium z przekazaniem informacji o użytkowniku (na wypadek RLS).
4. `AnalyticsRepository.getTrend(client, params)`:
   - Buduje zapytanie do Supabase:
     ```sql
     select to_char(date_trunc('month', order_date), 'YYYY-MM') as period,
            coalesce(sum(total_net_pln), 0) as sum_net_pln
     from orders
     where deleted_at is null
       and order_date between :date_from and :date_to
       [and customer_id = :customer_id]
     group by 1
     order by 1;
     ```
   - Do wykonania może użyć `client.rpc('analytics_monthly_trend', {...})`; jeżeli RPC nie istnieje, tworzymy je w migracji Supabase lub używamy `.from('orders')` + `.select('*', { head: false })` z parametrem `group`.
   - Repozytorium loguje błędy (`Logger`), mapuje wynik do `AnalyticsTrendEntryDto`.
5. Serwis zwraca dane do kontrolera, który je bez zmian odsyła klientowi.
6. Wszelkie wyjątki są mapowane przez `HttpException` lub globalne filtry.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: wyłącznie żądania z ważnym JWT przechodzą `JwtAuthGuard`.
- **Autoryzacja**: `RolesGuard` przepuszcza tylko role `viewer`/`editor`/`owner`; role pobierane z `currentUser.actorRoles`.
- **RLS w Supabase**: korzystamy z klienta z tokenem użytkownika, aby obowiązywały istniejące polityki (`orders` powinny mieć RLS ograniczający klientów do swoich danych). Dla fallbacku można dodać tryb `serviceRole` tylko dla zapytań read-only, jeśli polityki pozwalają.
- **Walidacja wejścia**: daty i UUID walidowane w DTO + dodatkowe ograniczenie długości zakresu i `dateFrom <= dateTo`.
- **Ochrona przed nadużyciem**: throttle endpoint (np. `@Throttle(30, 60)` w module) oraz brak buforowania odpowiedzi.
- **Audyt/logowanie**: odczyty nie trafiają do `audit_log`, lecz każda awaria jest logowana przez `Logger` wraz z łączonym `requestId` (z `RequestContextService` lub nagłówka). Nie istnieje dedykowana tabela błędów, więc nie zapisujemy nic poza logami.

## 6. Obsługa błędów
| Scenariusz                                             | Kod | Strategia                                                                                                  |
|--------------------------------------------------------|-----|------------------------------------------------------------------------------------------------------------|
| Brak JWT / wygaśnięty token                           | 401 | `JwtAuthGuard` zwraca `UnauthorizedException` z komunikatem lokalizowanym.                                 |
| Brak wymaganej roli                                    | 403 | `RolesGuard` rzuca `ForbiddenException` (`ANALYTICS_TREND_FORBIDDEN`).                                     |
| Błędne parametry (`dateFrom`, `dateTo`, zakres zbyt długi)| 400 | `BadRequestException` z kodem `ANALYTICS_TREND_INVALID_RANGE`.                                            |
| Nieistniejący `customerId` (brak dostępu / nie w RLS)  | 404 | Opcjonalnie mapujemy pusty wynik na `200` (preferowane). Jeśli wymagana weryfikacja klienta – `NotFound`.  |
| Błąd Supabase / RPC                                    | 500 | Log w `AnalyticsRepository` (`logger.error(...)`) i rzutowanie `InternalServerErrorException`.             |

## 7. Wydajność
- Zakres dat ograniczony (np. max 24 miesiące) – zabezpieczamy się przed pełnym skanem tabeli.
- Indeksy: `orders(customer_id, order_date)` i `orders(order_date)` powinny istnieć – w razie potrzeby zadeklarować w migracji.
- Agregacja miesięczna korzysta z `date_trunc` + `group by` – Supabase wykona ją po stronie bazy bez pobierania pojedynczych rekordów.
- W kontrolerze unikamy ciężkich mapowań – strumieniowanie niepotrzebne (niewielki payload).
- Możliwe cache po stronie aplikacji (np. per user + zakres) poprzez `@CacheTTL`, lecz domyślnie wyłączamy, by nie ujawniać danych między tenantami.

## 8. Kroki implementacji (status)
1. [x] **DTO & walidacja**: `apps/api/src/app/analytics/dto/analytics-trend-query.dto.ts` (limit 24 mies., brak przyszłych dat).
2. [x] **Command & typy**: `AnalyticsTrendCommand` i `AnalyticsTrendResponseDto` w `apps/shared/dtos/analytics.dto.ts`.
3. [x] **Repository**: `AnalyticsRepository.fetchMonthlyTrend` + fallback PostgREST, testy w `analytics.repository.spec.ts`.
4. [x] **Service**: `AnalyticsService.getTrend` z walidacją domenową i obsługą błędów Supabase.
5. [x] **Controller**: `AnalyticsController.getTrend` + dekoratory Swagger i guardy.
6. [x] **Module wiring**: `AnalyticsModule` wpięty do `AppModule`.
7. [ ] **Supabase RPC (opcjonalnie)**: funkcja `analytics_monthly_trend` – w środowisku dev fallback działa, RPC do dodania w migracjach.
8. [x] **Testy jednostkowe**: `analytics.service.spec.ts`, `analytics.repository.spec.ts`.
9. [ ] **Test e2e / kontraktowy**: do uzupełnienia w `apps/api-e2e`.
10. [x] **Dokumentacja**: bieżący plik + przykładowa odpowiedź, Swagger opisany w kontrolerze.
11. [x] **Utrzymanie planu**: dokument zaktualizowany po wdrożeniu.


