# Plan implementacji widoku Orders Detail

## 1. Przegląd
Widok `Orders Detail` służy do podglądu oraz edycji pojedynczego zamówienia. Umożliwia prezentację wszystkich pól finansowych, metadanych audytowych i historii zmian oraz wykonanie akcji edycji, soft delete i przywrócenia zgodnie z rolami użytkownika. Priorytetem jest zgodność z algorytmem przeliczeń netto→brutto, obsługa kursu EUR oraz walidacja tolerancji różnic.

## 2. Routing widoku
- Ścieżka: `/orders/:orderId`
- Trasa lazy-load w `apps/web/src/app/app.routes.ts`, komponent standalone `OrderDetailPageComponent` (OnPush).
- Guardy: `SupabaseAuthGuard`/`RolesGuard` (viewer+), `CanDeactivate` dla ostrzegania o niewysłanych zmianach formularza.
- Parametry query: brak obowiązkowych; wspierane planowo `tab=audit` do otwarcia panelu audytu.

## 3. Struktura komponentów
```
OrderDetailPageComponent
└── OrderDetailHeaderComponent
    ├── OrderMetadataCardComponent
    └── OrderActionsPanelComponent
└── FXRateBannerComponent
└── OrderFormComponent
    ├── OrderCustomerSectionComponent
    ├── OrderAmountsSectionComponent
    ├── OrderDiscountSectionComponent
    ├── OrderTotalsSectionComponent
    └── OrderCommentSectionComponent
└── AuditPanelComponent
    └── AuditTimelineComponent
└── LoaderButtonComponent (submit)
└── ConfirmDialogComponent (modal portal)
└── NzResult / ForbiddenPlaceholderComponent (stany 403/404)
└── SkeletonDetailComponent (stan ładowania)
```

## 4. Szczegóły komponentów
### OrderDetailPageComponent
- Opis: kontener strony; pobiera dane, zarządza stanem, przekazuje dane do dzieci i reaguje na akcje (zapis, usunięcie, przywrócenie, przełączanie panelu audytu).
- Główne elementy: wrapper `nz-layout`, `nz-spin` dla loading, routing breadcrumbs, sekcja nagłówka, formularz, panel audytu, toast błędów (`NzMessageService`).
- Obsługiwane interakcje: inicjalizacja (GET), zapis formularza (PUT), soft delete/przywrócenie (TODO), przełączanie audytu, restart formularza, cofnięcie do listy.
- Walidacja: kontrola ról (viewer blokuje edycję); weryfikacja stanu formularza przed nawigacją (`CanDeactivate`); blokada akcji przy `deletedAt != null` dla viewer.
- Typy: `OrderDetailVm`, `OrderFormVm`, `OrderRolePermissionsVm`, `OrderMutationResultVm`.
- Propsy: brak (top-level); komponent wstrzykuje `OrderDetailStore`.

### OrderDetailHeaderComponent
- Opis: nagłówek widoku z tytułem, statusem (soft delete), przyciskami nawigacyjnymi i metadanymi (`createdAt`, `updatedAt`, `createdBy`).
- Główne elementy: `nz-page-header`, `nz-tag` (status), przycisk powrotu, `OrderMetadataCardComponent` jako slot.
- Obsługiwane interakcje: `back`, `toggleRestore`, `toggleDelete`, `openAudit`.
- Walidacja: ukrycie akcji mutujących bez uprawnień; potwierdzenie przed soft delete/przywróceniem.
- Typy: `OrderMetadataVm`, `OrderRolePermissionsVm`.
- Propsy: `{ metadata: OrderMetadataVm; permissions: OrderRolePermissionsVm; onBack(): void; onSoftDelete(): void; onRestore(): void; onOpenAudit(): void }`.

### OrderMetadataCardComponent
- Opis: karta z metadanymi (identyfikator, numer zamówienia, status, autor, znaczniki czasu, waluta).
- Główne elementy: `nz-descriptions`, `nz-statistic`, ikony stanu.
- Obsługiwane interakcje: brak (prezentacja).
- Walidacja: highlight gdy `deletedAt` ustawione; wyświetlenie dat w lokalnej strefie z tooltipem UTC.
- Typy: `OrderMetadataVm`.
- Propsy: `{ metadata: OrderMetadataVm }`.

