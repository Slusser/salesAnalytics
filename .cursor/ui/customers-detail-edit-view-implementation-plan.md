## Plan implementacji widoku Kontrahenci – Detal/Edycja

## 1. Przegląd
- **Cel**: Widok pozwala na podgląd szczegółów kontrahenta oraz edycję (dla ról `editor`/`owner`), a także na soft-delete i przywracanie rekordu.
- **Użytkownicy i uprawnienia**: 
  - `viewer`: tylko odczyt; ukryte/wyłączone akcje modyfikujące.
  - `editor`/`owner`: edycja nazwy, przywrócenie; soft-delete z potwierdzeniem.
- **Źródła prawdy**: 
  - API: `GET /customers/:customerId`, `PUT /customers/:customerId`, `DELETE /customers/:customerId`.
  - Typy współdzielone: `CustomerDto`, `CustomerDetailResponse`, `UpdateCustomerCommand` z `apps/shared/dtos/customers.dto.ts`.

## 2. Routing widoku
- **Ścieżka**: `/customers/:id`
- **Definicja trasy (Angular 20, standalone)**: dodać wpis do `apps/web/src/app/app.routes.ts`:
  - Path: `customers/:id`
  - Component: `CustomerDetailPage` (standalone)
  - Route data: `{ title: 'Kontrahent — Detal' }`

## 3. Struktura komponentów
- **Drzewo komponentów (wysoki poziom)**:
  - `CustomerDetailPage` (page/container)
    - `CustomerForm` (formularz: nazwa, status + przyciski akcji)
      - `LoaderButton` (dla Zapisz/Przywróć)
    - `ConfirmDialog` (potwierdzenie soft-delete)
    - [Opcjonalnie] `StatusBanner` (komunikat o soft-delete) / `ToastService`

## 4. Szczegóły komponentów
### CustomerDetailPage
- **Opis**: Komponent routingu odpowiedzialny za pobranie danych kontrahenta, zarządzanie stanem ładowania/edycji, autoryzacją UI oraz delegację akcji do serwisu API. Renderuje `CustomerForm` i obsługuje `ConfirmDialog` dla soft-delete.
- **Główne elementy**:
  - Nagłówek z nazwą klienta i statusem (aktywność)
  - Slot na formularz (`CustomerForm`)
  - Banner ostrzegawczy, gdy `deletedAt != null`
- **Obsługiwane interakcje**:
  - Inicjalne pobranie danych po `:id` (onInit / route param)
  - Zapis zmian (PUT)
  - Soft-delete (DELETE) z potwierdzeniem
  - Przywrócenie (PUT: `isActive=true`, `deletedAt=null`)
  - Nawigacja wstecz (np. do listy)
- **Walidacja (na poziomie strony)**:
  - Weryfikacja ról do pokazania/ukrycia akcji modyfikujących
  - Blokada zapisu, gdy formularz nie jest `valid` lub nie jest `dirty`
  - Spójność akcji: przywrócenie niedostępne, gdy rekord już aktywny
- **Typy**: `CustomerDetailResponse`, `UpdateCustomerCommand`, `CustomerViewModel`, `CustomerFormModel`, `ApiError`
- **Propsy (wejścia/wyjścia do dzieci)**:
  - Do `CustomerForm`: `vm: CustomerViewModel`, `disabled: boolean`, `saving: boolean`
  - Z `CustomerForm`: `submit(payload: CustomerFormModel)`, `restore()`, `softDelete()`

### CustomerForm
- **Opis**: Formularz edycji danych kontrahenta. Dla `viewer` pola tylko do odczytu. Dla rekordów soft-deleted wyraźny komunikat i możliwość przywrócenia dla ról uprawnionych.
- **Główne elementy**:
  - Pole `name` (Input, required, max 120, wzorzec znaków)
  - Pole statusu (Readonly chip: Aktywny/Nieaktywny)
  - Przyciski: `Zapisz` (LoaderButton), `Przywróć` (gdy soft-deleted), `Usuń` (otwiera ConfirmDialog), `Anuluj/Zamknij`
- **Obsługiwane interakcje**:
  - Edycja `name`
  - Submit — emituje `CustomerFormModel`
  - Klik `Przywróć` — emituje `restore`
  - Klik `Usuń` — emituje `softDelete`
