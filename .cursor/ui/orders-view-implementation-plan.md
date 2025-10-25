# Plan implementacji widoku Orders List

## 1. Przegląd
Widok `Orders List` ma umożliwić użytkownikom przeglądanie zamówień w formie tabeli z filtrami, sortowaniem, paginacją oraz eksportem wyników. Ekran obsługuje role aplikacyjne (viewer, editor, owner), pokazuje kluczowe metadane zamówień (numer, kontrahent, daty, wartości netto/brutto, waluta, autor) i udostępnia panel szczegółów wiersza.

## 2. Routing widoku
- Ścieżka: `/orders`
- Konfiguracja w `apps/web/src/app/app.routes.ts` z lazy load komponentu `OrdersPage`.
- Stan filtra i paginacji utrzymywany w parametrach query (`page`, `limit`, `sort`, `orderNo`, `customerId`, `dateFrom`, `dateTo`, `includeDeleted`).

## 3. Struktura komponentów
- `OrdersPage` (kontener)
  - `OrdersToolbarComponent`
    - `OrdersFilterBarComponent`
    - `ManualRefreshButtonComponent`
    - `OrdersExportXlsxButtonComponent`
  - `OrdersDataTableComponent`
    - `OrdersRowDetailsPanelComponent`
  - `PaginationComponent`
  - `EmptyStateComponent`
  - `NzAlert` (obsługa błędów)
  - `ConfirmDialogComponent`

## 4. Szczegóły komponentów
### OrdersPage
- Opis: główny komponent strony; inicjuje `OrdersListService`, spina stan, przekazuje dane/zdarzenia do dzieci.
- Główne elementy: sekcja nagłówka (toolbar), tabela, paginacja, komponenty stanu (`EmptyState`, `NzAlert`, `ConfirmDialog`).
- Obsługiwane interakcje: zmiana filtrów, sortowania, paginacji, odświeżenie ręczne, eksport, akcje wiersza (edytuj, usuń, przywróć, rozwinięcie szczegółów).
- Walidacja: delegowana do serwisu i komponentów formularzy (np. dataFrom ≤ dateTo, UUID kontrahenta, limit ≤ 100).
- Typy: `OrdersQueryParamsVm`, `OrdersListVm`, `OrderRowVm`, `OrdersRolePermissionsVm`.
- Propsy: brak (komponent top-level); wstrzykuje serwis i sygnały.

### OrdersToolbarComponent
- Opis: prezentuje filtry oraz akcje globalne (manual refresh, export, includeDeleted toggle).
- Główne elementy: wrapper z `OrdersFilterBarComponent`, przyciski akcji (`ManualRefreshButtonComponent`, `OrdersExportXlsxButtonComponent`), opcjonalny `NzSwitch` dla `includeDeleted`.
- Interakcje: `filtersChange`, `filtersReset`, `includeDeletedToggle`, `manualRefresh`, `exportRequest`.
- Walidacja: przekazuje błędy formularza (np. zakres dat) do rodzica w celu zablokowania aplikacji filtra.
- Typy: `OrdersFilterFormState`, `OrdersToolbarOutput`.
- Propsy: `{ filters: OrdersFilterFormState; loading: boolean; canIncludeDeleted: boolean; hasSelectedFilters: boolean; }` oraz emitery sygnałów (callbacki).

### OrdersFilterBarComponent
- Opis: formularz filtrów (orderNo, kontrahent, zakres dat). Debounce 300 ms.
- Główne elementy: `nz-input` dla numeru zamówienia, `nz-select` z async opcjami kontrahentów, `nz-date-picker` (range).
- Interakcje: wpis w polach, zatwierdzanie Enter, przycisk „Wyczyść”.
- Walidacja: maks. 64 znaki dla `orderNo`, `dateFrom` ≤ `dateTo`, poprawny UUID kontrahenta; brak wysyłki zapytania przy błędzie.
- Typy: `OrdersFilterFormState`, `CustomerOptionVm`.
- Propsy: `{ value: OrdersFilterFormState; disabled: boolean; }` + EventEmitter `filtersChange: (partial: Partial<OrdersFilterFormState>) => void`, `resetRequested: () => void`.

### OrdersDataTableComponent
- Opis: tabela listy zamówień z akcjami i obsługą sortowania oraz rozwijanymi szczegółami.
- Główne elementy: `nz-table` z kolumnami (`orderNo`, `customer`, `orderDate`, `totalNetPln`, `totalGrossPln`, `currencyBadge`, `createdAt`, `actions`), ikoną statusu soft-delete.
- Interakcje: kliknięcie nagłówka (sort), kliknięcie „Szczegóły”, „Edytuj”, „Usuń”, „Przywróć”.
- Walidacja: kontrola uprawnień (ukrycie akcji edycji/soft-delete dla viewer), blokada akcji gdy `loading`.
- Typy: `OrderRowVm`, `OrdersSortState`, `OrdersActionEvent`.
- Propsy: `{ rows: OrderRowVm[]; sort: OrdersSortState; loading: boolean; canMutate: boolean; expandedRowId: string | null; }` + emisje zdarzeń `sortChange`, `rowToggle`, `edit`, `softDelete`, `restore`.