### OrderActionsPanelComponent
- Opis: grupa przycisków akcji (Zapisz, Cofnij zmiany, Usuń, Przywróć) oraz `LoaderButton` dla submitu.
- Główne elementy: `nz-space`, `LoaderButtonComponent`, `nz-button`, `ConfirmDialogComponent` trigger.
- Obsługiwane interakcje: `submit`, `reset`, `softDeleteRequest`, `restoreRequest`.
- Walidacja: disable przy braku zmian lub `form.invalid`; kontrola ról.
- Typy: `OrderActionsStateVm`.
- Propsy: `{ state: OrderActionsStateVm; onSubmit(): void; onReset(): void; onSoftDelete(): void; onRestore(): void }`.

### OrderFormComponent
- Opis: formularz edycji w oparciu o Reactive Forms + sygnały; podzielony na sekcje.
- Główne elementy: `form` z `nz-form`, pola: numer zamówienia, kontrahent (`nz-select` z async opcjami), data (`nz-date-picker`), ilość (`nz-input-number`), waluta (`nz-radio-group`), kurs EUR (`nz-input-number`), rabaty producenta/dystrybutora, VAT, wartości netto/brutto, komentarz (`nz-textarea`).
- Obsługiwane interakcje: zmiana pól, przełączanie waluty (wyzwala logikę wymaganych pól), obliczenia w locie (symulacja brutto, walidacja tolerancji), reset.
- Walidacja: 
  - `orderNo` wymagane, max 64 znaki, pattern bez znaków niedozwolonych.
  - `customerId` wymagane (UUID), musi istnieć w słowniku.
  - `orderDate` wymagane, nieprzyszłościowe (zg. polityka backendu, walidacja <= dziś).
  - `quantity` > 0, liczba całkowita.
  - `isEur` steruje polami: gdy `true`, `eurRate` i `totalGrossEur` wymagane i >0; w PLN pola te disabled i czyszczone.
  - `producerDiscountPct`, `distributorDiscountPct`, `vatRatePct` w zakresie 0–100.
  - `totalGrossPln` zgodne z algorytmem: różnica `|calcGrossPln - totalGrossPln| <= 0.01`.
  - `comment` optional, max 500 znaków, sanitizacja (stripTags).
- Typy: `OrderFormValue`, `OrderFormControls`, `OrderFormValidationVm`, `CurrencyOptionVm`, `CustomerOptionVm`.
- Propsy: `{ value: OrderFormValue; disabled: boolean; permissions: OrderRolePermissionsVm; onChange(value: Partial<OrderFormValue>): void; onValidityChange(valid: boolean, errors: string[]): void }`.

### FXRateBannerComponent
- Opis: informacja o kursie EUR, ostrzega przy brakującym lub ręcznie zmienionym kursie.
- Główne elementy: `nz-alert` z ikoną informacji/ostrzeżenia, przycisk „Pobierz kurs NBP” (jeśli planowane).
- Obsługiwane interakcje: `refreshRate` (opcjonalnie), `revertManualRate`.
- Walidacja: widoczny tylko gdy `isEur=true`; stan ostrzeżenia gdy brak kursu lub kurs z datą inną niż zamówienia.
- Typy: `FxRateBannerVm`.
- Propsy: `{ vm: FxRateBannerVm; onRefreshRate(): void; onResetRate(): void }`.

### AuditPanelComponent
- Opis: panel z historią audytu (lista wpisów), można go zwijać/rozwijać; integruje `AuditTimelineComponent`.
- Główne elementy: `nz-card`, `nz-collapse`, `AuditTimelineComponent` (lista), przycisk kopiowania JSON.
- Obsługiwane interakcje: `toggle`, `loadMore`, `copyEntry`, `jumpToChange`.
- Walidacja: viewer ma tylko podgląd; przy braku audytu (np. 204) pokazuje empty state.
- Typy: `OrderAuditVm`, `OrderAuditEntryVm` (z `OrderAuditEntryDto`).
- Propsy: `{ audit: OrderAuditVm; loading: boolean; error?: string; onFetchNext(): void }`.

