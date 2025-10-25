# Plan implementacji widoku Orders New

## 1. Przegląd
Widok `Orders New` umożliwia użytkownikom z rolą `editor` oraz `owner` utworzenie pojedynczego zamówienia wraz z lokalnym podglądem wyliczeń kwotowych oraz opcjonalnym wypełnieniem formularza na podstawie importu pliku XLSX. Ekran musi zapewniać walidacje inline, informować o brakującym kursie EUR, ostrzegać przed utratą zmian oraz obsługiwać błędy zwracane przez API (m.in. konflikt unikalności numeru zamówienia).

## 2. Routing widoku
- Ścieżka: `/orders/new`.
- Konfiguracja w `apps/web/src/app/app.routes.ts` z lazy load komponentu `OrdersNewPageComponent`.
- Zastosować funkcjonalny `canDeactivate` guard (`provideRouter([{ path: 'orders/new', loadComponent: ..., canDeactivate: [ordersNewCanDeactivateGuard] }])`).

## 3. Struktura komponentów
- `OrdersNewPageComponent` (kontener widoku)
  - `FxRateBannerComponent`
  - `OrderFormComponent`
    - `NumericInputDirective`
    - `OrderCalculationPreviewComponent`
    - `LoaderButtonComponent` (przycisk „Zapisz zamówienie”)
    - `LoaderButtonComponent` lub `button` dla „Wyczyść formularz”
  - `ImportXlsxPanelComponent`
  - `NzAlert` / `NzMessage` (komunikaty błędów)
  - Dialog potwierdzenia opuszczenia (obsługiwany w guardzie `CanDeactivate`)

## 4. Szczegóły komponentów
### OrdersNewPageComponent
- Opis komponentu: kontener strony odpowiedzialny za orkiestrację stanu (sygnały), integrację z serwisami (`OrdersCreateService`, `FxRateService`, `OrdersImportService`), obsługę CanDeactivate i mapowanie błędów API.
- Główne elementy: `<section>` z nagłówkiem i opisem, slot na baner kursowy, formularz zamówienia, panel importu, sekcja komunikatów.
- Obsługiwane interakcje: `onSubmit`, `onCancel`, `onImportSuccess`, `onImportReset`, `onFxRateRefetch`, `onFormDirtyChange`.
- Obsługiwana walidacja: kontrola ról (redirect dla viewer), blokada wysyłki przy błędach formularza, potwierdzenie opuszczenia przy stanie dirty, walidacja limitów importu (1 MB, 1 arkusz) oraz obsługa błędów API (400/403/409/500).
- Typy: `OrdersNewPageState`, `OrderFormModel`, `OrderServerErrorState`, `ImportPanelState`, `FxRateState`.
- Propsy: brak (top-level); wykorzystuje sygnały i dependency injection.

### OrderFormComponent
- Opis komponentu: główny formularz reaktywny (standalone) umożliwiający wprowadzanie danych zamówienia, prezentujący walidacje inline oraz sekcję podglądu kalkulacji. Wydzielony do `apps/web/src/app/shared/components/orders/order-form` dla potencjalnego reuse.
- Główne elementy: pola `nz-input` (`orderNo`, `itemName`), `nz-select` (`customerId`, `currencyCode`), `nz-date-picker`, `nz-input-number`/`numeric-input` dla liczb (`quantity`, `producerDiscountPct`, `distributorDiscountPct`, `vatRatePct`, `totalNetPln`, `totalGrossPln`, `totalGrossEur`, `eurRate`), sekcja `OrderCalculationPreviewComponent`, przyciski `LoaderButtonComponent` (Zapisz) i zwykły (Anuluj/Wyczyść), `nz-alert` dla błędów specyficznych pól.
- Obsługiwane interakcje: `formChange` (sygnał dirty), `submit`, `reset`, `fieldBlur` (walidacja), `currencyChange` (wymusza eurRate), `calcTrigger` (przeliczenia).
- Obsługiwana walidacja: wymagane pola (orderNo, customerId, itemName, quantity > 0, totalNetPln ≥ 0, totalGrossPln ≥ 0, orderDate), `currencyCode === 'EUR'` → wymagany `eurRate` i `totalGrossEur`, `currencyCode === 'PLN'` → blokada `eurRate/totalGrossEur`, ograniczenia procentów (0–100), tolerancja netto↔brutto ±0,01, unikalność numeru (informacja z API 409), walidacja daty (ISO, nieprzyszła jeśli wymagane), limit długości napisów.
- Typy: `OrderFormModel`, `OrderFormControls`, `OrderFormValidationMessages`, `OrderCalculationInput`, `OrderCalculationResult`.
- Propsy: `{ model: OrderFormModel; submitting: boolean; serverErrors: OrderFormServerErrors | null; customers$: Observable<CustomerOptionVm[]>; onSubmit: (model) => void; onCancel: () => void; onDirtyStateChange: (dirty: boolean) => void; onRecalculate: (input: OrderCalculationInput) => void; }`.

