# Plan implementacji widoku Dashboard (Analityka)

## 1. Przegląd
Widok `/dashboard` udostępnia podstawowe KPI sprzedaży, miesięczny trend m/m oraz dzienny rozkład sprzedaży po wyborze konkretnego miesiąca. Obsługuje filtry po kontrahencie i zakresie dat, zapewnia manualne odświeżanie danych oraz spójne doświadczenie dla ról viewer/editor/owner zgodnie z PRD i user stories US-011–US-013.

## 2. Routing widoku
- Ścieżka: `/dashboard`
- Query parametry: `dateFrom`, `dateTo`, `customerId`, opcjonalnie `year`, `month` (deep-link dla dziennego widoku)
- Guard: wymaga ról `viewer|editor|owner` (już egzekwowane globalnie)

## 3. Struktura komponentów
```
DashboardPageComponent
├─ DashboardFilterBarComponent
├─ ManualRefreshButtonComponent
├─ KpiCardsComponent
├─ TrendBarChartComponent
└─ DailyBreakdownPanelComponent
   └─ EmptyStateComponent (warunkowo)
```

## 4. Szczegóły komponentów

### DashboardPageComponent
- Opis: kontener strony; zarządza stanem filtrów, aktywnego miesiąca, komunikacją z usługą `DashboardStoreService`, renderuje podkomponenty zgodnie z danymi.
- Główne elementy: `section` z nagłówkiem, obszar filtrów, siatka KPI, sekcje wykresów, komunikaty błędów.
- Obsługiwane interakcje: `onFiltersChange`, `onRefresh`, `onMonthSelect`, `onMonthClear`.
- Walidacja: blokuje żądania gdy `dateFrom > dateTo`, resetuje `activeMonth` przy zmianie zakresu, weryfikuje `month∈[1,12]`.
- Typy: `DashboardState`, `DashboardFilters`, `DashboardQueryParams`, `AnalyticsKpiResponseDto`, `AnalyticsTrendResponseDto`, `DailyOrdersAnalyticsItemDto`.
- Propsy: brak (komponent routingu), korzysta z usług DI.

### DashboardFilterBarComponent
- Opis: formularz filtrów (kontrahent, zakres dat rok/miesiąc); udostępnia debounced eventy.
- Główne elementy: `nz-select` dla kontrahenta, `nz-range-picker` (rok/miesiąc), przyciski `Zastosuj`, `Reset`.
- Obsługiwane interakcje: zmiana kontrahenta, zmiana zakresu dat (debounce 300 ms), reset filtrów, potwierdzenie.
- Walidacja: oba końce zakresu wymagane, `dateFrom <= dateTo`, domyślnie bieżący rok.
- Typy: `DashboardFilters`, `FilterFormValue`, `CustomerOption`.
- Propsy: `value: DashboardFilters`, `customerOptions: CustomerOption[]`, `isLoading: boolean`.

### ManualRefreshButtonComponent
- Opis: przycisk wymuszający ponowne pobranie danych niezależnie od cache; pokazuje timestamp ostatniego odświeżenia.
- Główne elementy: `button nz-button`, ikona odświeżania, label z czasem.
- Obsługiwane interakcje: `click -> emitRefresh`.
- Walidacja: blokada przy aktywnym `isRefreshing`.
- Typy: `ManualRefreshState`.
- Propsy: `lastRefreshedAt?: Date`, `isRefreshing: boolean`.

### KpiCardsComponent
- Opis: prezentuje trzy karty KPI (suma netto PLN, liczba zamówień, średnia wartość).
- Główne elementy: `nz-card` w układzie siatki, skeletony podczas ładowania.
- Obsługiwane interakcje: brak (read-only).
- Walidacja: wyświetla 0 przy pustych danych; formatowanie kwot do PLN przy 2 miejscach.
- Typy: `AnalyticsKpiResponseDto`, `KpiViewModel`.
- Propsy: `data?: KpiViewModel[]`, `isLoading: boolean`, `hasError: boolean`.

### TrendBarChartComponent
- Opis: wykres słupkowy ECharts m/m; umożliwia wybór miesiąca dla dziennego widoku bez zmiany routingu.
- Główne elementy: `ngx-echarts` lub wrapper, legenda, wskaźniki aktywnego miesiąca.
- Obsługiwane interakcje: `barClick -> emitMonthSelect({ year, month })`, `hover tooltips`, `clearSelection`.
- Walidacja: ignoruje kliknięcia gdy brak danych; weryfikuje, że `period` mapuje się na poprawną datę; brak nawigacji.
- Typy: `AnalyticsTrendEntryResponseDto`, `TrendPointViewModel`.
- Propsy: `data: TrendPointViewModel[]`, `isLoading: boolean`, `selectedMonth?: MonthSelection`.

