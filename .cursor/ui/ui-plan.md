# Architektura UI dla SalesAnalysis (MVP)

## 1. Przegląd struktury UI

- **Cel**: Czytelny, wydajny i bezpieczny interfejs do ewidencji zamówień, importu z XLSX, podstawowej analityki oraz administracji użytkownikami (RBAC: viewer/editor/owner).
- **Wzorce i technologia**:
  - Angular 20 (standalone, lazy-loaded feature routes) + Nx; TypeScript 5; NgZorro (tokeny, theming).
  - Prefetch nawigacji: QuickLinkStrategy i prefetch pierwszych stron list po hover w menu.
  - Layout: Sidebar + Topbar + Content; breadcrumbs dla `orders` i `customers`.
  - Guardy/Interceptors: `AuthGuard` (JWT), `RoleGuard` + dyrektywa `hasRole`, `CanDeactivate` (form), `AuthInterceptor` (silent refresh), `ErrorInterceptor` (mapowanie błędów: 400/422/401/403/409/5xx).
  - Stan: lokalny w komponentach + cache w serwisach (RxJS `shareReplay`, SWR). Stale: listy 60–120 s, detale 120 s; manualne odświeżenie przyciskiem.
  - URL jako źródło prawdy dla list (query params: filtry/sort/paginacja); debounce 300 ms.
  - A11y/UX: formularze reaktywne, walidacje inline, loader w przyciskach, puste stany, toasty, focus management.
  - Theming: light domyślnie, przełącznik dark; paleta i CSS variables w `styles.scss`.
  - Bezpieczeństwo: 401 → `/login`, 403 → ekran „Brak uprawnień”; ukrywanie akcji `hasRole`; brak ekspozycji wersji API w UI.
- **Integracja z API (zgodnie z planem)**:
  - Auth: `POST /auth/login`, `POST /auth/logout`.
  - Users (owner): `GET/POST/PATCH/PUT/DELETE /admin/users`.
  - Customers: `GET /customers`, `POST /customers`, `GET /customers/{id}`, `PUT /customers/{id}`, `DELETE /customers/{id}`.
  - Orders: `GET /orders`, `POST /orders`, `GET /orders/{id}`, `PUT /orders/{id}`, `DELETE /orders/{id}`.
  - Analytics: `GET /analytics/kpi`, `GET /analytics/trend`, `GET /analytics/orders`.
  - FX: `GET /fx-rates/eur`.

## 2. Lista widoków

- **Login**
  - **Ścieżka**: `/login`
  - **Cel**: Uwierzytelnienie i utworzenie sesji (Supabase JWT). 401 → redirect tu.
  - **Kluczowe informacje**: e-mail, hasło; komunikaty błędów (401, ewentualnie 423).
  - **Kluczowe komponenty**: formularz logowania, `LoaderButton`, `ToastService`.
  - **UX/A11y/Bezpieczeństwo**: focus na pierwszym polu; blokada przycisku podczas żądania; komunikaty dostępne; po sukcesie redirect do `/dashboard` lub poprzedniej trasy.

- **Dashboard (Analityka)**
  - **Ścieżka**: `/dashboard`
  - **Cel**: KPI i trend m/m; filtry: kontrahent i zakres dat; deep-link `?year&month` (opcjonalnie).
  - **Kluczowe informacje**: KPI (suma netto, liczba zamówień, średnia), wykres słupkowy m/m, dzienny breakdown po wyborze miesiąca.
  - **Kluczowe komponenty**: `FilterBar` (kontrahent, zakres dat), `KpiCards`, `TrendBarChart` (ECharts), `ManualRefreshButton`, `EmptyState`.
  - **UX/A11y/Bezpieczeństwo**: debounce 300 ms; brak nawigacji po kliknięciu na wykres; cache 60–120 s; role: viewer+.