### AuditTimelineComponent
- Opis: renderuje listę wpisów audytowych w układzie osi czasu.
- Główne elementy: `nz-timeline`, `nz-tag` (typ operacji), `pre` dla JSON diff (formatowanie highlight).
- Obsługiwane interakcje: emit `entrySelected` dla głównych akcji (np. scrolowanie). 
- Walidacja: brak dodatkowych.
- Typy: `OrderAuditEntryVm`.
- Propsy: `{ entries: OrderAuditEntryVm[]; onSelect(entryId: number): void }`.

### ConfirmDialogComponent
- Opis: modal potwierdzający soft delete/przywrócenie.
- Główne elementy: `nz-modal` z dynamiczną treścią.
- Obsługiwane interakcje: `confirm`, `cancel`.
- Walidacja: blokada przy `loadingMutation`.
- Typy: `ConfirmDialogStateVm`.
- Propsy: `{ vm: ConfirmDialogStateVm; onConfirm(): void; onCancel(): void }`.

### LoaderButtonComponent
- Opis: przycisk z animacją ładowania.
- Główne elementy: `nz-button`, `nz-spin` w slocie.
- Obsługiwane interakcje: `click`.
- Walidacja: disable gdy `disabled` lub `loading`.
- Typy: `LoaderButtonProps`.
- Propsy: `{ label: string; loading: boolean; disabled: boolean; type?: 'primary' | 'default'; icon?: string; onClick(): void }`.

### SkeletonDetailComponent
- Opis: placeholder ładowania danych (skeletor dla pól formularza i metadanych).
- Główne elementy: `nz-skeleton`, `nz-space`.
- Obsługiwane interakcje: brak.
- Walidacja: brak.
- Typy: brak dedykowanych (statyczny komponent).
- Propsy: `{ compact?: boolean }`.

## 5. Typy
- `OrderDetailDto` (z `apps/shared/dtos/orders.dto.ts`): dane z API.
- `OrderDetailVm`: `{ order: OrderDetailDto; metadata: OrderMetadataVm; actions: OrderActionsStateVm; audit: OrderAuditVm; isDeleted: boolean; }`.
- `OrderMetadataVm`: `{ id: string; orderNo: string; createdAt: string; updatedAt: string; deletedAt?: string; createdByName?: string; customerName: string; currencyCode: 'PLN' | 'EUR'; }`.
- `OrderRolePermissionsVm`: `{ canEdit: boolean; canDelete: boolean; canRestore: boolean; canViewAudit: boolean; }`.
- `OrderFormValue`: `{ orderNo: string; customerId: string; orderDate: string; itemName: string; quantity: number; isEur: boolean; eurRate?: number | null; producerDiscountPct: number; distributorDiscountPct: number; vatRatePct: number; totalNetPln: number; totalGrossPln: number; totalGrossEur?: number | null; comment?: string | null; }`.
- `OrderFormVm`: `{ form: FormGroup<OrderFormControls>; dirty: boolean; valid: boolean; errors: string[]; }`.
- `OrderFormControls`: definicja pól formularza z typami `FormControl<...>`.
- `OrderFormValidationVm`: `{ toleranceExceeded: boolean; eurRateMissing: boolean; invalidCustomer: boolean; }`.
- `OrderActionsStateVm`: `{ submitting: boolean; canSubmit: boolean; canReset: boolean; disableDelete: boolean; disableRestore: boolean; showRestore: boolean; showDelete: boolean; }`.
- `FxRateBannerVm`: `{ visible: boolean; severity: 'info' | 'warning'; rate?: number; rateDate?: string; manualOverride: boolean; disableRefresh: boolean; }`.
- `OrderAuditVm`: `{ entries: OrderAuditEntryVm[]; total: number; nextCursor?: string; }`.
- `OrderAuditEntryVm`: `{ id: number; occurredAt: string; operation: 'create' | 'update' | 'delete' | 'restore'; userName?: string; diffSummary: string; oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null; }`.
- `ConfirmDialogStateVm`: `{ visible: boolean; mode: 'delete' | 'restore'; message: string; confirmLabel: string; loading: boolean; }`.
- `OrderMutationPayload`: `UpdateOrderCommand` (z `orders.dto.ts`).
- `OrderMutationResultVm`: `{ success: boolean; errorCode?: string; message?: string; }`.
- `CustomerOptionVm`: `{ value: string; label: string; disabled: boolean; }`.

