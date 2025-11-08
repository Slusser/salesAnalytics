# Plan Testów - SalesAnalysis MVP

## Informacje ogólne

| Parametr | Wartość |
|----------|---------|
| **Projekt** | SalesAnalysis - System B2B do rejestrowania i analizy zamówień |
| **Wersja dokumentu** | 1.0 |
| **Data utworzenia** | 8 listopada 2025 |
| **Autor** | Zespół QA |
| **Status** | Wersja robocza |

---

## 1. Wprowadzenie i cele testowania

### 1.1. Cel dokumentu

Niniejszy dokument określa kompleksową strategię testowania aplikacji SalesAnalysis MVP - systemu do rejestrowania i analizy zamówień B2B. Plan testów ma na celu zapewnienie wysokiej jakości oprogramowania poprzez systematyczną weryfikację wszystkich kluczowych funkcjonalności, zabezpieczeń oraz integracji.

### 1.2. Główne cele testowania

1. **Weryfikacja funkcjonalności biznesowej**
   - Poprawność rejestrowania zamówień (ręcznie)
   - Prawidłowość kalkulacji kwot zgodnie z algorytmem biznesowym
   - Działanie systemu ról i uprawnień użytkowników

2. **Zapewnienie jakości danych**
   - Walidacja danych wejściowych
   - Spójność danych między frontendem a backendem
   - Integralność danych w bazie PostgreSQL (Supabase)

3. **Bezpieczeństwo i prywatność**
   - Weryfikacja autentykacji i autoryzacji (Supabase Auth)
   - Testy Row Level Security (RLS)
   - Zabezpieczenie przed nieautoryzowanym dostępem

4. **Wydajność i stabilność**
   - Responsywność interfejsu użytkownika
   - Stabilność systemu pod obciążeniem

5. **Zgodność z wymogami technicznymi**
   - Kompatybilność z przeglądarkami
   - Działanie w architekturze monorepo (Nx)
   - Poprawność integracji między warstwami (Angular 20 + NestJS 11)

---

## 2. Zakres testów

### 2.1. W zakresie testów

#### 2.1.1. Funkcjonalności aplikacyjne

**Moduł zamówień (Orders)**
- Tworzenie nowych zamówień (ręcznie)
- Edycja istniejących zamówień
- Usuwanie zamówień (soft-delete)
- Pobieranie listy zamówień z filtrowaniem i paginacją
- Wyświetlanie szczegółów zamówienia
- Walidacja pól zamówienia (orderNo, orderDate, customerId, quantity, kwoty)
- Obsługa zamówień w PLN i EUR z kursem wymiany

**Moduł klientów (Customers)**
- Tworzenie nowych klientów
- Edycja danych klientów
- Deaktywacja klientów (soft-delete)
- Pobieranie listy aktywnych klientów
- Walidacja unikalności nazwy klienta (case-insensitive)

**Moduł autentykacji (Auth)**
- Logowanie użytkowników
- Wylogowanie
- Odświeżanie sesji
- Obsługa wygasłych tokenów
- Zabezpieczenie endpointów przed nieautoryzowanym dostępem

<!-- Poza MVP
**Moduł ról użytkowników (User Roles)**
- Przypisywanie ról: viewer, editor, owner
- Weryfikacja uprawnień dla poszczególnych ról:
  - viewer: odczyt zamówień i klientów
  - editor: odczyt + tworzenie/edycja/usuwanie zamówień i klientów
  - owner: wszystkie uprawnienia + dostęp do audit log + zarządzanie rolami -->

**Moduł analityki (Analytics)**
- Generowanie metryk dashboardu
- Obliczanie KPI (wartość sprzedaży, liczba zamówień, trendy)
- Filtrowanie danych analitycznych po zakresie dat i klientach

<!-- Poza MVP
**Moduł audytu (Audit Log)**
- Automatyczne logowanie operacji CRUD na tabelach: orders, customers
- Zapisywanie informacji o użytkowniku wykonującym operację
- Wyświetlanie historii zmian (tylko dla roli owner) -->

#### 2.1.2. Integracje

- **Frontend ↔ Backend**: komunikacja przez API REST (NestJS)
- **Backend ↔ Baza danych**: Supabase PostgreSQL
- **Autentykacja**: Supabase Auth
- **Walidacja**: class-validator na backendzie, Angular Forms na frontendzie
- **Dokumentacja API**: Swagger

#### 2.1.3. Aspekty nietestowe

- **Zabezpieczenia bazy danych**: Row Level Security (RLS)
- **Mechanizmy audytowe**: triggery PostgreSQL
- **Obsługa błędów**: HTTP status codes, strukturyzowane komunikaty błędów
- **Normalizacja danych**: trimowanie, uppercase dla orderNo

### 2.2. Poza zakresem testów

- **Hosting i deployment**: konfiguracja DigitalOcean, Docker
- **CI/CD pipeline**: GitHub Actions (testowane niezależnie)
- **Migracje bazy danych**: ręczna weryfikacja SQL
- **Lokalizacja**: projekt używa języka polskiego (brak testów wielojęzyczności)
- **Zewnętrzne API**: np. kursy walut (jeśli będą integrowane w przyszłości)
- **Wydajność infrastruktury**: testy obciążeniowe środowiska produkcyjnego
- **Zgodność z RODO**: wymaga odrębnego audytu prawnego

---

## 3. Typy testów do przeprowadzenia

### 3.1. Testy jednostkowe (Unit Tests)

**Cel**: weryfikacja poprawności działania pojedynczych jednostek kodu (funkcje, metody, komponenty) w izolacji.

**Technologie**:
- Backend (NestJS): Vitest
- Frontend (Angular): Vitest + @analogjs/vitest-angular

**Zakres**:

#### Backend (NestJS)
- **Services**:
  - `OrdersService`: logika biznesowa (walidacja, normalizacja, kalkulacje kwot)
  - `CustomersService`: operacje CRUD na klientach
  - `AuthService`: logika autentykacji
  - Analityka: funkcje obliczające metryki

- **Mappers**:
  - `OrderMapper`: konwersja między DTOs a encjami bazodanowymi
  - `CustomerMapper`: transformacje danych klientów
  - `AuthMapper`: mapowanie danych użytkownika

- **Guards**:
  - `JwtAuthGuard`: weryfikacja tokenu
  - `RolesGuard`: sprawdzanie uprawnień

- **Pipes**:
  - Walidacja DTOs (class-validator)