### OrderCalculationPreviewComponent
- Opis komponentu: prezentuje wynik kalkulacji netto→brutto na podstawie aktualnych wartości formularza oraz tolerancję błędu.
- Główne elementy: `nz-card` z tabelą wartości (Netto, Rabat producenta, Rabat dystrybutora, VAT, Brutto PLN, Brutto EUR jeśli dotyczy), badge informujące o przekroczeniu tolerancji.
- Obsługiwane interakcje: brak aktywnych interakcji (tylko prezentacja); reaguje na zmiany wejściowego modelu.
- Obsługiwana walidacja: sygnalizuje status `withinTolerance` oraz `needsCorrection` (np. kolor czerwony przy przekroczeniu ±0,01).
- Typy: `OrderCalculationResult`.
- Propsy: `{ calculation: OrderCalculationResult; currency: 'PLN' | 'EUR'; }`.

### FxRateBannerComponent
- Opis komponentu: baner informujący o aktualnym kursie EUR użytym w formularzu, z możliwością ponownego pobrania kursu lub ręcznego wpisania.
- Główne elementy: `nz-alert` lub `nz-banner` z treścią, przyciskiem „Odśwież kurs NBP”, informacją o dacie kursu, możliwością przełączenia trybu manualnego.
- Obsługiwane interakcje: `refreshRequested`, `manualOverrideToggled`, `manualRateChanged`.
- Obsługiwana walidacja: sprawdzenie czy kurs > 0 i liczbowy; sygnalizacja błędu przy braku kursu.
- Typy: `FxRateState`, `FxRateOverride`.
- Propsy: `{ state: FxRateState; currency: string; disabled: boolean; }`.

### ImportXlsxPanelComponent
- Opis komponentu: panel pomocniczy umożliwiający użytkownikowi import jednego pliku XLSX, mapowanie kolumn i automatyczne uzupełnienie formularza.
- Główne elementy: `nz-upload` (tryb drag&drop), tabela mapowania (dropdown kolumn -> pola formularza), lista błędów (`nz-alert`), przyciski „Zastosuj do formularza”, „Resetuj panel”.
- Obsługiwane interakcje: `fileSelected`, `mappingChange`, `apply`, `reset`.
- Obsługiwana walidacja: rozmiar pliku ≤ 1 MB, liczba arkuszy = 1, obecność nagłówków, poprawność formatu A1 (numer – kontrahent), walidacja typów danych (ilość liczbowa, daty). Przy błędach wyświetlenie listy i blokada przycisku „Zastosuj”.
- Typy: `ImportPanelState`, `ImportMappingOption`, `ImportXlsxPreview`, `ImportValidationIssue`.
- Propsy: `{ state: ImportPanelState; disabled: boolean; onApply: (model: Partial<OrderFormModel>) => void; onReset: () => void; }`.

### NumericInputDirective
- Opis komponentu: dyrektywa formatująca wartości liczbowe zgodnie z wymaganiami (przecinek dziesiętny, 2 miejsca, blokada znaków niecyfrowych).
- Główne elementy: dyrektywa na elementach `input[type="text"]` / `nz-input-number`.
- Obsługiwane interakcje: `input`, `blur` (normalizacja), `keydown` (blokada liter).
- Obsługiwana walidacja: limit miejsc, konwersja na `number` w modelu formularza.
- Typy: `NumericInputConfig`.
- Propsy: `@Input() numericInput: NumericInputConfig` (np. `min`, `max`, `decimals`, `allowNegative`).

