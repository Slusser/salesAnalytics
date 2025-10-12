# Plan implementacji widoku Kontrahenci – Nowy

## 1. Przegląd
Widok umożliwia dodanie nowego kontrahenta z unikalną nazwą oraz flagą aktywności (domyślnie aktywny). Dodatkowe pole „komentarz” jest elementem UI (informacyjne, niewysyłane do API w wersji MVP — pole pod przyszłe rozszerzenie). Widok jest dostępny wyłącznie dla ról `editor` i `owner`. Formularz zapewnia walidacje inline, a duplikaty nazw obsługiwane są poprzez mapowanie błędu z API na błąd polowy przy nazwie.

## 2. Routing widoku
- Ścieżka: `/customers/new`
- Ochrona dostępu: guard ról (`editor`, `owner`). Użytkownik z rolą `viewer` nie ma dostępu i zostaje przekierowany do listy kontrahentów z komunikatem o braku uprawnień.

Przykład (Angular 20, standalone, canMatch/canActivate):
```ts
// app.routes.ts
export const routes: Routes = [
  {
    path: 'customers/new',
    canMatch: [roleGuard(['editor', 'owner'])],
    loadComponent: () =>
      import('./pages/customers/new/customers-new.page')
        .then(m => m.CustomersNewPageComponent),
  },
];
```

## 3. Struktura komponentów
- CustomersNewPage (strona)
  - PageHeader (opcjonalnie, breadcrumbs/tytuł)
  - CustomerForm (formularz)
    - Form fields: Name, IsActive, Comment (UI-only)
    - LoaderButton (przycisk zapisu z loaderem)
  - Inline/Alert dla błędów serwera (np. duplikat)

## 4. Szczegóły komponentów
### CustomersNewPageComponent
- Opis: Strona kontenerowa. Odpowiada za integrację z serwisem API, routing po sukcesie oraz mapowanie błędów serwera na `CustomerForm`.
- Główne elementy: nagłówek strony, komponent `CustomerForm`, komunikaty sukcesu/błędu.
- Obsługiwane interakcje:
  - submit (delegowane do serwisu `CustomersService.createCustomer`)
  - cancel/back (nawigacja do `/customers`)
- Obsługiwana walidacja: brak walidacji własnej (deleguje do `CustomerForm` + walidacji serwera).
- Typy: `CreateCustomerRequest`, `CustomerDto`, `ApiError`, `CustomerFormModel`.
- Propsy: brak (to komponent routowany/strona).

### CustomerFormComponent
- Opis: Formularz reaktywny do tworzenia klienta; dostarcza walidacje inline i emituje submit.
- Główne elementy:
  - `input[name]` (string, required, max 120, trim)
  - `checkbox[isActive]` (boolean, default: true)
  - `LoaderButton` (submit) i przycisk „Anuluj”
- Obsługiwane interakcje:
  - `onSubmit(model)` – emituje dane formularza
  - `onCancel()` – powrót do listy
- Obsługiwana walidacja (inline):
  - name: required, maxLength 120, trim (spacje wiodące/końcowe usuwane przed walidacją)
  - isActive: boolean
  - błąd serwera „duplikat” mapowany na błąd polowy przy `name`
- Typy: `CustomerFormModel`, `ServerValidationErrors`.
- Propsy (interfejs):
```ts
export interface CustomerFormProps {
  initialValue?: CustomerFormModel; // default: { name: '', isActive: true, comment: '' }
  submitting?: boolean;             // steruje LoaderButton i disabled pól
  serverErrors?: ServerValidationErrors; // mapowane na błędy polowe/globalne
  onSubmit: (value: CustomerFormModel) => void;
  onCancel?: () => void;
}
```

### LoaderButton
- Opis: Przycisk z wbudowanym stanem ładowania; zapobiega wielokrotnemu wysłaniu.
- Główne elementy: `button[type=submit]` z ikoną spinnera podczas `loading=true`.
- Obsługiwane interakcje: click/submit.
- Walidacja: brak (UI-only).
- Propsy:
```ts
export interface LoaderButtonProps {
  label: string;
  loading: boolean;
  htmlType?: 'button' | 'submit';
  nzType?: 'primary' | 'default' | 'dashed' | 'link' | 'text'; // jeśli NgZorro
  icon?: string;
}
```

## 5. Typy
Zgodność z backendowym DTO:
```ts
// Request zgodny z CreateCustomerDto (API):
export interface CreateCustomerRequest {
  name: string;
  isActive?: boolean; // default: true
}

// ViewModel formularza (UI):
export interface CustomerFormModel {
  name: string;
  isActive: boolean;
  comment?: string; // UI-only (MVP: nie wysyłane do API)
}

// Odpowiedź API (CustomerDto) – jeżeli brak bezpośredniego importu typu z apps/shared:
export interface CustomerDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Błąd API (wspólny schemat błędu):
export interface ApiError {
  code: string; // np. CUSTOMER_VALIDATION_ERROR, CUSTOMER_DUPLICATE_NAME, UNAUTHORIZED, FORBIDDEN
  message: string;
  details?: string[];
}

// Mapowanie błędów serwera na formularz:
export interface ServerValidationErrors {
  fieldErrors?: Partial<Record<'name' | 'isActive' | 'comment', string>>;
  generalError?: string;
}
```