- **Utilities**:
  - Funkcje pomocnicze (formatowanie dat, normalizacja stringów)
  - Parsery (np. sortowania)

#### Frontend (Angular)
- **Services**:
  - `OrdersListService`: logika zarządzania stanem listy zamówień
  - `AuthSessionService`: zarządzanie sesją użytkownika
  - `CustomersService`: operacje na klientach

- **Components** (logika biznesowa):
  - Formularze: walidacja, transformacja danych
  - Komponenty prezentacyjne: renderowanie warunkowe, obliczenia UI

- **Pipes**:
  - Formatowanie walut, dat, liczb

- **Validators**:
  - Custom validators dla formularzy Angular

**Kryteria pokrycia**: minimum 70% pokrycia kodu dla warstwy biznesowej

**Przykładowe scenariusze**:
- Test kalkulacji `totalGrossPln = totalNetPln * (1 + vatRatePct/100)` z tolerancją 0.01
- Weryfikacja normalizacji `orderNo` (uppercase, trim)
- Test mapowania `OrderDetailDto` na encję bazodanową
- Sprawdzenie czy `JwtAuthGuard` blokuje żądania bez tokenu

---

### 3.2. Testy integracyjne (Integration Tests)

**Cel**: weryfikacja interakcji między modułami aplikacji oraz z zewnętrznymi zależnościami.

**Technologie**:
- Backend: Jest + Supertest (projekt `api-e2e`)
- Baza danych testowa: Supabase (instancja testowa lub Docker)

**Zakres**:

#### Backend API (NestJS)
- **Endpoints zamówień**:
  - `POST /api/orders`: tworzenie zamówienia z pełnym flow (walidacja → zapis → audit log)
  - `GET /api/orders`: pobieranie listy z filtrowaniem, sortowaniem, paginacją
  - `GET /api/orders/:orderId`: szczegóły zamówienia
  - `PUT /api/orders/:orderId`: aktualizacja z weryfikacją konfliktów (duplicate orderNo)
  - `DELETE /api/orders/:orderId`: soft-delete + sprawdzenie czy `deletedAt` jest ustawione

- **Endpoints klientów**:
  - `POST /api/customers`: tworzenie klienta
  - `GET /api/customers`: lista klientów
  - `PUT /api/customers/:customerId`: aktualizacja
  - Walidacja unikalności nazwy (case-insensitive)

- **Endpoints autentykacji**:
  - `POST /api/auth/login`: logowanie i otrzymanie JWT
  - `POST /api/auth/logout`: wylogowanie

- **Integracja z bazą danych**:
  - Testy RLS: weryfikacja że użytkownik viewer nie może modyfikować danych

- **Integracja z Supabase Auth**:
  - Weryfikacja tokenów JWT
  - Ekstrakcja danych użytkownika z tokenu (uid, roles)

#### Frontend ↔ Backend
- **HTTP Client (Angular)**:
  - Poprawne przekazywanie nagłówków Authorization
  - Obsługa błędów HTTP (401, 403, 404, 500)
  - Interceptory: dodawanie tokenu, obsługa refresh token

**Przykładowe scenariusze**:
- Użytkownik z rolą editor tworzy zamówienie → backend zapisuje z `created_by = user.id`
- Żądanie GET /api/orders?page=2&limit=10&sort=orderDate:desc zwraca poprawną stronę wyników
- Próba utworzenia zamówienia z duplikowanym `orderNo` zwraca 409 Conflict

---

### 3.3. Testy end-to-end (E2E Tests)

**Cel**: weryfikacja pełnych ścieżek użytkownika w środowisku zbliżonym do produkcyjnego.

**Technologie**:
- Playwright (projekt `web-e2e`)
- Uruchomienie pełnego stacku: Angular (localhost:4200) + NestJS (localhost:3000) + Supabase

**Zakres**:

#### Ścieżki krytyczne (Happy Paths)
1. **Logowanie i nawigacja**:
   - Użytkownik loguje się → przekierowanie do dashboard → sprawdzenie czy widoczne menu

2. **Tworzenie zamówienia**:
   - Nawigacja do Orders → kliknięcie "Nowe zamówienie"
   - Wypełnienie formularza (wybór klienta, data, numer zamówienia, pozycja, ilość, ceny, VAT)
   - Zapisanie → sprawdzenie czy zamówienie pojawia się na liście

3. **Edycja zamówienia**:
   - Otworzenie istniejącego zamówienia → edycja pola (np. quantity)
   - Zapisanie → weryfikacja czy zmiany są widoczne

4. **Filtrowanie i sortowanie listy zamówień**:
   - Wybór filtra po dacie (dateFrom, dateTo)
   - Sortowanie po kolumnie (orderDate desc)
   - Zmiana strony paginacji

5. **Usuwanie zamówienia**:
   - Kliknięcie "Usuń" → potwierdzenie → sprawdzenie czy zamówienie znika z listy
   - Użytkownik owner włącza "includeDeleted" → zamówienie jest widoczne z flagą deleted

7. **Dashboard i analityka**:
   - Wyświetlenie KPI (suma sprzedaży, liczba zamówień)
   - Filtrowanie analityki po zakresie dat
   - Sprawdzenie wykresów (jeśli są w MVP)

#### Ścieżki negatywne
- Próba dostępu do /orders bez logowania → przekierowanie do /login
- Użytkownik viewer próbuje utworzyć zamówienie → brak przycisku "Nowe zamówienie" lub komunikat błędu
- Formularz zamówienia: pozostawienie wymaganych pól pustych → komunikaty walidacyjne
- Wprowadzenie niepoprawnych danych (np. ujemna quantity) → komunikat błędu

#### Testy uprawnień (Role-Based Access)
- Viewer: może przeglądać zamówienia i klientów, NIE może edytować
- Editor: może tworzyć, edytować, usuwać zamówienia
- Owner: ma dostęp do wszystkich funkcji

**Przykładowe scenariusze**:
```gherkin
Scenario: Editor tworzy nowe zamówienie w PLN
  Given użytkownik jest zalogowany jako editor
  When nawiguje do strony Orders
  And klika przycisk "Nowe zamówienie"
  And wypełnia formularz:
    | Pole              | Wartość           |
    | Klient            | Firma ABC         |
    | Numer zamówienia  | ORD-2025-001      |
    | Data              | 2025-11-08        |
    | Nazwa pozycji     | Laptop Dell       |
    | Ilość             | 5                 |
    | Waluta            | PLN               |
    | Cena netto        | 10000.00          |
    | VAT (%)           | 23                |
  And klika "Zapisz"
  Then zamówienie jest zapisane
  And widoczne na liście zamówień
  And totalGrossPln = 12300.00

Scenario: Viewer nie może usunąć zamówienia
  Given użytkownik jest zalogowany jako viewer
  When otwiera szczegóły zamówienia
  Then przycisk "Usuń" jest niewidoczny lub zablokowany
```