### OrdersRowDetailsPanelComponent
- Opis: panel szczegółów widoczny po rozwinięciu wiersza, pokazujący pełne dane (rabaty, kursy, komentarz, znacznik telemetrii, link do audytu).
- Główne elementy: layout w kolumnach z `nz-descriptions`, badge waluty, lista historii (jeśli dostępna), przycisk „Zobacz audyt”.
- Interakcje: link do szczegółów zamówienia (`/orders/:id`), otwarcie audytu.
- Walidacja: brak szczególnych; prezentacja danych.
- Typy: `OrderRowVm`, `OrderDetailsMetaVm`.
- Propsy: `{ order: OrderRowVm; }`.

### OrdersExportXlsxButtonComponent
- Opis: przycisk eksportu XLSX, inicjuje żądanie eksportu dla aktualnych filtrów.
- Elementy: `nz-button`, ikonka `download`.
- Interakcje: kliknięcie -> emituje `exportRequested` z bieżącymi filtrami; obsługuje stan `loading`.
- Typy: `OrdersExportPayload`.
- Propsy: `{ disabled: boolean; loading: boolean; }` + emitter `export: () => void`.

### PaginationComponent / ManualRefreshButtonComponent / ConfirmDialogComponent / EmptyStateComponent
- Wykorzystane istniejące komponenty z `shared`. Należy przekazać odpowiednie parametry (np. `page`, `limit`, `total`, `loading`, komunikaty potwierdzeń).

## 5. Typy
- `OrdersQueryParamsVm`: `{ page: number; limit: number; orderNo?: string; customerId?: string; dateFrom?: string; dateTo?: string; sort: OrdersSortState; includeDeleted?: boolean; }`.
- `OrdersSortState`: `{ field: 'orderDate' | 'orderNo' | 'customerName' | 'totalNetPln' | 'createdAt'; direction: 'asc' | 'desc'; }`.
- `OrdersFilterFormState`: `{ orderNo?: string; customerId?: string; dateRange?: [string, string]; includeDeleted?: boolean; }`.
- `OrderRowVm`: rozszerzenie `OrderListItemDto` o pola prezentacyjne `{ customerName: string; createdByName?: string; currencyLabel: string; netFormatted: string; grossFormatted: string; deleted: boolean; rowDisabled: boolean; }`.
- `OrdersListVm`: `{ items: OrderRowVm[]; total: number; page: number; limit: number; }`.
- `OrdersActionEvent`: unia zdarzeń `{ type: 'edit' | 'soft-delete' | 'restore' | 'view'; order: OrderRowVm }`.
- `OrdersRolePermissionsVm`: `{ canMutate: boolean; canIncludeDeleted: boolean; }`.
- `OrdersExportPayload`: `{ params: OrdersQueryParamsVm; timestamp: string; }`.
- `CustomerOptionVm`: `{ value: string; label: string; active: boolean; }`.

## 6. Zarządzanie stanem
- Dedykowany serwis `OrdersListService` w `apps/web/src/app/service/orders/orders-list.service.ts` z sygnałami: `params`, `loading`, `error`, `data`, `roles`, `confirmation`.
- Serwis czyta/ustawia parametry query poprzez `ActivatedRoute` i `Router`, korzystając z funkcji normalizacji (analogicznie do `CustomersListService`).
- Debounce filtrów: `OrdersFilterBarComponent` używa `signal` + `setTimeout` lub `rxjs` `Subject` z `debounceTime(300)` przekonwertowany do sygnału.
- Stan rozwiniętych wierszy utrzymywany w `OrdersPage` jako sygnał `expandedRowId`.
- `OrdersListService` zapewnia metody `setParams`, `resetFilters`, `refetch`, `askSoftDelete`, `askRestore`, `confirmDialogConfirm`, `confirmDialogClose`.

## 7. Integracja API
- Żądanie: `GET /api/orders` z parametrami query (`page`, `limit`, `orderNo`, `customerId`, `dateFrom`, `dateTo`, `sort`, `includeDeleted`). Typ requestu: `ListOrdersQuery` (z `apps/shared/dtos/orders.dto.ts`).
- Odpowiedź: `ListOrdersResponse` → mapowanie do `OrdersListVm` w serwisie.
- Mapowanie sortu: UI pola `orderDate`, `orderNo`, `customerName`, `totalNetPln`, `createdAt` → API `sort=field:direction`. UWAGA: backend DTO aktualnie nie zwraca `customerName`; plan zakłada rozszerzenie API (przez mapper) lub fallback do lokalnego cache kontrahentów. W planie przyjmujemy, że `OrderRowVm.customerName` pochodzi z rozszerzonej odpowiedzi.
- Eksport: przygotować `OrdersExportXlsxButtonComponent` do wywołania dedykowanego endpointu (np. `POST /api/orders/export`). Jeśli endpoint nie istnieje – zdefiniować interfejs i oznaczyć TODO.
- Akcje soft-delete/restore: przyciski emitują zdarzenia, ale implementacja API (DELETE/POST restore) pozostaje poza zakresem tej iteracji; serwis może wyświetlać komunikat „w budowie”.