### DailyBreakdownPanelComponent
- Opis: sekcja pokazująca dzienne `sumNetPln` i `ordersCount` dla wybranego miesiąca (wykres + lista); warunkowo renderuje `EmptyState`.
- Główne elementy: `nz-card`, `ngx-echarts` (line/bar), tabela z danymi dziennymi, przycisk „Wyczyść wybór”.
- Obsługiwane interakcje: `onClear`, `tooltip hover`, sortowanie tabeli.
- Walidacja: wywołuje API tylko gdy `selectedMonth` ustawiony; weryfikuje zgodność dat z zakresem; pokazuje empty state przy braku danych.
- Typy: `DailyOrdersAnalyticsItemDto`, `DailyPointViewModel`, `MonthSelection`.
- Propsy: `selectedMonth?: MonthSelection`, `data?: DailyPointViewModel[]`, `isLoading: boolean`, `hasError: boolean`.

### EmptyStateComponent
- Opis: uniwersalny komponent z ikoną i opisem dla braku danych/błędów miękkich.
- Główne elementy: ilustrowana karta, tekst, opcjonalny przycisk „Odśwież”.
- Obsługiwane interakcje: opcjonalny callback `onRetry`.
- Walidacja: brak.
- Typy: `EmptyStateConfig`.
- Propsy: `title: string`, `description: string`, `actionLabel?: string`, `onAction?: () => void`.

## 5. Typy
- `DashboardFilters`  
  ```ts
  type DashboardFilters = {
    dateFrom: string; // ISO YYYY-MM-DD (UTC midnight)
    dateTo: string;
    customerId?: string;
  };
  ```
- `DashboardQueryParams` – `Partial<DashboardFilters> & { year?: number; month?: number }`.
- `KpiViewModel` – `{ key: 'sumNet'|'ordersCount'|'avgOrder'; label: string; value: string; tooltip?: string; isPositive?: boolean; }`.
- `TrendPointViewModel` – `{ period: string; year: number; month: number; valuePln: number; formattedValue: string; isActive: boolean; }`.
- `MonthSelection` – `{ year: number; month: number; label: string; }`.
- `DailyPointViewModel` – `{ date: string; day: number; netPln: number; ordersCount: number; formattedNet: string; }`.
- `DashboardState` – `{ filters: DashboardFilters; kpi: DataState<AnalyticsKpiResponseDto>; trend: DataState<AnalyticsTrendEntryResponseDto[]>; daily: DataState<DailyOrdersAnalyticsItemDto[]>; activeMonth?: MonthSelection; lastRefreshedAt?: Date; }`.
- `DataState<T>` – `{ data?: T; isLoading: boolean; error?: string; }`.
- `ManualRefreshState` – `{ lastRefreshedAt?: Date; isRefreshing: boolean; ttlMs: number; }`.
- `EmptyStateConfig` – `{ title: string; description: string; actionLabel?: string; }`.
- Wykorzystanie istniejących DTO z backendu: `AnalyticsKpiResponseDto`, `AnalyticsTrendEntryResponseDto[]`, `DailyOrdersAnalyticsItemDto[]`.

## 6. Zarządzanie stanem
- `DashboardStoreService` (Angular service + signals/component store):
  - Przechowuje `DashboardState`.
  - Udostępnia metody `setFilters`, `refreshAll(force?: boolean)`, `selectMonth`, `clearMonth`.
  - Implementuje cache 60–120 s dla KPI i trendu (np. TTL = 90 s); trzyma timestamp `lastRefreshedAt`.
  - Zawiera `effect` reagujący na zmiany filtrów (z debounce 300 ms) i wywołujący `loadKpi` + `loadTrend`.
- Opcjonalny hook `useDashboardFilters` (funkcja/serwis) integrujący `ActivatedRoute` query params → `DashboardFilters` + `MonthSelection`. Zmiany w filtrach aktualizują URL.
- `DailyBreakdownPanelComponent` subskrybuje `DashboardStoreService.daily$` i `activeMonth$`.

## 7. Integracja API
- `GET /analytics/kpi`
  - Query: `dateFrom`, `dateTo`, optional `customerId`.
  - Response: `AnalyticsKpiResponseDto`.
  - Mapowanie: `DashboardStoreService.loadKpi` → `KpiViewModel`.
- `GET /analytics/trend`
  - Query: jak wyżej.
  - Response: `AnalyticsTrendEntryResponseDto[]` (`period` = `YYYY-MM`).
  - Po sukcesie: aktualizuje `TrendBarChartComponent`.