---

### 3.4. Testy API (API Testing)

**Cel**: weryfikacja kontraktu API zgodnie z dokumentacją Swagger.

**Narzędzia**:
- Insomnia / Postman
- Supertest w testach integracyjnych

**Zakres**:

#### Struktura odpowiedzi
- Sprawdzenie zgodności schematów JSON z definicjami Swagger
- Typy danych pól (UUID, string, number, boolean, ISO dates)
- Paginacja: struktura `PaginatedResponse<T>` (data, total, page, limit, totalPages)

#### Status codes HTTP
- 200 OK: pomyślne pobranie danych
- 201 Created: utworzenie zasobu + nagłówek Location
- 204 No Content: pomyślne usunięcie
- 400 Bad Request: błędne dane wejściowe (walidacja)
- 401 Unauthorized: brak lub nieprawidłowy token
- 403 Forbidden: brak uprawnień
- 404 Not Found: zasób nie istnieje
- 409 Conflict: konflikt (np. duplicate orderNo)
- 500 Internal Server Error: nieoczekiwany błąd serwera

#### Dokumentacja Swagger
- Wszystkie endpointy są udokumentowane
- Parametry (@ApiParam, @ApiQuery) mają opisy
- Schematy DTOs (@ApiProperty) są kompletne
- Przykłady (examples) są aktualne

**Przykładowe scenariusze**:
- GET /api/orders?page=1&limit=25 zwraca JSON zgodny z `ListOrdersResponseDto`
- POST /api/orders z niepoprawnym UUID customerId zwraca 400 z polem `details` opisującym błąd
- DELETE /api/orders/:orderId zwraca 204 i nagłówek `Cache-Control: no-store`

---

### 3.5. Testy bezpieczeństwa (Security Tests)

**Cel**: weryfikacja zabezpieczeń aplikacji przed nieautoryzowanym dostępem i manipulacją danych.

**Zakres**:

#### Autentykacja i autoryzacja
- **JWT Token**:
  - Brak tokenu → 401 Unauthorized
  - Wygasły token → 401 Unauthorized
  - Token z niepoprawnym podpisem → 401 Unauthorized
  - Token bez wymaganych roli → 403 Forbidden

- **Role-Based Access Control (RBAC)**:
  - Viewer nie może wykonywać operacji POST, PUT, DELETE
  - Editor nie może odczytać audit log
  - Owner ma pełen dostęp

#### Row Level Security (RLS) w Supabase
- Użytkownik może odczytać tylko aktywne zamówienia (deleted_at IS NULL)
- Użytkownik może aktualizować tylko własne zamówienia (created_by = auth.uid())
- Anonymous nie ma dostępu do żadnych tabel

#### Walidacja i sanityzacja danych
- **SQL Injection**: użycie parametryzowanych zapytań (Supabase + TypeORM)
- **XSS**: sprawdzenie escapowania w Angular (domyślnie Angular sanityzuje HTML)
- **CSRF**: tokeny sesji w HttpOnly cookies

#### Ochrona wrażliwych danych
- Hasła nigdy nie są przesyłane w odpowiedziach API (zarządzane przez Supabase Auth)
- Logi nie zawierają pełnych orderID (maskowanie `maskOrderId()`)

**Przykładowe scenariusze**:
- Test: próba utworzenia zamówienia z `deletedAt` inną niż null → walidacja backend zwraca błąd

---

### 3.6. Testy wydajnościowe (Performance Tests)

**Cel**: weryfikacja czy aplikacja spełnia wymagania wydajnościowe pod obciążeniem.

**Narzędzia**:
- k6 / Artillery (load testing)
- Chrome DevTools Lighthouse (frontend performance)

**Zakres**:

#### Backend (API)
- **Czas odpowiedzi**:
  - GET /api/orders (limit=25): < 200ms
  - POST /api/orders: < 300ms
  - GET /api/orders/:orderId: < 100ms

- **Obciążenie**:
  - 50 równoczesnych użytkowników przeglądających zamówienia
  - 10 równoczesnych importów XLSX (po 100 zamówień każdy)
  - Stabilność po 1000 żądań/minutę przez 5 minut

- **Baza danych**:
  - Wydajność zapytań z filtrowaniem i sortowaniem
  - Indeksy: sprawdzenie czy są wykorzystywane (EXPLAIN ANALYZE)

#### Frontend (Angular)
- **Time to Interactive (TTI)**: < 3s
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Bundle size**: main.js < 500KB (gzipped)

**Przykładowe scenariusze**:
- Test: otworzenie strony Orders z 10000 zamówień (z paginacją) → sprawdzenie czasu renderowania

---

### 3.7. Testy użyteczności (Usability Tests)

**Cel**: weryfikacja intuicyjności i ergonomii interfejsu użytkownika.

**Metody**:
- Testy eksploracyjne
- Sesje z użytkownikami końcowymi
- Analiza UX (user experience)

**Zakres**:

#### Nawigacja
- Struktura menu jest zrozumiała
- Breadcrumbs są widoczne i funkcjonalne
- Przyciski akcji (Zapisz, Anuluj, Usuń) są łatwo dostępne

#### Formularze
- Pola są odpowiednio oznaczone (wymagane vs opcjonalne)
- Komunikaty walidacyjne są jasne i pomocne
- Autouzupełnianie dla list (np. wybór klienta)
- Date picker dla pól dat

#### Komunikaty użytkownika
- Powiadomienia sukcesu (np. "Zamówienie zostało zapisane")
- Komunikaty błędów są zrozumiałe (nie tylko kody techniczne)
- Loading indicators dla operacji asynchronicznych

#### Responsywność
- Aplikacja działa na urządzeniach desktop (priorytet dla MVP)
- Layout nie jest zepsuty na różnych rozdzielczościach (1366x768, 1920x1080)

**Przykładowe scenariusze**:
- Użytkownik bez doświadczenia technicznego powinien umieć utworzyć zamówienie w < 2 minuty
- Komunikat walidacyjny "Pole orderNo jest wymagane" jest bardziej użyteczny niż "Validation failed: [orderNo]"