- **Walidacja** (zgodnie z backend DTO `UpdateCustomerDto`):
  - `name`: required w trybie edycji, `maxLength=120`, pattern: `^[\p{L}\p{M}\p{N}\s\-_'.,&()\/]+$` (Unicode), trim → puste niedozwolone
  - Pola `isActive` i `deletedAt` nieedytowalne — zarządzane akcjami
- **Typy**: `CustomerFormModel`, `CustomerViewModel`
- **Propsy**:
  - `vm: CustomerViewModel`
  - `disabled: boolean` (rola viewer lub brak uprawnień)
  - `saving: boolean`
  - Outputy: `submitted(payload)`, `restore`, `delete`

### ConfirmDialog
- **Opis**: Modal potwierdzenia soft-delete z jasnym komunikatem konsekwencji (rekord nieaktywny, ukryty dla viewer).
- **Elementy**: Tytuł, opis, przyciski `Anuluj` / `Usuń`
- **Zdarzenia**: `confirm()`, `cancel()`
- **Walidacja**: brak — to decyzja użytkownika
- **Typy**: prosty model `{ open: boolean; message: string }`
- **Propsy**: `open`, `message`, `confirmLabel`, `cancelLabel`

### LoaderButton
- **Opis**: Przycisk z wbudowanym stanem `loading` i `aria-busy`.
- **Elementy**: ikonka spinnera + label
- **Zdarzenia**: `click`
- **Walidacja**: brak
- **Propsy**: `loading`, `disabled`, `variant`

## 5. Typy
Poniższe typy wspierają model widoku oraz formularz. Importujemy wspólne DTO z `apps/shared/dtos/customers.dto.ts`.

```ts
// ViewModel prezentacyjny dla strony detalu
export interface CustomerViewModel {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  // Pola pochodne dla UI
  isSoftDeleted: boolean
  canEdit: boolean
  canRestore: boolean
}

// Model formularza (dane edytowalne)
export interface CustomerFormModel {
  name: string
}

// Abstrakcja błędu API do prezentacji w UI
export interface ApiError {
  code: string
  message: string
  details?: string[]
}
```

Mapowanie typów:
- `CustomerDetailResponse` → `CustomerViewModel` (uzupełnienie pól pochodnych względem ról i `deletedAt`).
- `CustomerFormModel` → `UpdateCustomerCommand` (w PUT wysyłamy tylko zmienione pola; w tym widoku najczęściej `name`).

## 6. Zarządzanie stanem
- **Podejście**: Angular signals lub RxJS; rekomendowane signals (Angular 20) dla lokalnego stanu strony.
- **Sygnały/przechowywane wartości**:
  - `customer = signal<CustomerViewModel | null>(null)`
  - `isLoading = signal(false)`, `isSaving = signal(false)`, `isDeleting = signal(false)`
  - `apiError = signal<ApiError | null>(null)`
  - `showDeleteDialog = signal(false)`
  - `canEdit = computed(() => customer()?.canEdit ?? false)`
  - `canRestore = computed(() => customer()?.canRestore ?? false)`
- **Źródła ról**: `AuthService.getCurrentUserRoles()` (lub globalny store) do wyliczenia `canEdit/canRestore`.
- **Nawigacja**: po sukcesie usunięcia/przywrócenia — opcjonalny redirect lub odświeżenie danych.

## 7. Integracja API
- **GET /customers/:customerId**
  - Response: `CustomerDetailResponse` (alias `CustomerDto`)
  - 404: gdy rekord nie istnieje lub jest soft-delete i rola `viewer`
- **PUT /customers/:customerId**
  - Body: `UpdateCustomerCommand` (opcjonalne pola: `name?`, `isActive?`, `deletedAt?`)
  - Scenariusze:
    - Edycja nazwy: `{ name }`
    - Przywrócenie: `{ isActive: true, deletedAt: null }`
  - Odpowiedź: `CustomerDetailResponse`
- **DELETE /customers/:customerId**
  - Soft-delete, odpowiedź: `CustomerDetailResponse`

Obsługa kodów błędów (przykłady):
- GET: `CUSTOMERS_GET_BY_ID_NOT_FOUND`, `CUSTOMERS_GET_BY_ID_FAILED`
- PUT: `CUSTOMERS_UPDATE_VALIDATION`, `CUSTOMERS_NAME_TAKEN`, `CUSTOMERS_UPDATE_FORBIDDEN`, `CUSTOMERS_UPDATE_NOT_FOUND`, `CUSTOMERS_UPDATE_FAILED`
- DELETE: `CUSTOMERS_DELETE_FORBIDDEN`, `CUSTOMERS_DELETE_NOT_FOUND`, `CUSTOMERS_DELETE_FAILED`