- `GET /analytics/daily`
  - Query: `year`, `month`, optional `customerId`.
  - Response: `DailyOrdersAnalyticsItemDto[]`.
  - Wywoływane tylko przy ustawionym `activeMonth`.
- Wszystkie żądania wysyłane przez `AnalyticsDashboardApiService` (Angular `HttpClient`), z globalnym `Authorization` headerem. `Cache-Control: no-store` z backendu jest informacyjne; front może dodać `headers: { 'Cache-Control': 'no-cache' }` dla spójności.

## 8. Interakcje użytkownika
- Zmiana filtra kontrahenta → debounce 300 ms → aktualizacja URL + odświeżenie KPI/Trend; reset dziennego widoku.
- Zmiana zakresu dat → walidacja + automatyczne odświeżenie.
- Kliknięcie słupka w TrendBarChart → ustawia `activeMonth` + fetch `/analytics/daily`.
- Kliknięcie „Wyczyść miesiąc” → usuwa `activeMonth`, chowa panel dzienny.
- Kliknięcie „Odśwież dane” → `refreshAll(true)`; pokazuje spinner do zakończenia żądań.
- Brak wyników → `EmptyStateComponent` z komunikatem „Brak danych dla wybranych filtrów”.

## 9. Warunki i walidacja
- `dateFrom` i `dateTo` muszą być ustawione oraz `dateFrom <= dateTo`; UI blokuje zapis filtrów, a `DashboardStoreService` rzuca błąd dla niepoprawnych wartości.
- Zakres domyślny: 1 stycznia – 31 grudnia bieżącego roku. Zmiana roku aktualizuje query params.
- `customerId` musi pochodzić z listy przekazanej przez backend (np. `CustomersService`); FilterBar nie pozwala wpisać dowolnej wartości.
- `month` i `year` w panelu dziennym muszą odpowiadać miesiącowi z trendu; weryfikacja `TrendBarChartComponent` przed emitowaniem eventu.
- API warunki (400 na złym zakresie) są prewencyjnie weryfikowane w UI; w razie błędu pokazujemy komunikat i cofamy zmiany.

## 10. Obsługa błędów
- 401/403 → przechwytywane globalnie (redirect do logowania); komponent wyświetla `EmptyState` z komunikatem o uprawnieniach, jeśli interceptory nie przechwycą.
- 400 (nieprawidłowe parametry) → `DashboardStoreService` oznacza `error`, UI pokazuje banner z szczegółem i umożliwia reset filtrów.
- 5xx / sieć → `ManualRefreshButton` pokazuje możliwość ponownego spróbowania; `EmptyState` w sekcjach wykresów.
- Brak danych → `EmptyState` z tekstem „Brak zamówień w tym okresie”; KPI pokazują zera z etykietą.
- Obsługa timeoutów: `HttpClient` z `timeout` (np. 10 s) i odpowiedni komunikat.

## 11. Kroki implementacji
1. Przygotuj moduł `apps/web/src/pages/dashboard` z routingiem `/dashboard`.
2. Zaimplementuj `DashboardStoreService` (signals/component store) z typami z sekcji 5.
3. Dodaj `AnalyticsDashboardApiService` integrujący trzy endpointy + mapowanie DTO → ViewModel.
4. Utwórz `DashboardPageComponent` i podłącz go do store + router query params.
5. Zaimplementuj `DashboardFilterBarComponent` z formularzem Angular Reactive Forms, debouncingiem i walidacją zakresu dat.
6. Dodaj `ManualRefreshButtonComponent` z obsługą stanu odświeżania i TTL.
7. Zbuduj `KpiCardsComponent` z skeletonami, formatowaniem PLN oraz obsługą błędów/pustych danych.
8. Utwórz `TrendBarChartComponent` (ECharts), mapuj dane m/m, obsłuż wybór miesiąca i wyróżnienie aktywnego słupka.
9. Dodaj `DailyBreakdownPanelComponent` z wykresem dziennym + tabelą; wyświetl `EmptyState` przy braku danych lub braku wyboru miesiąca.
10. Skonfiguruj `EmptyStateComponent` (jeśli nie istnieje) i zaimplementuj spójne komunikaty dla każdej sekcji.
11. Zaimplementuj obsługę błędów i manualnego odświeżania (retry, bannery).
12. Dodaj testy jednostkowe dla store (walidacja filtrów, mapowanie danych) oraz snapshoty komponentów krytycznych (KPI, Trend).
13. Zweryfikuj linter i formatowanie, uzupełnij dokumentację w Storybook/MDX (jeśli wymagane).