## 8. Interakcje użytkownika
- Zmiana wartości filtra → po 300 ms aktualizacja `OrdersQueryParamsVm`, zapis w URL, odświeżenie listy.
- Kliknięcie „Wyczyść” → reset filtrów do domyślnych, pozostawienie paginacji na stronie 1.
- Zmiana sortowania w nagłówku tabeli → ustawienie `OrdersSortState`, aktualizacja parametru `sort` w URL, fetch.
- Paginacja (zmiana strony/limitu) → aktualizacja `page`/`limit`, fetch.
- „Manual refresh” → ponowne wywołanie `GET /api/orders` z aktualnymi parametrami.
- Klik „Eksport” → wywołanie eksportu, blokada przycisku podczas requestu, komunikat sukcesu/niespowodzenia.
- Rozwinięcie wiersza → ustawienie `expandedRowId`; kolejne kliknięcie zwija.
- Akcje edycji/usunięcia/przywrócenia → emitowane zdarzenia, `ConfirmDialog` potwierdza usunięcie/przywrócenie. Viewer nie widzi akcji.
- Przełączenie `includeDeleted` (editor/owner) → aktualizacja parametru i fetch. Viewer ma przełącznik disabled.

## 9. Warunki i walidacja
- `page` ≥ 1, `limit` ∈ {25, 50, 100}; wymuszane w serwisie przy normalizacji.
- `orderNo`: długość ≤ 64, trimming i lower-case przed wysyłką.
- `customerId`: walidowany jako UUID (frontend sprawdza pattern, np. RegExp) i pochodzi z listy opcji.
- `dateFrom` i `dateTo`: format ISO (`yyyy-MM-dd`), sprawdzenie `dateFrom <= dateTo`; w razie błędu pokazanie komunikatu w filtrze i blokada wysyłki.
- `sort`: mapowane wyłącznie na dozwolone pola; niedozwolony wybór resetuje do `orderDate:desc`.
- `includeDeleted`: możliwe tylko jeśli `canIncludeDeleted` true; inaczej UI wymusza `false` i ukrywa kontrolkę.
- Stan `loading` blokuje przyciski akcji oraz filtry (poza anulowaniem).

## 10. Obsługa błędów
- 400 (walidacja) → komunikat w `NzAlert` („Niepoprawne parametry zapytania”), log do konsoli; UI przywraca poprzednie parametry.
- 401 → globalny interceptor (poza zakresem) przekierowuje do logowania; w widoku pokaż informację gdy brak danych.
- 403 (np. includeDeleted dla viewer) → wyświetlić toast `NzMessage` i przywrócić `includeDeleted=false`.
- 500/nieznane → `NzAlert` z informacją „Nie udało się pobrać zamówień. Spróbuj ponownie.”.
- Brak wyników → `EmptyStateComponent` z komunikatem „Brak zamówień dla wybranych filtrów”.
- Błędy eksportu → toast `NzMessage.error` i odblokowanie przycisku.

## 11. Kroki implementacji
1. Utwórz `OrdersListService` (analogiczny do `CustomersListService`) obsługujący sygnały stanu i komunikację z API.
2. Zdefiniuj typy ViewModel w `apps/web/src/app/service/orders/orders-list.types.ts` (QueryParams, FilterForm, RowVm, SortState, Permissions).
3. Dodaj helpery mapujące odpowiedź API na `OrderRowVm` (formatowanie kwot, status soft-delete, badge waluty).
4. Dodaj trasę `/orders` w `app.routes.ts`, wskazującą na lazy load `OrdersPage`.
5. Wygeneruj komponent `OrdersPage` (standalone, OnPush) wraz z plikami HTML/SCSS; zainicjalizuj w nim sygnały serwisu oraz wiring to child components.
6. Stwórz `OrdersToolbarComponent` i `OrdersFilterBarComponent` z formularzem reaktywnym opartym o sygnały + debounce 300 ms.
7. Zaimplementuj `OrdersDataTableComponent` z obsługą sortowania, rozwijanych wierszy i emisji akcji; dodaj `OrdersRowDetailsPanelComponent`.
8. Skonfiguruj integrację `PaginationComponent`, `ManualRefreshButtonComponent`, `ConfirmDialogComponent`, `EmptyStateComponent` oraz `NzAlert` w szablonie `OrdersPage`.
9. Dodaj logikę eksportu w `OrdersExportXlsxButtonComponent` (wywołanie endpointu, obsługa pliku, komunikaty).
10. Zapewnij synchronizację stanu z URL (efekty w serwisie), w tym resetowanie przy `filtersReset` i domyślne sortowanie `orderDate:desc`.
11. Dodaj obsługę błędów i komunikatów (`NzMessageService`, `NzNotificationService` jeśli potrzebne), wraz z testami interakcji serwisu.
12. Przygotuj testy jednostkowe dla serwisu (normalizacja parametrów, mapowanie odpowiedzi) i komponentów (emitery zdarzeń, renderowanie stanu) oraz zaktualizuj dokumentację (README/Notion) jeśli wymagane.