- **Zamówienia – Lista**
  - **Ścieżka**: `/orders`
  - **Cel**: Przegląd zamówień z filtrami, sortowaniem i paginacją; eksport przefiltrowanych wyników.
  - **Kluczowe informacje**: nr zamówienia, kontrahent, data, netto/brutto (PLN), waluta/EUR rate, autor, timestamps; panel szczegółów wiersza.
  - **Kluczowe komponenty**: `FilterBar` (orderNo, kontrahent, zakres dat), `DataTable` (2–5 kolumn + akcje), `RowDetailsPanel`, `Pagination`, `ManualRefreshButton`, `ExportXlsxButton`, `EmptyState`, `ConfirmDialog`.
  - **UX/A11y/Bezpieczeństwo**: stan w URL (`page`, `limit`, `sort`, filtry); debounce 300 ms; domyślnie sort malejący po dacie; blokada akcji podczas requestów; role: viewer (bez akcji), editor/owner (edycja/usunięcie/przywrócenie).

- **Zamówienia – Nowe**
  - **Ścieżka**: `/orders/new`
  - **Cel**: Dodanie zamówienia; lokalny preview kalkulacji; import XLSX (1 plik = 1 zamówienie → mapowanie → wypełnienie formularza).
  - **Kluczowe informacje**: wymagane pola (nr, kontrahent z listy, nazwa, ilość, netto, waluta, data); dla EUR wymagany kurs; tolerancja ±0,01.
  - **Kluczowe komponenty**: `OrderForm` (reaktywny), `NumericInputDirective` (przecinek, 2 miejsca), `FXRateBanner` (brak kursu → refetch + komunikat), `ImportXlsxPanel` (≤1 MB, 1 arkusz, A1 „numer – kontrahent”, mapowanie), `LoaderButton`, `CanDeactivate`.
  - **UX/A11y/Bezpieczeństwo**: walidacje inline; 409 unikalność do pola; dialog przy wyjściu bez zapisu; role: editor/owner.

- **Zamówienia – Detal/Edycja**
  - **Ścieżka**: `/orders/:id`
  - **Cel**: Podgląd i edycja; audyt; soft delete/przywrócenie.
  - **Kluczowe informacje**: wszystkie pola zamówienia, metadane (`createdAt`, `updatedAt`, `createdBy.displayName`), wpisy audytu.
  - **Kluczowe komponenty**: `OrderForm` (edycja), `FXRateBanner`, `AuditPanel`, `ConfirmDialog`, `LoaderButton`.
  - **UX/A11y/Bezpieczeństwo**: `CanDeactivate` przy zmianach; 403 ekran braku uprawnień; 404 gdy brak; role: viewer (odczyt), editor/owner (edycja/usunięcie/przywrócenie).

- **Kontrahenci – Lista**
  - **Ścieżka**: `/customers`
  - **Cel**: Przegląd i filtrowanie kontrahentów; akcje zależnie od roli.
  - **Kluczowe informacje**: nazwa, status, komentarz; akcje: edycja, soft delete/przywrócenie.
  - **Kluczowe komponenty**: `FilterBar` (name), `DataTable`, `Pagination`, `EmptyState`, `ManualRefreshButton`, `ConfirmDialog`.
  - **UX/A11y/Bezpieczeństwo**: stan w URL; debounce 300 ms; role: viewer (odczyt), editor/owner (mutacje).

- **Kontrahenci – Nowy**
  - **Ścieżka**: `/customers/new`
  - **Cel**: Dodanie kontrahenta (unikalna nazwa, aktywność, komentarz).
  - **Kluczowe komponenty**: `CustomerForm`, `LoaderButton`.
  - **UX/A11y/Bezpieczeństwo**: walidacje inline; 409 dla duplikatu; role: editor/owner.

- **Kontrahenci – Detal/Edycja**
  - **Ścieżka**: `/customers/:id`
  - **Cel**: Podgląd i edycja; soft delete/przywrócenie.
  - **Kluczowe komponenty**: `CustomerForm`, `ConfirmDialog`, `LoaderButton`.
  - **UX/A11y/Bezpieczeństwo**: role: viewer (odczyt), editor/owner (edycja/przywrócenie).

- **Admin – Użytkownicy**
  - **Ścieżka**: `/admin/users`
  - **Cel**: Zarządzanie kontami i rolami (owner).
  - **Kluczowe informacje**: e-mail, displayName, role, status.
  - **Kluczowe komponenty**: `UsersTable`, `UserFormDialog`, `RoleMultiSelect`, `ConfirmDialog`, `LoaderButton`.
  - **UX/A11y/Bezpieczeństwo**: dostęp tylko owner; sekcja widoczna przez `hasRole`.

