## Moduł uwierzytelniania (Auth) – specyfikacja architektury

Wersja: 1.0 (MVP zgodne z PRD @prd.md oraz stack @tech-stack.md)
Zakres: rejestracja, logowanie, wylogowanie, integracja ról, ochrona tras, spójność z istniejącym RBAC i Supabase. Reset haseł – poza zakresem MVP (zgodnie z PRD @prd.md).

---

### 1. Architektura interfejsu użytkownika (Angular 20)

Założenia frontendowe zgodne z „angular” rule:
- standalone components, OnPush, `inject()` zamiast konstruktorów, kontrola przepływu `@if/@for/@switch`, NgZorro jako UI, RxJS do HTTP, sygnały do stanu sesji.
- Dwa tryby layoutu: `AuthLayout` (minimalny, bez nawigacji) i `AppLayout` (po zalogowaniu). Lazy loading poprzez `loadComponent`/`loadChildren`.

#### 1.1. Struktura stron i komponentów
Nowe ścieżki i komponenty w `apps/web/src/app/pages/auth`:
- `login.page.{ts,html,scss}`: formularz logowania (email, hasło). Reset haseł poza MVP — komunikat „Skontaktuj się z administratorem”.
- `register.page.{ts,html,scss}`: formularz rejestracji (email, hasło, powtórz hasło). W MVP: rejestracja dostępna tylko dla admina (patrz Backend) – UI może być ukryte dla zwykłych użytkowników; alternatywnie: ekran „Skontaktuj się z administratorem”.
- `logout.page.ts` (opcjonalnie bez UI): wykonuje akcję wylogowania i przekierowuje do `/auth/login`.

Wspólne komponenty UI w `apps/web/src/app/shared/components/auth`:
- `auth-card.component` (shell z nagłówkiem, ikoną i slocie na formularz – NgZorro `nz-card`).
- `auth-error.component` (lista albo pojedynczy komunikat błędu z mapowaniem kodów na teksty UX).
- `auth-spinner.component` (stan ładowania dla akcji asynchronicznych).

Zmiany/rozszerzenia istniejących części UI:
- `AppLayout` (np. w `app.html`/nawigacja): dodać przycisk „Wyloguj” widoczny tylko dla ról `editor|viewer|owner`. Stan zalogowania trzymany w sygnale `currentUserSignal` i aktualizowany przez `AuthSessionService`.
- W nawigacji ukrywać elementy modyfikujące (zgodnie z US-020) dla `viewer` (lub w ogóle dla niezalogowanych).
- W topbarze nazwa zalogowanego użytkownika

#### 1.2. Router i ochrona tras
Aktualizacja `app.routes.ts`:
- `path: 'auth'` – child-routes (login, register) w `AuthLayout`.
- Publiczne: `auth/*`.
- Chronione: wszystkie dotychczasowe (np. `customers`) wymagają roli `viewer|editor|owner`.
- Wprowadzić „functional guard” `authGuard()` działający na sygnale sesji; przy braku sesji -> redirect do `/auth/login` z `queryParams: { returnUrl }`.
- Dodatkowy guard ról `roleGuard(requiredRoles: AppRole[])` – ukrywa/chroni akcje (np. przyciski `Edytuj/Usuń`) i trasy administracyjne.

#### 1.3. Formularze, walidacje i komunikaty błędów
Walidacje po stronie klienta (reactive forms):
- Email: wymagany, format email.
- Hasło: wymagane, min. 8 znaków (MVP), dodatkowe zasady do ustalenia (PRD 4.2.1 otwarte). 
- Rejestracja: `password` = `confirmPassword`.
// Reset haseł poza MVP

Mapowanie błędów (UX):
- `invalid_credentials` -> „Nieprawidłowy email lub hasło.”
- `user_not_found` -> „Użytkownik nie istnieje.”
- `email_in_use` -> „Adres email już używany.”
- `weak_password` -> „Hasło nie spełnia wymagań.”
- `network_error` -> „Błąd sieci – spróbuj ponownie.”

Scenariusze:
 - Sukces logowania: zapis sesji (token), przekierowanie na `returnUrl` lub `/customers`.
 - Wylogowanie: wyczyszczenie sesji, przekierowanie `/auth/login`.
 - Rejestracja (MVP, owner-driven): po sukcesie komunikat „Użytkownik utworzony”/przekierowanie.

#### 1.4. Warstwa usług (frontend)
Nowe serwisy w `apps/web/src/app/service/auth`:
- `auth-api.service.ts` (HTTP do Nest lub Supabase RPC – patrz System Autentykacji):
  - `login(command: AuthLoginCommand): Observable<AuthLoginResponse>`
  - `logout(command: AuthLogoutCommand): Observable<AuthLogoutResponse>`
  - `register(dto: AdminCreateUserCommand): Observable<AdminUserDto>` (tylko dla owner)
  - `me(): Observable<AuthenticatedUserDto>`