---

### 3.8. Testy regresji (Regression Tests)

**Cel**: upewnienie się, że nowe zmiany nie wprowadzają błędów do istniejącej funkcjonalności.

**Strategia**:
- Automatyzacja testów E2E dla ścieżek krytycznych (CI/CD)
- Re-run testów jednostkowych i integracyjnych przy każdym PR
- Regression test suite obejmująca:
  - Tworzenie, edycja, usuwanie zamówień
  - Kalkulacja kwot
  - Filtrowanie i sortowanie list
  - Autentykacja i autoryzacja

**Wyzwalacze**:
- Każdy commit do brancha `develop` lub `master`
- Pull Requesty
- Przed każdym release

---

### 3.9. Testy kompatybilności (Compatibility Tests)

**Cel**: weryfikacja działania aplikacji w różnych środowiskach.

**Zakres**:

#### Przeglądarki (dla frontenu Angular)
- Google Chrome (wersja bieżąca i bieżąca-1)
- Mozilla Firefox (wersja bieżąca)
- Microsoft Edge (wersja bieżąca)
- Safari (jeśli docelowi użytkownicy używają macOS)

#### Systemy operacyjne
- Windows 10/11
- macOS (jeśli jest w zakresie)
- Linux (jeśli jest w zakresie)

#### Node.js
- Node.js 18 LTS (minimalna wspierana wersja)
- Node.js 20 LTS (zalecana wersja)

**Uwaga**: MVP skupia się na środowisku desktop, testy mobilne mogą być pominięte.

---

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1. Moduł Zamówień (Orders)

#### 4.1.1. Tworzenie zamówienia - PLN

**ID**: TC-ORD-001  
**Priorytet**: Krytyczny  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik loguje się jako editor
2. Nawiguje do /orders
3. Klika "Nowe zamówienie"
4. Wypełnia formularz:
   - Klient: wybiera z listy (np. "Firma ABC")
   - Numer zamówienia: `ORD-TEST-001`
   - Data: `2025-11-08`
   - Nazwa pozycji: `Laptop Dell`
   - Ilość: `10`
   - Waluta: `PLN`
   - Rabat producenta (%): `5`
   - Rabat dystrybutora (%): `3`
   - Cena netto (PLN): `50000.00`
   - Stawka VAT (%): `23`
5. Klika "Zapisz"

**Oczekiwany rezultat**:
- Formularz jest zatwierdzony bez błędów
- Zamówienie jest zapisane w bazie danych
- `totalGrossPln` jest obliczone poprawnie: `50000.00 * 1.23 = 61500.00`
- Użytkownik widzi komunikat sukcesu
- Zamówienie pojawia się na liście zamówień

---

#### 4.1.2. Tworzenie zamówienia - EUR

**ID**: TC-ORD-002  
**Priorytet**: Wysoki  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik loguje się jako editor
2. Nawiguje do /orders → "Nowe zamówienie"
3. Wypełnia formularz:
   - Klient: `Firma XYZ`
   - Numer zamówienia: `ORD-EUR-001`
   - Data: `2025-11-08`
   - Nazwa pozycji: `Serwer HP`
   - Ilość: `2`
   - Waluta: `EUR`
   - Kurs EUR: `4.35`
   - Rabat producenta (%): `0`
   - Rabat dystrybutora (%): `0`
   - Cena netto (PLN): `20000.00` (obliczone z EUR)
   - Cena brutto (EUR): `5000.00`
   - Stawka VAT (%): `23`
4. Klika "Zapisz"

**Oczekiwany rezultat**:
- `isEur = true`
- `eurRate = 4.35`
- `totalGrossEur = 5000.00`
- `totalGrossPln` jest obliczone z kursu: `~21750.00` (z VAT)
- Walidacja sprawdza zgodność kwot z tolerancją 0.01

---

#### 4.1.3. Walidacja - duplikat orderNo

**ID**: TC-ORD-003  
**Priorytet**: Wysoki  
**Typ**: Negatywny, Integracyjny

**Kroki**:
1. Użytkownik tworzy zamówienie z `orderNo = "ORD-DUP-001"`
2. Zamówienie zostaje zapisane
3. Użytkownik próbuje utworzyć drugie zamówienie z tym samym `orderNo = "ORD-DUP-001"`

**Oczekiwany rezultat**:
- Backend zwraca `409 Conflict`
- Komunikat błędu: `"Zamówienie o podanym numerze już istnieje."`
- Frontend wyświetla komunikat walidacyjny
- Zamówienie nie jest zapisane

---

#### 4.1.4. Walidacja - brak pola eurRate dla zamówienia EUR

**ID**: TC-ORD-004  
**Priorytet**: Wysoki  
**Typ**: Negatywny, Jednostkowy

**Kroki**:
1. Backend: wywołanie `OrdersService.create()` z:
   - `isEur = true`
   - `eurRate = null`

**Oczekiwany rezultat**:
- `BadRequestException` z kodem `ORDERS_CREATE_VALIDATION`
- Komunikat: `"Pole eurRate jest wymagane, gdy zamówienie rozliczane jest w EUR."`

---

#### 4.1.5. Edycja zamówienia

**ID**: TC-ORD-005  
**Priorytet**: Krytyczny  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik loguje się jako editor
2. Otwiera istniejące zamówienie `ORD-TEST-001`
3. Zmienia ilość z `10` na `15`
4. Klika "Zapisz"

**Oczekiwany rezultat**:
- Zamówienie jest zaktualizowane
- `updatedAt` jest aktualizowane automatycznie (trigger)
- Audit log zawiera wpis UPDATE z `oldRow` i `newRow`
- `totalGrossPln` jest przeliczone (jeśli zależy od quantity)

---

#### 4.1.6. Soft-delete zamówienia

**ID**: TC-ORD-006  
**Priorytet**: Wysoki  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik editor otwiera zamówienie `ORD-TEST-001`
2. Klika "Usuń"
3. Potwierdza usunięcie w dialogu

**Oczekiwany rezultat**:
- Backend ustawia `deletedAt = CURRENT_TIMESTAMP`
- Zamówienie znika z domyślnej listy (deleted_at IS NULL)
- Użytkownik owner może włączyć `includeDeleted=true` i zobaczyć zamówienie
- Audit log zawiera wpis UPDATE (nie DELETE, bo to soft-delete)

---

#### 4.1.7. Filtrowanie zamówień po dacie

