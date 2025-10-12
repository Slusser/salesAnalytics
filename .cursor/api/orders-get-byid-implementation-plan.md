# API Endpoint Implementation Plan: GET /orders/{orderId}

## 1. Przegląd punktu końcowego
- Zwraca szczegółowe dane pojedynczego zamówienia z tabeli `orders`, łącznie z powiązanym klientem i autorem rekordu.
- Dostępny dla ról `viewer`, `editor`, `owner`; przestrzega polityk RLS Supabase i ukrywa rekordy miękko usunięte przed `viewer`.
- Zapewnia jednolitą strukturę odpowiedzi (`OrderResponse`) do zasilania widoku szczegółowego w aplikacji webowej.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`.
- Struktura URL: `/api/orders/{orderId}` (prefiks globalny API zgodny z konfiguracją Nest).
- Nagłówki: `Authorization: Bearer <jwt>`, `Accept: application/json`.
- Parametry:
  - Wymagane: `orderId` (segment ścieżki, `uuid` w formacie v4).
  - Opcjonalne: brak (ew. rozszerzenia w przyszłości przez nagłówki funkcjonalne, np. `X-Include-Deleted` — obecnie nie używane).
- Body żądania: brak.
- Walidacja (`OrderIdParamDto` w `apps/api/src/app/orders/dto`): `@IsUUID('4')`, `@ApiParam` dla dokumentacji, globalny `ValidationPipe` z `forbidNonWhitelisted=true`.
- Powiązane typy wejściowe: `OrderIdParamDto` (Nest), `OrderRecord` (repozytorium) – mapowany do DTO w warstwie serwisu.

## 3. Szczegóły odpowiedzi
- Sukces: `200 OK` z payloadem `OrderResponse` (`apps/shared/dtos/orders.dto.ts`).
- Struktura: pola z bazy (`orderNo`, `orderDate`, `itemName`, wartości kwotowe, rabaty, `isEur`, `eurRate`, `totalGrossEur`, `comment`) plus relacje (`customer: Pick<CustomerDto, 'id' | 'name'>`, `createdBy: UserSummaryDto`) i znaczniki czasu (`createdAt`, `updatedAt`, `deletedAt`).
- Mapowanie: `OrderMapper.toDetailDto` konwertuje rekord Supabase (`numeric` → `number`, `timestamptz` → ISO string) na `OrderDetailDto`.
- Nagłówki: `Content-Type: application/json`, `Cache-Control: no-store` (zapobiega buforowaniu wrażliwych danych biznesowych).
- Błędy: struktura `{ code, message, details? }` zgodna z globalnym filtrem wyjątków.

## 4. Przepływ danych
1. Klient UI wysyła `GET /api/v1/orders/{orderId}` z tokenem Supabase.
2. `SupabaseAuthGuard` weryfikuje ważność JWT i osadza kontekst użytkownika (ID, role).
3. `RolesGuard` dopuszcza rolę `viewer` i wyższe; weryfikuje dodatkowo flagi, jeżeli w przyszłości pojawią się rozszerzenia.
4. `OrdersController.getOrder` odbiera `OrderIdParamDto`, loguje próbę (Logger debug) bez ujawniania pełnego numeru zamówienia.
5. Kontroler deleguje do `OrdersQueryService.getById(orderId, actorContext)`.
6. Serwis:
   - Sprawdza, czy `viewer` nie próbuje dostępu do rekordu z `deletedAt != null`; w razie potrzeby wywołuje dodatkowe zapytanie kontrolne lub polega na RLS.
   - Wywołuje `OrdersRepository.findById(orderId, { includeDeleted: role != 'viewer' })`, które korzysta z Supabase clienta (`from('orders').select(...).eq('id', orderId)`), dołącza relacje `customers`, `users`.
   - Mapuje wynik na `OrderDetailDto` (formatter dat ISO, liczby `number` zamiast `string` – użycie `@Transform` lub mapowania manualnego).
   - Opcjonalnie emituje telemetryczne zdarzenie `order.viewed` (asynchronicznie, aby nie blokować odpowiedzi).
7. Kontroler zwraca zmapowaną odpowiedź do klienta.

## 5. Względy bezpieczeństwa
- Wymagane uwierzytelnianie JWT; wszystkie trasy oznaczone `@ApiBearerAuth` i objęte guardami.
- RLS Supabase uniemożliwia podgląd zamówień z innych tenantów/użytkowników; brak możliwości enumeracji ID.
- Miękko usunięte rekordy (`deletedAt`) dostępne tylko dla `editor`/`owner`; `viewer` otrzymuje `404` (maskowanie istnienia rekordu).
- Walidacja UUID zapobiega próbom wstrzyknięć oraz nadużyciom.
- Logowanie o ograniczonej szczegółowości (maskowanie `orderNo`, `customerName`) oraz korelacja `requestId` dla audytu.
- Brak wrażliwych danych w odpowiedzi (np. wewnętrzne identyfikatory klientów lub użytkowników ograniczone do minimum).

## 6. Obsługa błędów
- `400 Bad Request`: nieprawidłowy UUID w parametrze ścieżki (wyjątek `BadRequestException` rzucony przez `ValidationPipe`).
- `401 Unauthorized`: brak/niepoprawny token (guard rzuca `UnauthorizedException`).
- `403 Forbidden`: `viewer` próbuje uzyskać dostęp do rekordu z `deletedAt != null` (serwis lub RLS zwraca błąd; mapowany na `ForbiddenException`).
- `404 Not Found`: zamówienie nie istnieje lub zostało miękko usunięte, a rola nie uprawnia do podglądu.
- `500 Internal Server Error`: nieoczekiwane błędy Supabase/połączeń, logowane wraz z `requestId`, odpowiedź bez danych wrażliwych.

## 7. Wydajność
- Zapytanie ograniczone do pojedynczego rekordu, ale należy ograniczyć projekcję pól (`select` tylko wymagane kolumny) i korzystać z indeksu PK (`orders_pkey`) dla szybkiego dostępu.
- Prefetch relacji (`customers`, `users`) jednym zapytaniem, aby uniknąć dodatkowych round-tripów.

## 8. Kroki implementacji
1. Utworzyć `OrderIdParamDto` (`apps/api/src/app/orders/dto/order-id-param.dto.ts`) z dekoratorami `class-validator` oraz opisem Swagger (`@ApiParam`).
2. Rozbudować `OrdersRepository` o metodę `findById` z konfiguracją `select` (`orders` + `customer:customers!inner` + `createdBy:users!inner`) oraz obsługą `includeDeleted`.
3. Dodać w `OrdersQueryService` metodę `getById`, która zarządza uprawnieniami do rekordów miękko usuniętych, mapowaniem oraz obsługą `NotFound`/`Forbidden`.
4. Zaktualizować `OrdersController` (lub utworzyć, jeśli brak) o handler `@Get(':orderId')`, wstrzykujący serwis zapytań, dekoratory Swagger (`@ApiOperation`, `@ApiOkResponse`, `@ApiNotFoundResponse`, `@ApiForbiddenResponse`).
5. Utworzyć mapper (`OrderMapper.toDetailDto`) w module zamówień lub w bibliotece współdzielonej, dbając o konwersję typów (`numeric` → `number`).
8. Uzupełnić dokumentację Swagger oraz, w razie zmian, pliki `.cursor/api-plan.md`.