## 6. Zarządzanie stanem
- `OrderDetailStore` (standalone serwis) używający sygnałów:
  - `orderDetail = signal<OrderDetailVm | null>(null)`
  - `formState = signal<OrderFormVm>(...)`
  - `permissions = signal<OrderRolePermissionsVm>(...)`
  - `auditState = signal<OrderAuditVm | null>(null)`
  - `status = signal<'idle' | 'loading' | 'saving' | 'error' | 'forbidden' | 'not-found'>('idle')`
  - `error = signal<string | null>(null)`
  - `confirmDialog = signal<ConfirmDialogStateVm>(...default...)`
- Serwis udostępnia metody: `load(orderId)`, `updateForm(partial)`, `submit()`, `openDeleteDialog()`, `openRestoreDialog()`, `confirmMutation()`, `cancelDialog()`, `loadAudit()`, `toggleAuditVisibility()`, `resetForm()`.
- Hook `useOrderDetail(orderId: string)` (factory w komponencie) inicjalizuje store, łączy sygnały z template poprzez `computed`.
- Form reactive + signals: `OrderFormComponent` reaguje na zmiany sygnału `disabled` (viewer) i propaguje `dirty`/`valid`.
- `CanDeactivate` używa stanu `formState.dirty` i `status === 'saving'` do potwierdzania wyjścia.

## 7. Integracja API
- `GET /api/orders/:orderId`
  - Request: brak body; param `orderId` (UUID v4).
  - Response: `OrderResponse` (`OrderDetailDto`).
  - Mapowanie: service konwertuje wartości numeric (Supabase `string`) na `number`, daty do ISO; uzupełnia pola prezentacyjne (np. `customerName` z wbudowanego DTO).
- `PUT /api/orders/:orderId`
  - Request body: `UpdateOrderCommand` (z pól formularza); ensure trimming stringów, transform `eurRate`/`totalGrossEur` => null gdy nie dotyczy.
  - Response: `OrderResponse` (zaktualizowany rekord) → aktualizacja store.
- `DELETE /api/orders/:orderId` i `POST /api/orders/:orderId/restore` (jeśli dostępne) - oznaczyć jako rozszerzenia; modul `OrderDetailStore` powinien obsłużyć status `deleted` po sukcesie.
- `GET /api/orders/:orderId/audit` (jeśli istnieje) lub fallback: reuse `OrdersService.getAudit` (do potwierdzenia w backlogu). W planie przewidziane API z typem `OrderAuditResponse`.
- Obsługa 403/404: store ustawia `status` i wyświetla `NzResult`.

## 8. Interakcje użytkownika
- Wejście na `/orders/:id` → ładowanie danych, skeleton do czasu odpowiedzi.
- Zmiana pola w formularzu → aktualizacja sygnału formy, walidacja, obliczenia brutto (helper obliczeń w serwisie). 
- Zaznaczenie `isEur` → włączenie `eurRate`, wyświetlenie `FXRateBanner`, walidacja `totalGrossEur`.
- Kliknięcie `Zapisz` → walidacja frontu + wywołanie `submit()`; przy sukcesie toast `Zamówienie zapisane`, reset `dirty`.
- Klik `Cofnij zmiany` → przywrócenie `OrderFormValue` z `orderDetail.order`.
- Klik `Usuń`/`Przywróć` → `ConfirmDialogComponent`; potwierdzenie -> API (gdy dostępne) i aktualizacja stanu.
- Viewer: brak trybu edycji; formularz disabled, widoczny banner braku uprawnień? (opcjonalnie `NzAlert`).
- Otwórz panel audytu → `AuditPanelComponent` fetch (lazy) i render timeline; przy błędzie toast i stan `error`.
- Próba opuszczenia strony z brudnym formularzem → `CanDeactivate` pokazuje modal przeglądarkowy/niestandardowy (zgodnie z Angular 20 API `withComponentInputBinding`).