**ID**: TC-ORD-007  
**Priorytet**: Średni  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik nawiguje do /orders
2. Ustawia filtr:
   - Data od: `2025-01-01`
   - Data do: `2025-03-31`
3. Klika "Filtruj"

**Oczekiwany rezultat**:
- Lista zawiera tylko zamówienia z `orderDate` w przedziale [2025-01-01, 2025-03-31]
- Query param w URL: `?dateFrom=2025-01-01&dateTo=2025-03-31`

---

#### 4.1.8. Sortowanie zamówień

**ID**: TC-ORD-008  
**Priorytet**: Średni  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik otwiera listę zamówień
2. Klika nagłówek kolumny "Data zamówienia"
3. Sortowanie zmienia się na `orderDate:asc`
4. Klika ponownie → zmienia się na `orderDate:desc`

**Oczekiwany rezultat**:
- Lista jest sortowana rosnąco/malejąco
- Query param: `?sort=orderDate:asc` / `?sort=orderDate:desc`
- Backend używa `SORT_PARSER` do parsowania sortowania

---

#### 4.1.9. Paginacja

**ID**: TC-ORD-009  
**Priorytet**: Średni  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik otwiera listę zamówień (zakładając > 25 zamówień)
2. Widzi stronę 1 z 25 zamówieniami
3. Klika "Następna strona"

**Oczekiwany rezultat**:
- Wyświetlana jest strona 2
- Query param: `?page=2&limit=25`
- Response zawiera: `{ data: [...], total, page: 2, limit: 25, totalPages }`

---

### 4.2. Moduł Klientów (Customers)

#### 4.2.1. Tworzenie klienta

**ID**: TC-CUST-001  
**Priorytet**: Wysoki  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik editor nawiguje do /customers
2. Klika "Nowy klient"
3. Wypełnia formularz:
   - Nazwa: `Firma Test Sp. z o.o.`
4. Klika "Zapisz"

**Oczekiwany rezultat**:
- Klient jest zapisany
- `isActive = true`, `deletedAt = null`
- Klient pojawia się na liście

---

#### 4.2.2. Walidacja - duplikat nazwy klienta (case-insensitive)

**ID**: TC-CUST-002  
**Priorytet**: Wysoki  
**Typ**: Negatywny, Integracyjny

**Kroki**:
1. Użytkownik tworzy klienta `Firma ABC`
2. Użytkownik próbuje utworzyć drugiego klienta `firma abc` (lowercase)

**Oczekiwany rezultat**:
- Backend zwraca `409 Conflict`
- Komunikat: `"Klient o podanej nazwie już istnieje."`
- Unikalność jest wymuszana przez index `customers_lower_name_idx`

---

#### 4.2.3. Soft-delete klienta

**ID**: TC-CUST-003  
**Priorytet**: Średni  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik editor otwiera klienta `Firma ABC`
2. Klika "Dezaktywuj"
3. Potwierdza

**Oczekiwany rezultat**:
- `isActive = false`, `deletedAt = CURRENT_TIMESTAMP`
- Klient znika z domyślnej listy
- Nie można przypisać tego klienta do nowego zamówienia (walidacja)

---

### 4.3. Moduł Autentykacji (Auth)

#### 4.3.1. Logowanie - poprawne dane

**ID**: TC-AUTH-001  
**Priorytet**: Krytyczny  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik otwiera /login
2. Wprowadza:
   - Email: `editor@test.com`
   - Hasło: `Test123!`
3. Klika "Zaloguj"

**Oczekiwany rezultat**:
- Backend wywołuje Supabase Auth
- Otrzymany JWT token jest zapisany w pamięci aplikacji (lub localStorage/sessionStorage)
- Użytkownik jest przekierowany do /dashboard
- Menu nawigacyjne jest widoczne

---

#### 4.3.2. Logowanie - niepoprawne hasło

**ID**: TC-AUTH-002  
**Priorytet**: Wysoki  
**Typ**: Negatywny, Funkcjonalny

**Kroki**:
1. Użytkownik wprowadza:
   - Email: `editor@test.com`
   - Hasło: `WrongPassword`
2. Klika "Zaloguj"

**Oczekiwany rezultat**:
- Backend zwraca `401 Unauthorized`
- Komunikat: `"Nieprawidłowy email lub hasło"`
- Użytkownik pozostaje na stronie /login

---

#### 4.3.3. Wylogowanie

**ID**: TC-AUTH-003  
**Priorytet**: Wysoki  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Zalogowany użytkownik klika "Wyloguj"

**Oczekiwany rezultat**:
- Token JWT jest usuwany
- Użytkownik jest przekierowany do /login
- Próba dostępu do /orders bez tokenu → przekierowanie do /login

---

#### 4.3.4. Dostęp bez tokenu

**ID**: TC-AUTH-004  
**Priorytet**: Krytyczny  
**Typ**: Bezpieczeństwo, Integracyjny

**Kroki**:
1. Użytkownik (niezalogowany) próbuje otworzyć `GET /api/orders`

**Oczekiwany rezultat**:
- Backend zwraca `401 Unauthorized`
- `JwtAuthGuard` blokuje żądanie

---

### 4.5. Moduł Analityki (Analytics)

#### 4.5.1. Dashboard - wyświetlanie KPI

**ID**: TC-ANLY-001  
**Priorytet**: Średni  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik otwiera /dashboard
2. Widzi kafelki z KPI:
   - Suma sprzedaży (PLN): X
   - Liczba zamówień: Y
   - Średnia wartość zamówienia: Z

**Oczekiwany rezultat**:
- KPI są obliczone poprawnie na podstawie aktywnych zamówień (deleted_at IS NULL)
- Wartości są aktualne

---

#### 4.5.2. Filtrowanie analityki po dacie

**ID**: TC-ANLY-002  
**Priorytet**: Średni  
**Typ**: Funkcjonalny, E2E

**Kroki**:
1. Użytkownik ustawia filtr daty: 2025-01-01 do 2025-03-31
2. KPI są przeliczane

**Oczekiwany rezultat**:
- KPI uwzględniają tylko zamówienia z tego okresu
- Backend query filtruje po `orderDate`
---

## 5. Środowisko testowe

### 5.1. Środowiska