### LoaderButtonComponent
- Opis komponentu: istniejący wspólny przycisk z animacją ładowania; użycie w formularzu do wysyłki.
- Główne elementy: `button` z ikoną spinnera.
- Obsługiwane interakcje: `click` (delegowane).
- Obsługiwana walidacja: blokada kliknięcia podczas `loading` lub gdy formularz niepoprawny.
- Typy: korzysta z istniejących.
- Propsy: `{ loading: boolean; disabled: boolean; type: 'submit' | 'button'; }`.

### ordersNewCanDeactivateGuard (funkcja)
- Opis: funkcjonalny guard zwracający `true` lub `confirm$` na podstawie stanu dirty w `OrdersNewPageComponent`.
- Główne elementy: dialog `NzModalService.confirm` z pytaniem o porzucenie zmian.
- Obsługiwane interakcje: potwierdzenie, anulowanie.
- Walidacja: dotyczy tylko `formDirty === true`.
- Typy: `CanDeactivateFn<OrdersNewPageComponent>`.
- Propsy: nie dotyczy.

## 5. Typy
- `OrderFormModel`:
  - `orderNo: string`
  - `customerId: string`
  - `orderDate: string` (ISO `yyyy-MM-dd`)
  - `itemName: string`
  - `quantity: number`
  - `currencyCode: 'PLN' | 'EUR'`
  - `eurRate?: number`
  - `producerDiscountPct: number`
  - `distributorDiscountPct: number`
  - `vatRatePct: number`
  - `totalNetPln: number`
  - `totalGrossPln: number`
  - `totalGrossEur?: number`
  - `comment?: string`
  - `isEur: boolean` (pochodne `currencyCode === 'EUR'`)
- `OrderFormServerErrors`:
  - `generalError?: string`
  - `fieldErrors?: Partial<Record<keyof OrderFormModel, string>>`
  - `conflictOrderNo?: string`
- `OrderCalculationInput`:
  - `net: number`
  - `producerDiscountPct: number`
  - `distributorDiscountPct: number`
  - `vatRatePct: number`
  - `currency: 'PLN' | 'EUR'`
  - `eurRate?: number`
- `OrderCalculationResult`:
  - `netAfterProducer: number`
  - `netAfterDistributor: number`
  - `vatAmount: number`
  - `grossPln: number`
  - `grossEur?: number`
  - `differencePln: number`
  - `differenceEur?: number`
  - `withinTolerance: boolean`
- `FxRateState`:
  - `status: 'idle' | 'loading' | 'loaded' | 'error'`
  - `rate?: number`
  - `sourceDate?: string`
  - `message?: string`
  - `manualOverride: boolean`
- `ImportPanelState`:
  - `status: 'idle' | 'parsing' | 'mapped' | 'error'`
  - `fileName?: string`
  - `size?: number`
  - `mapping: ImportMappingOption[]`
  - `preview?: ImportXlsxPreview`
  - `issues: ImportValidationIssue[]`
- `ImportMappingOption`:
  - `field: keyof OrderFormModel`
  - `column?: string`
  - `required: boolean`