- `auth-session.service.ts` (sygnały i integra z Routerem):
  - `currentUserSignal: Signal<AuthenticatedUserDto | null>`
  - `tokensSignal: Signal<AuthTokensDto | null>`
  - `setSession(tokens, user)`, `clearSession()`, `isLoggedIn()`, `hasRole(role)`, `restoreSession()`
  - konfiguracja `HttpInterceptor` doklejającego `Authorization: Bearer <accessToken>`

Wszystkie formularze wywołują `AuthApiService`; sukces/porazka aktualizuje `AuthSessionService` i UI.

---

### 2. Logika backendowa (NestJS 11)

Założenia backendowe zgodne z „nest” rule oraz obecnym `SecurityModule`:
- Globalne guardy `JwtAuthGuard` i `RolesGuard` już istnieją. Potrzebujemy publicznego kontrolera auth (wyłączone guardy) i ewentualnych endpointów admina do zarządzania użytkownikami.
- Integracja z Supabase Auth jako źródłem tożsamości. Role w tabeli `user_roles` (już wykorzystywane przez `RequestContextService`).

#### 2.1. Struktura endpointów
Nowy moduł `apps/api/src/auth`:
- `auth.module.ts`
- `auth.controller.ts`
- `auth.service.ts`
- `auth.mapper.ts` (mapowanie na `AuthenticatedUserDto`/`AuthTokensDto`)

Routing (prefiks `/auth`):
- `POST /auth/login` – body: `AuthLoginCommand`; zwraca `AuthLoginResponse`.
- `POST /auth/logout` – body: `AuthLogoutCommand` (opcjonalnie); unieważnia refresh token (jeśli stosowany) lub no-op; zwraca `AuthLogoutResponse`.
- `POST /auth/register` – body: `AdminCreateUserCommand`; chronione rolą `owner`; w MVP administracja użytkownikami przez admina.
- `GET /auth/me` – zwraca `AuthenticatedUserDto` na podstawie Bearer JWT.
- `PATCH /auth/users/:id/role` – body: `UpdateUserRoleCommand`; chronione rolą `owner`.

Uwaga na globalne guardy: kontroler auth musi mieć dekorator, by wyłączyć `JwtAuthGuard` i `RolesGuard` dla publicznych akcji:
- Możliwe strategie: dedykowany `@Public()` dekorator + guard ignorujący; albo lokalna konfiguracja kontrolera przez `@UseGuards()` na poziomie metod.

#### 2.2. Modele danych i walidacja
DTO – użyć `apps/shared/dtos/user-roles.dto.ts` oraz `apps/shared/dtos/auth.dto.ts` (re-eksport). Dodatkowe DTO:
 - `UpdateUserRoleCommand { role: 'viewer' | 'editor' | 'owner' }`
Walidacja przez `class-validator` i `ValidationPipe` (globalnie w main.ts lub lokalnie w kontrolerze):
- `@IsEmail()`, `@IsString()`, `@MinLength(8)` itd.

#### 2.3. Obsługa wyjątków i kontrakty błędów
- Błędy Supabase (np. 400/401/409) mapować do Nest `UnauthorizedException`, `ConflictException`, `BadRequestException` z Payloadem `{ code, message }` zgodnym z mapowaniem frontu.
- Logika w `AuthService` powinna używać `SupabaseFactory.create()` bez tokenu (akcje publiczne) lub z tokenem (sesyjne). 
- Błędy sieciowe logować przez `Logger`. Nie ujawniać szczegółów w treści odpowiedzi.

#### 2.4. Integracja z istniejącym bezpieczeństwem
- Po zalogowaniu należy pobrać role z `user_roles` (tak jak w `RequestContextService`) i zwrócić `AuthenticatedUserDto` w `AuthLoginResponse`.
- Tokeny: front i backend zakładają Bearer w nagłówku do akcji chronionych. Auto-odświeżanie tokenów – wyłączone w Fabryce; w MVP pozostawiamy ręczny refresh lub powtórne logowanie po wygaśnięciu.

#### 2.5. Aktualizacja renderowania stron (Angular)
 - Guardy funkcjonalne i `HttpInterceptor` w Angularze decydują o przekierowaniach bez przebudowy istniejących stron (np. `customers`).
 - Komponenty list/detali mają ukryte przyciski modyfikujące jeśli `!hasRole('editor'|'owner')` (wspierając US-020).

---

### 3. System autentykacji – Supabase Auth + Angular

Założenia z PRD:
 - Admin tworzy konto i nadaje hasło (bez zaproszeń i bez resetu haseł w MVP).
 - Role z tabeli `user_roles` – mapowane do `viewer|editor|owner`.

#### 3.1. Przepływy
- Logowanie: `POST /auth/login` -> Supabase `signInWithPassword` -> sukces: pobranie ról -> zwrot `{ tokens, user }` -> front zapisuje w `AuthSessionService` i ustawia Bearer.
- Wylogowanie: front czyści sesję; opcjonalnie `POST /auth/logout`.
- Rejestracja (owner): `POST /auth/register` -> Supabase Admin API (`auth.owner.createUser`) -> wstawienie ról do `user_roles` -> zwrot `AdminUserDto`.
- Odtworzenie sesji po odświeżeniu: `GET /auth/me` na podstawie Bearer -> front aktualizuje `AuthSessionService`.