| Środowisko | Przeznaczenie | URL / Konfiguracja |
|------------|---------------|---------------------|
| **Lokalne (Dev)** | Rozwój i testy deweloperskie | `http://localhost:4200` (Angular)<br>`http://localhost:3000` (NestJS)<br>Supabase: instancja lokalna lub testowa |
| **CI/CD** | Automatyczne testy przy PR | GitHub Actions + Supabase test project |
| **Staging** | Testy akceptacyjne przed release | `https://staging.salesanalysis.com` (przykład) |
| **Produkcja** | Środowisko końcowe | `https://app.salesanalysis.com` (przykład) |

### 5.2. Wymagania sprzętowe i programowe

#### Lokalne środowisko deweloperskie
- **OS**: Windows 10/11, macOS, Linux
- **Node.js**: 20 LTS (minimum 18 LTS)
- **npm**: ≥ 9
- **RAM**: minimum 8GB (zalecane 16GB dla Nx cache)
- **Dysk**: 5GB wolnego miejsca

#### Narzędzia
- **IDE**: Visual Studio Code / WebStorm
- **Przeglądarki**: Chrome, Firefox, Edge (najnowsze wersje)
- **Git**: wersja ≥ 2.30
- **Docker**: (opcjonalnie, dla lokalnej instancji Supabase)

### 5.3. Dane testowe

#### Użytkownicy testowi
| Email | Hasło | Role | Opis |
|-------|-------|------|------|
| viewer@test.com | Test123! | viewer | Użytkownik tylko do odczytu |
| editor@test.com | Test123! | editor | Użytkownik z uprawnieniami edycji |
| owner@test.com | Test123! | owner | Administrator |

#### Klienci testowi
- Firma ABC Sp. z o.o.
- Firma XYZ S.A.
- Test Customer Ltd.

#### Zamówienia testowe
- Minimum 100 zamówień w różnych okresach (2024-2025)
- Mix zamówień PLN i EUR
- Różne statusy (aktywne, usunięte)
- Różni klienci

### 5.4. Konfiguracja Supabase

#### Baza danych testowa
- **Project**: SalesAnalysis Test
- **Region**: eu-central-1 (lub najbliższy)
- **PostgreSQL**: wersja 15+
- **Extensions**: citext, pgcrypto
- **Migracje**: automatyczne uruchomienie z `supabase/migrations/`

#### Konfiguracja RLS
- Polityki RLS są aktywne na wszystkich tabelach
- Service role (backend) ma pełen dostęp (bypasses RLS)
- Authenticated role (frontend) podlega RLS

### 5.5. Zmienne środowiskowe

#### Backend (NestJS)
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (tylko backend)
JWT_SECRET=your-jwt-secret
PORT=3000
NODE_ENV=test
```

#### Frontend (Angular)
```env
API_BASE_URL=http://localhost:3000/api
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 6. Narzędzia do testowania

### 6.1. Testy jednostkowe i integracyjne

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **Vitest** | Testy jednostkowe (backend + frontend) | `npx nx test web`<br>`npx nx test api` |
| **@analogjs/vitest-angular** | Adapter Vitest dla Angular | Integracja z komponentami Angular |
| **Jest** | Testy E2E API | `npx nx e2e api-e2e` |
| **Supertest** | HTTP assertions dla testów API | Używane w `api-e2e` |

### 6.2. Testy E2E

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **Playwright** | Testy E2E frontend | `npx nx e2e web-e2e` |
| **@playwright/test** | Framework do testów Playwright | Konfiguracja w `playwright.config.ts` |

### 6.3. Linting i formatowanie

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **ESLint 9** | Statyczna analiza kodu | `npx nx lint web`<br>`npx nx lint api` |
| **Prettier** | Formatowanie kodu | `npx prettier --write .` |
| **TypeScript** | Sprawdzanie typów | `npx tsc --noEmit` |

### 6.4. Testy API i dokumentacja

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **Swagger** | Dokumentacja API + ręczne testowanie | `http://localhost:3000/api/docs` |
| **Postman** | Testy manualne API (opcjonalnie) | Kolekcje dla każdego modułu |

### 6.5. Testy wydajnościowe

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **k6** | Load testing API | `k6 run load-test.js` |
| **Chrome DevTools Lighthouse** | Performance audit frontend | DevTools → Lighthouse |

### 6.6. CI/CD

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **GitHub Actions** | Automatyzacja testów w pipeline | `.github/workflows/ci.yml` |
| **Nx Cloud** | Cache dla Nx builds/tests | `npx nx affected:test` |

### 6.7. Pokrycie kodu (Coverage)

| Narzędzie | Przeznaczenie | Użycie |
|-----------|---------------|--------|
| **@vitest/coverage-v8** | Code coverage dla Vitest | `npx nx test web --coverage` |

---

## 7. Harmonogram testów

### 7.1. Fazy testowania

| Faza | Czas trwania | Typy testów | Odpowiedzialny |
|------|--------------|-------------|----------------|
| **1. Testy deweloperskie** | Ciągłe (podczas developmentu) | Unit, integracyjne (lokalne) | Deweloperzy |
| **2. Testy CI/CD** | Automatyczne przy PR | Unit, integracyjne, lint | GitHub Actions |
| **3. Testy funkcjonalne** | 3 dni | E2E, API | Zespół QA |
| **4. Testy bezpieczeństwa** | 2 dni | Security, RLS, RBAC | Zespół QA + Security Lead |
| **5. Testy wydajnościowe** | 2 dni | Load testing, performance | Zespół QA |
| **6. Testy akceptacyjne** | 3 dni | UAT (User Acceptance Testing) | Product Owner + końcowi użytkownicy |
| **7. Testy regresji** | 1 dzień | E2E (krytyczne ścieżki) | Zespół QA |
| **8. Smoke tests na produkcji** | 2 godziny | Podstawowe E2E | Zespół QA |

### 7.2. Przykładowy harmonogram dla sprintu (2 tygodnie)

| Dzień | Aktywność testowania |
|-------|----------------------|
| **Sprint Day 1-8** | Testy jednostkowe i integracyjne przez deweloperów<br>Automatyczne testy CI/CD przy każdym PR |
| **Sprint Day 9** | Rozpoczęcie testów funkcjonalnych (E2E) przez QA<br>Regresja dla nowych features |
| **Sprint Day 10** | Kontynuacja testów E2E<br>Testy bezpieczeństwa dla zmian związanych z auth/roles |
| **Sprint Day 11** | Testy wydajnościowe dla zmienionych endpointów<br>Code review wyników testów |
| **Sprint Day 12** | UAT z Product Ownerem<br>Bug fixing na podstawie feedbacku |
| **Sprint Day 13** | Testy regresji<br>Weryfikacja poprawionych błędów |
| **Sprint Day 14** | Final smoke tests<br>Przygotowanie do release (jeśli wszystkie testy przeszły) |