- `ImportXlsxPreview`:
  - `rawRow: Record<string, string | number | Date>
  - `parsedModel: Partial<OrderFormModel>`
- `ImportValidationIssue`:
  - `type: 'format' | 'required' | 'range' | 'duplicate' | 'unknown'`
  - `message: string`
  - `location?: { row: number; column?: string }`
- `CreateOrderPayload` (do `OrdersCreateService`): zgodny z `CreateOrderDto` (przekształcony z `OrderFormModel`).
- `OrdersNewPageState`:
  - `formModel: OrderFormModel`
  - `calculation: OrderCalculationResult`
  - `formDirty: boolean`
  - `submitting: boolean`
  - `serverErrors: OrderFormServerErrors | null`
  - `fxRate: FxRateState`
  - `importState: ImportPanelState`

## 6. Zarządzanie stanem
- Dedykowany serwis `OrdersNewStore` (standalone `injectable`) w katalogu widoku. Zawiera sygnały: `formModel`, `dirty`, `calculation`, `serverErrors`, `fxRateState`, `importState`, `submitting`.
- Obliczenia wykonywane przez funkcję `computeOrderTotals(input: OrderCalculationInput)` z wynikami w sygnałach; wywoływana w `effect` na zmianę wartości formularza.
- Integracja z RxJS dla listy kontrahentów (np. `CustomersLookupService`) – sygnał `customersOptions` z `toSignal()`.
- Guard `CanDeactivate` korzysta z sygnału `dirty` udostępnionego przez `OrdersNewStore` (np. `inject(OrdersNewStore).dirty()`).
- Import panel aktualizuje `formModel` poprzez metodę `OrdersNewStore.patchForm(partial)` z automatycznym przeliczeniem kalkulacji i oznaczeniem `dirty`.

## 7. Integracja API
- `OrdersCreateService.createOrder(payload: CreateOrderPayload): Observable<OrderResponse>` – POST `/api/orders`.
  - Request body: pola zgodne z `CreateOrderDto` (`orderNo`, `customerId`, `orderDate`, `itemName`, `quantity`, `isEur`, `eurRate?`, `producerDiscountPct`, `distributorDiscountPct`, `vatRatePct`, `totalNetPln`, `totalGrossPln`, `totalGrossEur?`, `comment?`).
  - Response: `OrderResponse` – wykorzystać do przekierowania na `/orders/{id}`.
- `FxRateService.getRate(date: string): Observable<FxRateDto>` – GET endpoint kursów (jeśli brak, zaplanować integrację z istniejącym API backendu; fallback manualny).
- `CustomersLookupService.search(term: string)` – już istniejące (do selecta kontrahentów).
- Brak dedykowanego endpointu do importu – logika parsowania po stronie klienta.
- Po udanym POST emitować `telemetryService.emit('order.saved', { orderId, userId })` jeśli istnieje analogiczna infrastruktura (zgodnie z PRD).

## 8. Interakcje użytkownika
- Wypełnianie pól formularza → natychmiastowa walidacja inline i aktualizacja podglądu kalkulacji.
- Zmiana waluty na EUR → automatycznie pokazuje pole kursu i Brutto EUR; brak kursu → `FxRateBannerComponent` pokazuje komunikat i przycisk pobrania.
- Kliknięcie „Odśwież kurs NBP” → steruje `FxRateService`, aktualizuje pola formularza i podgląd.
- Import pliku XLSX → panel waliduje plik, pozwala użytkownikowi zmapować kolumny i po zatwierdzeniu nadpisuje wartości w formularzu.
- Przy próbie zamknięcia widoku z niezapisanymi zmianami → `CanDeactivate` wyświetla dialog potwierdzenia.
- Kliknięcie „Zapisz zamówienie” → walidacja formularza, wysyłka POST; w trakcie `LoaderButton` pokazuje spinner.
- Po sukcesie → komunikat toast, przekierowanie do `/orders/{newId}`.
- Po błędzie 409 → wyświetlenie błędu przy polu `orderNo` („Zamówienie o tym numerze już istnieje”).
- Kliknięcie „Wyczyść formularz”/„Resetuj import” → reset sygnałów, oznaczenie `dirty=false`.

## 9. Warunki i walidacja
- Formularz: wszystkie pola wymagane zgodnie z US-003; walidacje liczb i zakresów; walidacja daty (ISO, `orderDate` nieprzyszła jeśli taki wymóg zostanie doprecyzowany); `comment` limit długości (np. 1000 znaków).
- Spójność netto↔brutto: `|totalGrossPln - calculation.grossPln| ≤ 0.01`; analogicznie dla EUR gdy dotyczy. W przeciwnym razie UI blokuje zapis i pokazuje ostrzeżenie.
- Kurs EUR: `eurRate` > 0, `totalGrossEur` > 0; w trybie PLN pola te są disable/cleared.
- Import: walidacja formatu nagłówków, rozmiaru, arkuszy, typów danych; błędy uniemożliwiają `apply`.
- Roles: widok dostępny tylko dla `editor`/`owner`; w przypadku braku uprawnień – przekierowanie na `/orders` i komunikat.
- CanDeactivate: `formDirty === true` → wymaga potwierdzenia.

## 10. Obsługa błędów
- 400 (`ORDERS_CREATE_VALIDATION`): mapowanie `details[]` do `fieldErrors`; prezentacja inline + toast ogólny.
- 403 (`ORDERS_CREATE_FORBIDDEN`): redirect do `/orders`, `NzMessage.error('Brak uprawnień do tworzenia zamówień.')`.
- 409 (`ORDERS_CREATE_CONFLICT`): ustawienie błędu formularza `orderNo` („Numer zamówienia musi być unikalny”).
- 500 (`ORDERS_CREATE_FAILED`): `NzMessage.error('Nie udało się utworzyć zamówienia. Spróbuj ponownie.')`, pozostawienie danych.
- Błąd pobrania kursu: `FxRateState.status = 'error'`, baner z komunikatem i opcją ręcznego wpisu.
- Błędy importu: lista `ImportValidationIssue` w panelu; nie pozwala na `apply`.
- Błędy sieci: globalny interceptor + fallback `NzMessage`.
- Po każdym błędzie formularz pozostaje edytowalny, `submitting` resetowane do `false`.

## 11. Kroki implementacji
1. Utwórz katalog `apps/web/src/app/pages/orders/new` oraz pliki komponentu `orders-new.page.ts/html/scss`.
2. Zaimplementuj `OrdersNewStore` (sygnały stanu, metody `patchForm`, `setFxRate`, `setServerErrors`, `reset`).
3. Dodaj `OrdersCreateService` (POST `/api/orders`) oraz zaktualizuj publiczny index usług jeśli wymagane.
4. Stwórz `OrderCalculationService`/util w `shared` (funkcja `computeOrderTotals`) wraz z testami jednostkowymi potwierdzającymi tolerancję ±0,01.
5. Wygeneruj `OrderFormComponent` z formularzem reaktywnym, wykorzystując dyrektywę `NumericInputDirective` i `LoaderButtonComponent`; podłącz walidacje inline oraz `OrderCalculationPreviewComponent`.
6. Zaimplementuj `OrderCalculationPreviewComponent` (standalone) prezentujący dane z kalkulacji.
7. Dodaj `FxRateBannerComponent` wykorzystujący `FxRateState`; podłącz przyciski odświeżania kursu (wywołania `FxRateService`).
8. Zaimplementuj `ImportXlsxPanelComponent` wraz z usługą `OrdersImportService` korzystającą z biblioteki `xlsx`. Zapewnij walidacje limitów i mapowanie nagłówków.
9. Utwórz funkcjonalny `ordersNewCanDeactivateGuard` (w katalogu widoku) wykorzystujący `NzModalService` oraz sygnał `dirty`.
10. W `OrdersNewPageComponent` połącz wszystkie komponenty: pobranie listy kontrahentów, obsługa importu, integracja z guardem, mapowanie błędów API.
11. Dodaj routing `/orders/new` w `app.routes.ts` z lazy load i guardem; skonfiguruj RBAC w routerze (np. `canMatch` guard sprawdzający role) jeśli istnieje.
12. Zaimplementuj mapowanie błędów API w `OrdersCreateService` / `OrdersNewPageComponent` (analogiczne do `CustomersNew` ale z dodatkowymi kodami).
13. Dodaj testy jednostkowe: kalkulacje, walidacje formularza, import panel (mapowanie i błędy), guard `CanDeactivate`.
14. Uzupełnij dokumentację w `.ai/orders-new-view-implementation-plan.md` (bieżący plik) oraz odnotuj wymagane zadania backendowe (np. endpoint kursów, jeśli brak) w backlogu.
15. Przeprowadź weryfikację manualną: wypełnienie formularza PLN/EUR, import pliku OK/KO, obsługa błędów 400/409, guard CanDeactivate.
