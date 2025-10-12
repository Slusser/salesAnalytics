# Plan implementacji widoku Kontrahenci – Lista

## 1. Przegląd
Widok listy kontrahentów umożliwia przeglądanie, filtrowanie oraz podstawowe akcje na rekordach klientów zgodnie z rolami użytkownika: viewer (odczyt), editor/owner (mutacje: edycja, soft delete/przywrócenie). Wspiera paginację, wyszukiwanie po nazwie i zachowywanie stanu w URL. Integruje się z endpointem GET `/api/customers` i korzysta z wspólnych DTO.

## 2. Routing widoku
- Ścieżka aplikacji: `/customers` (Angular Router)
- Wersjonowanie API: prefiks globalny `api` po stronie backendu (pełny endpoint: `/api/customers`).

## 3. Struktura komponentów
- CustomersPage (route component)
  - FilterBar (name)
  - ManualRefreshButton
  - DataTable
    - EmptyState (renderowany warunkowo)
  - Pagination
  - ConfirmDialog (portal/overlay; renderowany na żądanie)

## 4. Szczegóły komponentów
### CustomersPage
- Opis: Strona kontener dla listy kontrahentów. Odpowiada za orkiestrację stanu (query params, żądania API, paginacja), kontrolę dostępu (ukrywanie akcji) oraz renderowanie layoutu.
- Główne elementy: nagłówek sekcji, `FilterBar`, przycisk odświeżania, `DataTable`, `Pagination`, kontener dla `ConfirmDialog`.
- Obsługiwane interakcje:
  - Zmiana pola wyszukiwania (debounce 300 ms) → aktualizacja URL i refetch
  - Zmiana strony/limitu → aktualizacja URL i refetch
  - Kliknięcie „Odśwież” → refetch bieżących danych
  - Akcje wiersza (z `DataTable`): edycja, soft delete/przywróć (po potwierdzeniu)
- Walidacja:
  - Walidacja lokalna query params: `page>=1`, `1<=limit<=100`, `search.length<=120`, `includeInactive` jako boolean
  - Dla ról viewer zawsze wymuszaj `includeInactive=false`
- Typy: `ListCustomersQuery`, `ListCustomersResponse`, `CustomerDto`; ViewModel: `CustomerRowVm` (patrz sekcja 5)
- Propsy: brak (komponent routowany); używa usług/hooków i query params

### FilterBar
- Opis: Pasek filtrów z jednym polem „Nazwa kontrahenta” z debounce.
- Główne elementy: `input[type=text]` z ikoną search.
- Zdarzenia: `onSearchChange(value)`, `onIncludeInactiveChange(checked)` (emitowane do rodzica)
- Walidacja: max 120 znaków; trim; brak pustych submitów (debounce odfiltrowuje)
- Typy: `{ search?: string; includeInactive?: boolean }`
- Propsy: `{ value: { search?: string; includeInactive?: boolean }, role: UserRoleValue[], onChange: (partial) => void }`

### ManualRefreshButton
- Opis: Wymusza ponowne pobranie danych przy niezmienionych parametrach.
- Elementy: `button` z ikoną odśwież.
- Zdarzenia: `onClick()`
- Walidacja: brak
- Typy: brak
- Propsy: `{ onClick: () => void, disabled?: boolean }`

### DataTable
- Opis: Tabela danych klientów z kolumnami: nazwa, status, komentarz (opcjonalna kolumna), akcje (edycja, usuń/przywróć zależnie od stanu i roli).
- Elementy: NgZorro `table`; wiersze z przyciskami akcji; etykiety a11y.
- Zdarzenia: `onEdit(customer)`, `onSoftDelete(customer)`, `onRestore(customer)`
- Walidacja: akcji mutujących nie renderować dla viewer; dla rekordów `deletedAt!=null` pokaż „Przywróć” zamiast „Usuń”.
- Typy: `CustomerRowVm[]`
- Propsy: `{ items: CustomerRowVm[], role: UserRoleValue[], onEdit, onSoftDelete, onRestore, loading: boolean }`

### EmptyState
- Opis: Prezentuje komunikat, gdy brak wyników przy danych filtrach.
- Elementy: ilustracja/ikona, tytuł, opis, przycisk „Wyczyść filtr” (opcjonalnie).
- Zdarzenia: `onClearFilters()`
- Walidacja: brak
- Typy: brak
- Propsy: `{ onClear?: () => void }`

### Pagination
- Opis: Steruje stroną i limitem. Synchronizuje stan z URL.
- Elementy: pager, select z limitami [10, 25, 50, 100].
- Zdarzenia: `onPageChange(page)`, `onLimitChange(limit)`
- Walidacja: `page>=1`, `limit in {10,25,50,100}` i `<=100`.
- Typy: `{ page: number; limit: number; total: number }`
- Propsy: `{ page, limit, total, onPageChange, onLimitChange, disabled?: boolean }`

### ConfirmDialog
- Opis: Modal potwierdzenia dla soft delete/przywrócenia.
- Elementy: tytuł, opis, przyciski potwierdź/anuluj.
- Zdarzenia: `onConfirm()`, `onCancel()`
- Walidacja: brak
- Typy: `{ title: string; description?: string; confirmLabel?: string; cancelLabel?: string }`
- Propsy: `{ open: boolean, onConfirm: () => void, onClose: () => void }`