### 7.3. Automatyzacja testów w CI/CD

**GitHub Actions Workflow** (`.github/workflows/ci.yml`):
```yaml
name: CI
on: [pull_request, push]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npx nx affected:lint --base=origin/master
      - run: npx nx affected:test --base=origin/master --coverage
      - run: npx nx affected:e2e --base=origin/master
```

---

## 8. Kryteria akceptacji testów

### 8.1. Kryteria akceptacji dla poszczególnych typów testów

#### 8.1.1. Testy jednostkowe
- **Pokrycie kodu**: minimum 70% dla warstwy biznesowej (services, mappers, guards)
- **Pass rate**: 100% (wszystkie testy muszą przejść)
- **Czas wykonania**: maksymalnie 2 minuty dla wszystkich testów jednostkowych

#### 8.1.2. Testy integracyjne
- **Pass rate**: 100%
- **Scenariusze krytyczne**: wszystkie muszą przejść (tworzenie zamówień, auth, RLS)
- **Czas wykonania**: maksymalnie 5 minut

#### 8.1.3. Testy E2E
- **Pass rate**: minimum 95% (niektóre flaky tests mogą być re-run)
- **Ścieżki krytyczne**: 100% musi przejść (logowanie, tworzenie zamówień, filtrowanie)
- **Czas wykonania**: maksymalnie 15 minut

#### 8.1.4. Testy API
- **Pass rate**: 100%
- **Zgodność ze Swagger**: wszystkie endpointy muszą być zgodne z dokumentacją
- **Response time**: 95% żądań < 500ms

#### 8.1.5. Testy bezpieczeństwa
- **Wszystkie testy autoryzacji**: 100% pass rate
- **RLS**: brak przypadków obejścia polityk bezpieczeństwa
- **Brak krytycznych podatności**: (SQL injection, XSS, CSRF)

#### 8.1.6. Testy wydajnościowe
- **API response time**: 95th percentile < 500ms
- **Frontend load time**: LCP < 2.5s
- **Throughput**: minimum 100 żądań/sekundę bez błędów

### 8.2. Kryteria Go/No-Go dla release

**GO** (można wypuścić release) jeśli:
- ✅ Wszystkie testy jednostkowe i integracyjne przechodzą (100%)
- ✅ Testy E2E dla ścieżek krytycznych przechodzą (100%)
- ✅ Brak błędów krytycznych (Severity: Critical/High)
- ✅ Pokrycie kodu ≥ 70%
- ✅ Wszystkie testy bezpieczeństwa przeszły
- ✅ UAT zakończony pozytywnie (Product Owner approval)
- ✅ Smoke tests na staging przeszły

**NO-GO** (wstrzymanie release) jeśli:
- ❌ Jakikolwiek test krytycznej ścieżki nie przechodzi
- ❌ Istnieją nierozwiązane błędy o priorytecie Critical
- ❌ Testy bezpieczeństwa wykryły podatności High/Critical
- ❌ Wydajność poniżej wymagań (response time > 1s dla 95% żądań)
- ❌ UAT nie został zatwierdzony przez Product Ownera

### 8.3. Definicja błędów

| Severity | Definicja | Przykłady | Wpływ na release |
|----------|-----------|-----------|-------------------|
| **Critical** | Całkowita blokada kluczowej funkcjonalności | - Nie można się zalogować<br>- Crash aplikacji<br>- Utrata danych | **BLOCK** release |
| **High** | Poważny błąd w ważnej funkcjonalności | - Niepoprawna kalkulacja kwot<br>- Brak autoryzacji | **BLOCK** release |
| **Medium** | Błąd w funkcjonalności, istnieje workaround | - Błąd w filtrowaniu<br>- Niepoprawne sortowanie | Może czekać do następnego release |
| **Low** | Drobny błąd UX/UI | - Literówka<br>- Niewłaściwy kolor przycisku | Może czekać do następnego release |

### 8.4. Metryki jakości

| Metryka | Cel | Pomiar |
|---------|-----|--------|
| **Code coverage** | ≥ 70% | `npx nx test --coverage` |
| **Test pass rate** | 100% (unit/integration)<br>95% (E2E) | CI/CD reports |
| **Defect density** | < 5 defects / 1000 LOC | Issue tracker |
| **Mean time to detect (MTTD)** | < 1 dzień | Od wprowadzenia błędu do wykrycia |
| **Mean time to resolve (MTTR)** | < 3 dni (Critical)<br>< 7 dni (High) | Od zgłoszenia do fix |

---

## 9. Role i odpowiedzialności w procesie testowania

### 9.1. Zespół testowy

| Rola | Odpowiedzialności | Narzędzia |
|------|-------------------|-----------|
| **QA Lead** | - Nadzór nad strategią testowania<br>- Raportowanie do Product Ownera<br>- Decyzja Go/No-Go | JIRA, Test reports |
| **QA Engineer** | - Tworzenie test cases<br>- Wykonywanie testów E2E, API<br>- Raportowanie błędów | Playwright, Postman, JIRA |
| **Automation Engineer** | - Tworzenie testów automatycznych<br>- Utrzymanie CI/CD pipeline | Vitest, Jest, GitHub Actions |
| **Security Tester** | - Testy bezpieczeństwa (auth, RLS)<br>- Audyt kodu pod kątem podatności | OWASP tools, manual testing |

### 9.2. Zespół deweloperski

| Rola | Odpowiedzialności testowe |
|------|---------------------------|
| **Backend Developer** | - Testy jednostkowe services/repositories<br>- Testy integracyjne API<br>- Fixing błędów wykrytych przez QA |
| **Frontend Developer** | - Testy jednostkowe komponentów/services<br>- Testy integracyjne HTTP client<br>- Fixing błędów UI/UX |
| **DevOps Engineer** | - Konfiguracja CI/CD<br>- Utrzymanie środowisk testowych (staging)<br>- Monitoring wydajności |

### 9.3. Inne role

| Rola | Odpowiedzialności |
|------|-------------------|
| **Product Owner** | - Definiowanie kryteriów akceptacji<br>- UAT (User Acceptance Testing)<br>- Finalna decyzja Go/No-Go |
| **End Users (testers)** | - UAT w środowisku staging<br>- Feedback nt. użyteczności |