- **Brak uprawnień (403)**
  - **Ścieżka**: `/forbidden`
  - **Cel**: Informacja o braku dostępu + CTA „Wróć do Dashboardu”.

- **Błąd krytyczny / 5xx**
  - **Ścieżka**: `/error`
  - **Cel**: Jednolity ekran błędu + CTA do Dashboardu.

- **404 Not Found**
  - **Ścieżka**: `**`
  - **Cel**: Komunikat + CTA do Dashboardu.

Uwaga: US-016 (telemetria zapisu) i US-023 (backup) realizowane poza UI; UI inicjuje zapisy zamówień (telemetria emituje backend).

## 3. Mapa podróży użytkownika

- **Logowanie i dostęp ról (US-001)**
  1. Wejście na `/login` (brak sesji/401).
  2. Po sukcesie: redirect do docelowej trasy lub `/dashboard`; UI ładuje menu/sekcje wg ról (`hasRole`).
  3. Silent refresh w tle; porażka → `/login`.

- **Dodanie zamówienia (US-003, US-014, US-017, US-018, US-019)**
  1. Nawigacja do `/orders/new` (prefetch z menu). Import XLSX opcjonalnie → `ImportXlsxPanel` (≤1 MB, 1 arkusz, A1 „numer – kontrahent”; US-009, US-010, US-021, US-022).
  2. Mapowanie kolumn → wypełnienie `OrderForm` lub wprowadzanie ręczne.
  3. Wybór kontrahenta (lista referencyjna); wartości liczbowe z `NumericInputDirective`.
  4. EUR → `GET /fx-rates/eur`; brak kursu → `FXRateBanner` z refetch/override `POST /fx-rates/overrides` (editor/owner) (US-014).
  5. Podgląd kalkulacji netto→rabaty→VAT→brutto; tolerancja ±0,01; źródło prawdy: backend po `POST /orders` (US-017).
  6. Zapis: loader + blokada; sukces → toast + redirect do `/orders` lub `/orders/:id`; błędy: 409 do pola (US-018), 400/422 do pól, 5xx → toast.
  7. Wyjście bez zapisu → `CanDeactivate` (dialog).

- **Edycja zamówienia (US-004, US-014, US-015)**
  1. Wejście na `/orders/:id`; detale + audyt `GET /orders/{id}/audit`.
  2. Zmiana kursu EUR (editor/owner) → przeliczenia w UI; zapis → walidacja backend.
  3. `CanDeactivate` przy zmianach bez zapisu.

- **Usunięcie/przywrócenie (US-005)**
  1. Lista/detal: „Usuń” → `ConfirmDialog` → `DELETE /orders/{id}`.
  2. Przywrócenie: `POST /orders/{id}/restore` (owner/editor).

- **Lista i eksport (US-006, US-008, US-024, US-025)**
  1. `/orders`: filtry (orderNo, kontrahent, zakres dat), sort/paginacja w URL.
  2. Puste wyniki → komunikat; eksport → XLSX z danych w pamięci dla aktywnych filtrów.

- **Analityka (US-011, US-012, US-013)**
  1. `/dashboard`: ustaw filtry → pobierz KPI i trend; opcjonalny deep-link `?year&month`.

- **Administracja (US-002)**
  1. `/admin/users` (owner): lista, tworzenie/edycja, role; 403 → `/forbidden`.

- **Stany błędów**
  - 401 → `/login`; 403 → `/forbidden`; 404 → fallback; 5xx/timeout → toast; krytyczne → `/error` z CTA do Dashboardu.

## 4. Układ i struktura nawigacji

- **AppShell**: Topbar (logo, użytkownik, „Wyloguj”), Sidebar (nawigacja), Content (breadcrumbs + router-outlet).
- **Sidebar**: Dashboard, Zamówienia, Kontrahenci; Admin (Użytkownicy) tylko dla owner. Prefetch tras i pierwszych stron list po hover.
- **Topbar**: nazwa/rola użytkownika, „Wyloguj” (`POST /auth/logout`), przełącznik motywu.
- **Breadcrumbs**: konfigurowane per trasa; przykłady: „Zamówienia / SZ-12345 / Edycja”.
- **Routing (lazy-load)**:
  - `/login` (public)
  - `/dashboard` (Auth)
  - `/orders` (Auth)
    - `/orders/new` (Role editor/owner; CanDeactivate)
    - `/orders/:id` (Auth; edycja zależna od roli)
  - `/customers` (Auth)
    - `/customers/new` (Role editor/owner)
    - `/customers/:id` (Auth)
  - `/admin/users` (Role owner)
  - `/forbidden`, `/error`, `**` (404)