## 9. Warunki i walidacja
- `quantity` > 0 (walidator custom `positiveInteger`).
- `totalNetPln` > 0; `totalGrossPln` > 0; `totalGrossPln >= totalNetPln`.
- `eurRate` wymagany gdy `isEur`; brak => blokada zapisu i banner warning.
- `totalGrossEur` wymagany gdy `isEur`; w PLN powinno być `null` i pole disabled.
- Różnica między wyliczonym brutto a wpisanym ≤ 0.01 (helper `validateTotalsTolerance`); w przeciwnym razie error `toleranceExceeded`.
- `producerDiscountPct` i `distributorDiscountPct` suma ≤ 100 (logika biznesowa, aby rabaty nie przekraczały 100%).
- `orderDate` format ISO 8601, nie później niż dziś.
- `comment` po sanitizacji nie zawiera HTML (XSS guard).
- `deletedAt` -> blokada zapisu do czasu przywrócenia (wymaganie: edycja dozwolona? jeśli polityka zezwala – w planie: edycja tylko gdy `deletedAt` null; w przeciwnym razie pokaż info `Przywróć aby edytować`).

## 10. Obsługa błędów
- 404 (`NotFoundException`) → wyświetl `NzResult status="404"` + link powrotu.
- 403 (`ForbiddenException`) → `NzResult status="403"` + komunikat o braku uprawnień; formularz disabled.
- 409 (konflikt numeru zamówienia) → mapowany na walidację `orderNo` (pokaz w formularzu + toast `Numer zamówienia zajęty`).
- 400 walidacyjne (np. tolerancja) → zmapuj błędy backendu do `formState.errors`, highlight pól.
- 500/Unknown → globalny toast `Nie udało się zapisać. Spróbuj ponownie.` i log konsolowy.
- Błąd pobrania audytu → w panelu pokaż `nz-alert` i przycisk `Spróbuj ponownie`.
- Brak kursu NBP w API (jeśli docelowo implementowane) → banner warning + pozostawienie pola ręcznego.

## 11. Kroki implementacji
1. Utwórz trasę `/orders/:orderId` oraz plik `order-detail.routes.ts` z lazy load komponentu i `CanDeactivate` guardem.
2. Wygeneruj `OrderDetailPageComponent` (standalone, OnPush) oraz serwis `OrderDetailStore` w `apps/web/src/service/orders/order-detail.store.ts` z sygnałami i metodami API.
3. Zaimplementuj integrację API w `OrderDetailStore` (metody `fetchOrder`, `updateOrder`) wykorzystując istniejący `OrdersApiService` lub rozszerz go o `getOrderById`, `updateOrder`.
4. Przygotuj typy i helpery mapujące (`order-detail.mappers.ts`) przekształcające `OrderDetailDto` → `OrderDetailVm`/`OrderFormValue` oraz walidatory (`order-detail.validators.ts`).
5. Stwórz komponenty strukturalne: `OrderDetailHeaderComponent`, `OrderMetadataCardComponent`, `OrderActionsPanelComponent`, `FXRateBannerComponent`, `OrderFormComponent`, `AuditPanelComponent`, `AuditTimelineComponent`, `SkeletonDetailComponent` (pliki *.ts/*.html/*.scss zgodnie z konwencją standalone).
6. Zaimplementuj `OrderFormComponent` z Reactive Forms + sygnały (funkcja `signalForm`). Dodaj walidatory, synchronizację kursu EUR i helper obliczający brutto (wykorzystaj algorytm z PRD).
7. Dodaj `FxRateBanner` logic (sterowanie widocznością, kolorem, akcjami). W przypadku braku automatycznego pobierania kursu – oznacz TODO.
8. Wprowadź `AuditPanelComponent` z lazy load wpisów (opcjonalny resolver). Zapewnij integrację z ewentualnym endpointem lub wyświetl placeholder jeśli API niedostępne.
9. Podłącz `ConfirmDialogComponent` do akcji soft delete/przywracania. Jeśli backendowe endpointy nie istnieją, przygotuj stub metody i właściwe komunikaty.
10. Dodaj `CanDeactivate` guard (`dirty` formularz) i integrację z routerem.
11. Zaimplementuj obsługę ról: viewer widzi formularz w trybie read-only (HTML `readonly` + `disabled`, ukryte akcje). Editor/owner mają dostęp do edycji, soft delete, przywracania.
12. Zapewnij testy jednostkowe dla `OrderDetailStore` (mapowanie danych, walidacja tolerancji, obsługa błędów) oraz testy komponentów (rendering, emisja zdarzeń). Uzupełnij dokumentację w `.ai/orders-detail-view-implementation-plan.md` oraz w razie potrzeby update w `.cursor/ui-plan.md`.