#### 3.2. Frontend – stan i bezpieczeństwo
- `AuthSessionService` przechowuje tokeny w `sessionStorage` (MVP, alternatywnie `Memory` + odświeżanie). Sygnały zapewniają reaktywność komponentów i guardów.
- `HttpInterceptor` dodaje `Authorization` dla wezwań do Nest API.
- W razie 401/403 interceptor wywołuje `clearSession()` i przekierowuje do `/auth/login` z `returnUrl`.

#### 3.3. Backend – szczegóły integracji Supabase
- Konfiguracja już istnieje w `SupabaseFactory`; wykorzystywać `create(accessToken?)`.
- Logowanie: bez tokenu, tylko dane z `AuthLoginCommand` -> Supabase `auth.signInWithPassword({ email, password })` -> walidacja -> pobranie ról via `from('user_roles')` -> mapowanie do `AuthenticatedUserDto`.
- Rejestracja owner: użyć klucza serwisowego (należy udostępnić zmienną środowiskową w kontenerze API, nie do Frontu). Po utworzeniu użytkownika przypisać role w `user_roles`.
 - Zmiana roli użytkownika: endpoint `PATCH /auth/users/:id/role` aktualizuje wpis w `user_roles` (tylko owner).

---

### 4. Elementy do implementacji – komponenty, serwisy, kontrakty

#### Frontend
- Komponenty: `AuthLayout`, `LoginPage`, `RegisterPage` (opcjonalizacja UI), `ResetRequestPage`, `ResetConfirmPage`, `LogoutPage` (bez UI).
- Serwisy: `AuthApiService`, `AuthSessionService`, `AuthHttpInterceptor`, `authGuard()`, `roleGuard()`.
- Typy: użycie istniejących DTO z `apps/shared/dtos/user-roles.dto.ts` i re-eksportów w `apps/shared/dtos/auth.dto.ts`.
- Routing: aktualizacja `app.routes.ts` – dodanie sekcji `auth` i nałożenie guardów na istniejące trasy (np. `customers`).

#### Backend
 - Moduł `auth` (controller, service, mapper) w `apps/api/src/auth`.
 - Publiczne metody kontrolera: `login`, `logout`, `me`; metody administracyjne: `register` (owner), `updateUserRole` (owner).
 - Integracja z `RequestContextService` do pobrania ról (lub odczyt ról po zalogowaniu).
 - Dekorator `@Public()` i modyfikacja guardów, aby obsłużyć publiczne endpointy.

---

### 5. Zgodność z PRD
 - US-001/US-020: guardy i role decydują o widoczności i dostępności akcji, API zwraca 401/403 przy braku uprawnień.
 - Role: `viewer`, `editor`, `owner`. Widoki i akcje dopasowane (np. brak zapisu/usuń dla `viewer`).
 - Sesja wygasa -> interceptor przekierowuje do logowania.
 - Nie naruszamy istniejącego CRUD kontrahentów i bezpieczeństwa – dodajemy wyłącznie nowy moduł auth i guardy po stronie frontu.

---

### 6. Błędy i edge cases
 - Złe poświadczenia -> 401 + komunikat UX.
 - Użytkownik bez ról -> 403 i komunikat administratora (log warning).
 - Brak konfiguracji SUPABASE_* -> twardy błąd przy starcie (już istnieje w Fabrykach) – dokumentacja env w README.

---

### 7. Konfiguracja środowiskowa
 - Backend: `SUPABASE_URL`, `SUPABASE_KEY` (service role do operacji owner).
 - Frontend: korzysta wyłącznie z publicznych endpointów API; tokeny przechowywane w `sessionStorage`.

---

### 8. Telemetria i audyt (wybrane aspekty MVP)
- Logowanie zdarzeń `auth.login.success|failure` po stronie API (Logger).
- Opcjonalnie: audyt administracyjny dla tworzenia użytkownika.

---

### 9. Kontrakty (skrót)
 - `POST /auth/login` -> `AuthLoginResponse { accessToken, refreshToken?, expiresIn, user{ id, email, displayName, roles[] } }`
 - `POST /auth/logout` -> `{ success: true }`
 - `POST /auth/register` (owner) -> `AdminUserDto`
 - `GET /auth/me` -> `AuthenticatedUserDto`
 - `PATCH /auth/users/:id/role` (owner) -> `AdminUserDto | { success: true }`

Uwagi implementacyjne: użyć `inject()` w komponentach i serwisach, komponenty standalone, OnPush, NgZorro, sygnały do stanu auth, RxJS dla HTTP. Nie zmieniać istniejącego `SecurityModule`; dodać `@Public()` dla tras auth.