- **Guardy/dyrektywy**: `AuthGuard`, `RoleGuard`, `CanDeactivate`, `hasRole`.
- **Synchronizacja URL**: listy przechowują `page`, `limit`, `sort`, filtry; inicjalizacja z URL; aktualizacja przy zmianach formularza.

## 5. Kluczowe komponenty

- **AppShell**: Topbar/Sidebar/Content, breadcrumbs.
- **SidebarNav**: pozycje menu z prefetch (QuickLinkStrategy), widoczność wg ról.
- **Topbar**: dane użytkownika, „Wyloguj”, przełącznik motywu.
- **Breadcrumbs**: dynamiczne segmenty (np. nr zamówienia), integracja z routerem.
- **FilterBar**: wspólny dla list i dashboardu; input/select/date-range; debounce 300 ms; synchronizacja URL.
- **DataTable**: minimalny zestaw kolumn; kolumna akcji (warunkowo); `RowDetailsPanel` dla szczegółów.
- **Pagination**: paginacja zsynchronizowana z URL.
- **EmptyState**: puste stany z kontekstowymi CTA (np. „Dodaj zamówienie” dla editor/owner).
- **LoaderButton**: przycisk z loaderem/blokadą podczas requestów.
- **ConfirmDialog**: potwierdzanie akcji nieodwracalnych (usunięcia).
- **ToastService**: sukcesy/błędy; współpraca z `ErrorInterceptor` (400/422 → pola; 401 → redirect; 403 → ekran; 409 → konflikt pola; 5xx → toast).
- **NumericInputDirective**: separator przecinka, precyzja 2, walidacje liczb.
- **RoleDirective (`hasRole`)**: ukrywanie przycisków/sekcji zależnie od ról.
- **OrderForm**: formularz zamówienia (nowy/edycja), lokalny preview kalkulacji (±0,01), integracja z `FxRatesService`.
- **CustomerForm**: formularz kontrahenta (nowy/edycja).
- **ImportXlsxPanel**: upload (≤1 MB, 1 arkusz), weryfikacja A1, mapowanie kolumn → wypełnienie `OrderForm`.
- **FXRateBanner**: komunikaty o kursie NBP, refetch/override (editor/owner).
- **AuditPanel**: lista wpisów audytu zamówienia (`GET /orders/{id}/audit`).
- **KpiCards**: KPI na dashboardzie.
- **TrendBarChart**: wykres słupkowy m/m (ECharts) z tooltipem; brak akcji na klik.
- **ManualRefreshButton**: ręczne odświeżanie cache (SWR) list/detali.
- **Interceptors/Serwisy**: `AuthInterceptor`, `ErrorInterceptor`; `AuthService`, `OrdersService`, `CustomersService`, `UsersService`, `FxRatesService`; adaptery DTO ↔ modele UI.

- **Dostępność/Środowisko**:
  - ARIA dla loaderów, komunikatów błędów i toastów; obsługa klawiatury w tabelach i dialogach.
  - Flaga środowiskowa: `maxDate=today` dla date-picker + komunikat walidacyjny (w `environment.ts`).

- **Mapowanie historyjek PRD → UI (skrót)**:
  - US-001: Login, Guardy, `hasRole`.
  - US-002: Admin Users.
  - US-003/004/005/006/007/008/017/018/024/025: Orders (lista/detal/nowy, eksport, walidacje, unikalność, sort, puste stany).
  - US-009/010/021/022: ImportXlsxPanel → OrderForm.
  - US-011/012/013: Dashboard (KPI, Trend, filtry, deep-link).
  - US-014: FX (banner, override, refetch).
  - US-015: AuditPanel.
  - US-016: Telemetria – po stronie backend; UI wywołuje zapisy.
  - US-019/020: Customers + kontrola ról.
  - US-023: Backup – poza UI.