### 9.4. Matryca RACI

| Aktywność | QA Lead | QA Engineer | Auto Engineer | Backend Dev | Frontend Dev | PO |
|-----------|---------|-------------|---------------|-------------|--------------|-----|
| Tworzenie test planu | **R** | **C** | **C** | **I** | **I** | **A** |
| Pisanie testów jednostkowych | **I** | **I** | **C** | **R** | **R** | **I** |
| Pisanie testów E2E | **C** | **R** | **R** | **I** | **I** | **I** |
| Wykonywanie testów manualnych | **C** | **R** | **I** | **I** | **I** | **I** |
| Raportowanie błędów | **C** | **R** | **R** | **I** | **I** | **I** |
| Fixing błędów | **I** | **I** | **I** | **R** | **R** | **I** |
| UAT | **C** | **C** | **I** | **I** | **I** | **R/A** |
| Decyzja Go/No-Go | **R** | **C** | **C** | **I** | **I** | **A** |

**Legenda**:
- **R** - Responsible (wykonuje)
- **A** - Accountable (odpowiedzialny ostatecznie)
- **C** - Consulted (konsultowany)
- **I** - Informed (informowany)

---

## 11. Podsumowanie i wnioski

### 11.1. Kluczowe wyzwania testowe

1. **Architektura monorepo**:
   - Konieczność testowania zależności między projektami (shared types)
   - Wykorzystanie Nx affected do optymalizacji testów

2. **Integracja z Supabase**:
   - Testowanie RLS (Row Level Security) wymaga dedykowanych testów na poziomie bazy
   - Zarządzanie danymi testowymi w PostgreSQL

3. **Kalkulacje kwot**:
   - Krytyczna funkcjonalność biznesowa wymagająca precyzyjnych testów
   - Testowanie edge cases (zaokrąglenia, tolerancja 0.01)

### 11.2. Najważniejsze rekomendacje

1. **Priorytet dla testów automatycznych**:
   - Minimum 70% pokrycia kodu testami jednostkowymi
   - Automatyzacja ścieżek krytycznych w E2E (logowanie, zamówienia, filtrowanie)

2. **Testy bezpieczeństwa jako priorytet**:
   - Regularne audyty RLS i RBAC
   - Testy penetracyjne (opcjonalnie zewnętrzny audyt)

3. **Continuous Testing w CI/CD**:
   - Uruchomienie testów przy każdym PR
   - Blokowanie merge jeśli testy nie przechodzą

4. **Monitoring pokrycia kodu**:
   - Dashboard z metrykami (coverage, pass rate, defect density)
   - Regularne review wyników testów

5. **Współpraca QA ↔ Dev**:
   - Pair programming dla złożonych test cases
   - Early involvement QA w planowaniu sprintu

### 11.3. Dalsze kroki

1. **Implementacja infrastruktury testowej** (Sprint 1-2):
   - Konfiguracja Playwright dla E2E
   - Utworzenie test data seeds
   - Setup Supabase test project

2. **Tworzenie test suite** (Sprint 2-4):
   - Testy jednostkowe dla istniejących modułów
   - Testy E2E dla ścieżek krytycznych
   - Testy API zgodnie z Swagger

3. **Automatyzacja CI/CD** (Sprint 3):
   - GitHub Actions workflow
   - Integracja z Nx Cloud
   - Coverage reporting

4. **Testy bezpieczeństwa** (Sprint 4):
   - Audyt RLS policies
   - Testy RBAC
   - Penetration testing (opcjonalnie)

5. **Optymalizacja wydajności** (Sprint 5):
   - Load testing
   - Frontend performance audit (Lighthouse)
   - Optymalizacja zapytań bazodanowych

### 11.4. Metryki sukcesu projektu testowego

Po zakończeniu implementacji planu testów sukces będzie mierzony:

- ✅ **Code coverage ≥ 70%**
- ✅ **Pass rate testów automatycznych ≥ 95%**
- ✅ **Brak Critical/High bugs na produkcji przez 30 dni**
- ✅ **Response time API p95 < 500ms**
- ✅ **Frontend LCP < 2.5s**
- ✅ **Zero incydentów bezpieczeństwa**

---

## Załączniki

### A. Referencje technologiczne

- [Angular Testing Guide](https://angular.io/guide/testing)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Supabase Testing](https://supabase.com/docs/guides/testing)
- [Nx Testing](https://nx.dev/concepts/more-concepts/nx-and-ci)

### B. Checklisty testowe

**Checklist przed rozpoczęciem testów E2E**:
- [ ] Środowisko testowe działa (Angular + NestJS + Supabase)
- [ ] Dane testowe załadowane (użytkownicy, klienci, zamówienia)
- [ ] Wszystkie endpointy dostępne (sprawdzenie Swagger)
- [ ] Przeglądarki zainstalowane (Chrome, Firefox)

**Checklist przed release**:
- [ ] Wszystkie testy jednostkowe przeszły (100%)
- [ ] Wszystkie testy integracyjne przeszły (100%)
- [ ] Testy E2E krytycznych ścieżek przeszły (100%)
- [ ] Brak błędów Critical/High
- [ ] UAT zakończony pozytywnie
- [ ] Smoke tests na staging przeszły
- [ ] Dokumentacja API zaktualizowana
- [ ] Release notes przygotowane

### C. Słowniczek pojęć

| Termin | Definicja |
|--------|-----------|
| **MVP** | Minimum Viable Product - minimalna wersja produktu z kluczowymi funkcjonalnościami |
| **RLS** | Row Level Security - zabezpieczenie na poziomie wierszy w bazie danych (Supabase) |
| **RBAC** | Role-Based Access Control - kontrola dostępu oparta na rolach (viewer, editor, owner) |
| **Soft-delete** | Logiczne usunięcie przez ustawienie flagi `deletedAt` zamiast fizycznego usunięcia wiersza |
| **Audit log** | Dziennik zmian rejestrujący wszystkie operacje CRUD na krytycznych tabelach |
| **Monorepo** | Pojedyncze repozytorium zawierające wiele projektów (frontend, backend, shared) |
| **Nx** | Narzędzie do zarządzania monorepo (build system, cache, dependency graph) |

---

**Koniec dokumentu**

---

**Historia zmian**:

| Wersja | Data | Autor | Opis zmian |
|--------|------|-------|------------|
| 1.0 | 2025-11-08 | Zespół QA | Pierwsza wersja planu testów |