## 5. Typy
- Wykorzystywane: `CustomerDto`, `ListCustomersQuery`, `ListCustomersResponse` (z `apps/shared/dtos/customers.dto.ts`).
- Nowe ViewModel:
  - `CustomerRowVm`:
    - `id: string`
    - `name: string`
    - `isActive: boolean`
    - `deleted: boolean` (pochodne z `deletedAt!=null`)
    - `deletedAt?: string | null`
    - `createdAt: string`
    - `updatedAt: string`
  - `CustomersQueryParamsVm`:
    - `page: number`
    - `limit: number`
    - `search?: string`
    - `includeInactive?: boolean` (przez UI tylko jeśli rola ≠ viewer)

## 6. Zarządzanie stanem
- Źródło prawdy: query params w URL (`page`, `limit`, `search`, `includeInactive`).
- Stan pochodny: `loading`, `error`, `data` (`ListCustomersResponse`), `showConfirm`, `selectedCustomer`.
- Custom hook (lub serwis): `useCustomersList()` / `CustomersListService`:
  - Odpowiada za czytanie/aktualizację query params, debounce search, wywołania API, mapowanie do `CustomerRowVm`, kontrolę ról.
  - API: `{ params, setParams, data, loading, error, refetch, canMutate }`.

## 7. Integracja API
- Endpoint: `GET /api/customers`
- Zapytanie: `ListCustomersQuery` (page?, limit?, search?, includeInactive?)
- Odpowiedź: `ListCustomersResponse` (`items: CustomerDto[]`, `total`, `page`, `limit`)
- Zasady ról: jeśli `viewer` i `includeInactive=true` → UI wymusza `false` oraz ukrywa przełącznik; backend może zwrócić 403 dla prób obejścia.
- Nagłówki: `Authorization: Bearer <jwt>`; brak cache (UI nie buforuje, pamięta ostatni wynik w stanie komponentu).

## 8. Interakcje użytkownika
- Wpisanie tekstu w polu wyszukiwania → po 300 ms aktualizacja URL i refetch.
- Zmiana strony/limitu → aktualizacja URL i refetch.
- Kliknięcie „Odśwież” → refetch bez zmiany URL.
- Kliknięcie „Usuń” (editor/owner, rekord aktywny) → pokaż `ConfirmDialog`; po potwierdzeniu wywołaj soft delete (poza zakresem tego planu – endpoint DELETE już istnieje) i odśwież listę.
- Kliknięcie „Przywróć” (editor/owner, rekord usunięty) → analogicznie akcja restore (endpoint do przywrócenia poza zakresem, jeśli będzie dodany) i odśwież listę.
- Kliknięcie „Edytuj” → nawigacja do `/customers/:id` (widok detalu/edycji – poza zakresem implementacji listy).

## 9. Warunki i walidacja
- Query params:
  - `page`: liczba całkowita, `>=1`; domyślnie `1`.
  - `limit`: 1..100; UI oferuje 10/25/50/100, domyślnie 25.
  - `search`: tekst `<=120` znaków; trim; puste usuwa parametr.
  - `includeInactive`: boolean; tylko dla `editor`/`owner`.
- Uprawnienia:
  - viewer: wyłączone akcje mutujące, brak przełącznika „Nieaktywni”.
  - editor/owner: pełny zestaw akcji.

## 10. Obsługa błędów
- 400 (VALIDATION): pokaż komunikat na pasku filtrów lub globalny alert; wskaż, które parametry są nieprawidłowe.
- 401 (UNAUTHORIZED): przekierowanie do logowania lub toast z informacją; retry po zalogowaniu.
- 403 (FORBIDDEN): ukryj przełącznik „Nieaktywni”; jeśli wystąpi po wywołaniu – pokaż komunikat i zresetuj `includeInactive=false`.
- 500 (FAILED): banner z informacją o błędzie i przyciskiem „Spróbuj ponownie”.
- Puste wyniki: pokaż `EmptyState` z CTA „Wyczyść filtr”.

## 11. Kroki implementacji
1. Routing: dodaj trasę w `apps/web/src/app/app.routes.ts` dla ścieżki `/customers` i komponentu `CustomersPage` (standalone component).
2. Utwórz `CustomersPage` w `apps/web/src/pages/customers/customers.page.ts` z uzyciem NgZorro wraz z template i stylem.
3. Zaimplementuj `FilterBar` z uzyciem NgZorro w `apps/web/src/shared/components/filter-bar/filter-bar.component.ts` (standalone) z debounce 300 ms i propsem `includeInactive` (warunkowe renderowanie po roli).
4. Zaimplementuj `ManualRefreshButton` w `apps/web/src/shared/components/manual-refresh-button/manual-refresh-button.component.ts`.
5. Zaimplementuj `DataTable` w `apps/web/src/shared/components/customers-table/customers-table.component.ts` z kolumnami i przyciskami akcji.
6. Zaimplementuj `EmptyState` i `ConfirmDialog` jako współdzielone komponenty z użyciem NgZorro (lub użyj istniejącej biblioteki UI, jeśli dostępna).
7. Utwórz serwis/hook `CustomersListService` w `apps/web/src/service/customers/customers-list.service.ts` do obsługi query params, debounce i wywołań API.
8. Stwórz klienta API `CustomersApiService` w `apps/web/src/service/customers/customers-api.service.ts` do wywołania `GET /api/customers` i mapowania do `CustomerRowVm`.
9. Zintegruj `CustomersPage` z serwisem: subskrypcja zmian query params, render danych, obsługa błędów i stanów ładowania.
11. Dokumentacja: dopisz krótkie README w katalogu strony z opisem parametrów i ról.