## 8. Interakcje użytkownika
- **Wejście na stronę**: ładowanie danych, skeleton/loader; błąd 404 → komunikat i link powrotu.
- **Edycja nazwy** (`editor/owner`): walidacja na bieżąco; `Zapisz` aktywny dla `dirty && valid`.
- **Soft-delete** (`editor/owner`): klik `Usuń` → `ConfirmDialog` → `DELETE` → banner „klient nieaktywny” i opcja `Przywróć`.
- **Przywróć** (`editor/owner`, gdy soft-deleted): `PUT` z `isActive=true, deletedAt=null` → status aktywny.
- **Viewer**: widzi dane; przy soft-delete widzi banner i brak akcji modyfikujących.

## 9. Warunki i walidacja
- `name`:
  - required (w trybie edycji), trim, `maxLength=120`, wzorzec znaków jak w backendzie.
  - Błąd `CUSTOMERS_NAME_TAKEN` mapować na komunikat przy polu.
- Spójność akcji:
  - `Przywróć` dostępne tylko gdy `deletedAt != null` i rola `editor/owner`.
  - `Usuń` dostępne tylko dla `editor/owner`.
- Blokady UI:
  - Disabled pól i akcji dla `viewer`.
  - Disable `Zapisz` podczas `isSaving`.

## 10. Obsługa błędów
- **Walidacja 400 (PUT)**: pokaż błędy per pole (name: required/maxlength/pattern) oraz toast dla ogólnych.
- **403**: ukryj akcje modyfikujące proaktywnie; jeśli wystąpi, pokaż komunikat „Brak uprawnień”.
- **404 (GET)**: „Klient nie został znaleziony”; przycisk przejścia do listy.
- **404 (PUT/DELETE)**: rekord mógł zostać usunięty; odśwież i pokaż komunikat.
- **5xx**: toast „Wystąpił błąd serwera, spróbuj ponownie”.
- **Sieć**: retry przy GET (jedna próba), przy PUT/DELETE pokaż opcję ponów.

## 11. Kroki implementacji
1) Routing
   - Dodać trasę `customers/:id` → `CustomerDetailPage` w `apps/web/src/app/app.routes.ts`.
2) Serwisy API
   - Utworzyć `apps/web/src/service/customers.service.ts` z metodami: `getById(id)`, `update(id, command)`, `softDelete(id)`.
   - Zapewnić wstrzyknięcie `HttpClient` i obsługę nagłówków auth.
3) Typy UI
   - Utworzyć `apps/web/src/shared/types/customers.view-model.ts` z `CustomerViewModel`, `CustomerFormModel`, `ApiError`.
4) Komponent strony
   - Utworzyć `apps/web/src/pages/customers/customer-detail.page.ts` (standalone) z sygnałami stanu i integracją serwisu.
   - Mapowanie `CustomerDetailResponse` → `CustomerViewModel` (pola pochodne z ról i `deletedAt`).
5) Formularz
   - Utworzyć `apps/web/src/shared/components/customer-form/customer-form.component.ts` (standalone) z walidacją (required, maxLength, pattern) i outputami `submitted`, `restore`, `delete`.
   - Użyć `LoaderButton` dla przycisków akcji.
6) ConfirmDialog i LoaderButton
   - Utworzyć `apps/web/src/shared/components/confirm-dialog/` oraz `loader-button/` z prostym API propsów i dostępnością (`aria-busy`).
7) A11y i UX
   - Bannery statusu, focus management po błędach/submit, klawisze skrótów (Enter dla submit), etykiety ARIA.
8) RBAC w UI
   - Wstrzyknąć serwis ról; sterować `disabled/hidden` dla akcji.
9) Testy ręczne i e2e (skrót)
   - Scenariusze: viewer (read-only), editor: edycja OK, błąd walidacji, soft-delete + restore, 404.

---

Uwagi implementacyjne zgodne z PRD i NestJS API:
- Unikać równoległych zapisów; blokować wielokrotne kliknięcia (`isSaving`).
- Zgodność walidacji client↔server; ten sam wzorzec i limity znaków.
- Po `DELETE` nie nawigować automatycznie, jeśli przewidziano „przywróć” na tym samym widoku.