Uwaga: jeśli w projekcie dostępny jest współdzielony typ `CustomerDto` (apps/shared/dtos), preferowany jest import zamiast lokalnej definicji. Dla importów między aplikacjami zalecany alias TS (np. `@shared-dtos/*`).

## 6. Zarządzanie stanem
- Lokalny stan komponentów (Angular Reactive Forms + sygnały/sygnały pisane `signal()`):
  - `submitting` (boolean) – blokuje formularz i aktywuje loader
  - `serverErrors` (ServerValidationErrors | null) – prezentacja błędów z API
  - `dirtyGuard` – ostrzeżenie przed wyjściem z niezapisanym formularzem (opcjonalnie)
- Brak potrzeby globalnego store dla tego widoku (operacja jednostkowa CREATE).

## 7. Integracja API
- Endpoint: `POST /api/customers`
- Nagłówki: `Content-Type: application/json` (+ autoryzacja obsługiwana przez istniejący interceptor)
- Statusy i obsługa:
  - 201 Created → zwraca `CustomerDto`; nawigacja do `/customers/:id`
  - 400 Bad Request →
    - `code: CUSTOMER_VALIDATION_ERROR` → mapuj `details[]` do błędów globalnych/polowych
    - `code: CUSTOMER_DUPLICATE_NAME` → błąd polowy przy `name`
  - 401 Unauthorized → przekierowanie do logowania
  - 403 Forbidden → komunikat i przekierowanie do listy
  - 500 Internal Server Error → komunikat globalny „Spróbuj ponownie”

Serwis (szkic):
```ts
@Injectable({ providedIn: 'root' })
export class CustomersService {
  constructor(private http: HttpClient) {}

  createCustomer(payload: CreateCustomerRequest): Observable<CustomerDto> {
    return this.http.post<CustomerDto>('/api/customers', payload);
  }
}
```

## 8. Interakcje użytkownika
- Wpisuje nazwę → walidacja required + maxLength; trim podczas `valueChanges` lub przy `submit`.
- Przełącza „Aktywny” → boolean, default: true.
- Klik „Zapisz” → POST, loader w przycisku, blokada pól.
- Sukces → komunikat (toast) i nawigacja do `'/customers/' + id`.
- Duplikat → komunikat inline przy nazwie (błąd polowy) + focus na pole.
- Brak uprawnień → komunikat i przekierowanie.

## 9. Warunki i walidacja
- Klient:
  - `name` niepusty, `<= 120` znaków, po trim. Pusty po trim → błąd required.
  - `isActive` boolean (checkbox).
- Serwer:
  - Duplikat nazwy → błąd mapowany na `name`.
  - Inne błędy walidacji (`details[]`) → pokazane globalnie oraz per pole, gdy to możliwe.

## 10. Obsługa błędów
- 400 `CUSTOMER_DUPLICATE_NAME` → błąd polowy `name`: „Nazwa klienta już istnieje”.
- 400 `CUSTOMER_VALIDATION_ERROR` → wypisz `details[]` nad formularzem; jeśli zawiera klucze pól, mapuj do odpowiednich kontrolek.
- 401 → redirect do logowania.
- 403 → komunikat „Brak uprawnień” i redirect do `/customers`.
- 500/nieznane → toast „Nie udało się utworzyć klienta, spróbuj ponownie później”.
- Timeout/sieć → identycznie jak 500; pozostaw formularz odblokowany po błędzie.

## 11. Kroki implementacji
1) Routing
   - Dodaj wpis do `app.routes.ts` dla `/customers/new` z guardem ról (`editor|owner`).
2) Serwis API
   - Utwórz `apps/web/src/service/customers.service.ts` z metodą `createCustomer` (HttpClient POST → Observable<CustomerDto>). 
   - Zapewnij alias TS do współdzielonych DTO (opcjonalnie) lub lokalny interfejs `CustomerDto`.
3) Komponent strony
   - Utwórz `apps/web/src/pages/customers/new/customers-new.page.{ts,html,scss}` (standalone), wstrzyknij `CustomersService`, `Router`, `NzMessageService`.
   - Obsłuż `onSubmit` → `createCustomer`, stany `submitting/serverErrors`, nawigacja na sukces.
4) Formularz
   - Utwórz `apps/web/src/shared/components/customers/customer-form/customer-form.component.{ts,html,scss}` (standalone).
   - Reactive Forms: kontrole `name`, `isActive`, `comment` (comment nie w payloadzie POST).
   - Walidacje: required + maxLength 120 (name), trim; wyświetlanie błędów inline.
   - API error mapping (duplikat → name; inne → global).
5) LoaderButton
   - Utwórz/reużyj `apps/web/src/shared/components/loader-button/loader-button.component.{ts,html,scss}`.
6) UX/A11y
   - Focus management: po błędzie duplikatu ustaw focus na `name`.
   - Disable submit w trakcie `submitting` i gdy formularz nieważny.
   - Tekst alternatywny dla ikon/aria-live dla komunikatów błędów.
7) Bezpieczeństwo
   - Guard ról na trasie; ukrycie entry pointu w nawigacji dla `viewer`.
9) Dokumentacja
   - Krótki opis w README modułu strony; adnotacja, że `comment` jest UI-only w MVP.


