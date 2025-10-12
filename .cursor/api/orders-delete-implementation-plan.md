# API Endpoint Implementation Plan: DELETE /orders/{orderId}

## 1. Przegląd punktu końcowego
- Zapewnia miękkie usunięcie rekordu zamówienia w tabeli `orders` poprzez ustawienie `deleted_at`, zachowując historię w `audit_log` i emitując telemetry `order.deleted` (lub reuse `order.saved`).
- Dostęp ograniczony do uwierzytelnionych użytkowników z rolą `editor` lub `owner`; strażniki Supabase JWT oraz RLS wymuszają kontekst tenantowy.
- Operacja jest idempotentna – wielokrotne wywołanie na tym samym zasobie zwraca `404` (brak aktywnego zamówienia).

## 2. Szczegóły żądania
- Metoda HTTP: `DELETE`.
- Struktura URL: `/api/orders/{orderId}` (prefiks wersji zgodny z konfiguracją NestJS).
- Nagłówki: `Authorization: Bearer <jwt>`, `X-Request-Id` (opcjonalny, propagowany do logów).
- Parametry:
  - Wymagane: `orderId` (UUID v4) – walidacja w `OrderIdParamDto` (`@IsUUID('4')`).
  - Opcjonalne: brak (flagi typu `hardDelete` nieobsługiwane w MVP).
- Request Body: brak (pełna semantyka HTTP DELETE).
- Wykorzystywane typy: `DeleteOrderCommand` (apps/shared/dtos/orders.dto.ts), `OrderIdParamDto` (nowy DTO w `apps/api/src/orders/dto`), `AuthenticatedUser`/`RequestActor` (istniejący kontekst guardów).

## 3. Szczegóły odpowiedzi
- Sukces: `204 No Content`, brak ciała odpowiedzi, nagłówek `Cache-Control: no-store`.
- Błędy: JSON w standardzie `{ "code": string, "message": string, "details"?: Record<string, unknown> }` zgodnie z globalnym filtrem wyjątków.
- Kody statusu: `400`, `401`, `403`, `404`, `500` (szczegóły w sekcji 6).

## 4. Przepływ danych
- Klient wywołuje `DELETE /orders/{orderId}` z tokenem Supabase JWT.
- `SupabaseAuthGuard` weryfikuje token i dołącza kontekst użytkownika; `RolesGuard` sprawdza role (`editor`, `owner`).
- `OrdersController.delete` parsuje `OrderIdParamDto`, loguje próbę (`Logger.debug`) z zamaskowanym `orderId`, tworzy `DeleteOrderCommand` i przekazuje do serwisu.
- `OrdersService.delete(orderId, actor)`:
  - Potwierdza role aktora (wczesny guard) i składa identyfikator klienta/tenanta z guardów.
  - Pobiera aktywne zamówienie (`OrdersRepository.findActiveById(orderId, actorTenant)`), wraz z `deleted_at`; brak → `NotFoundException`.
  - W ramach transakcji Supabase: aktualizuje rekord (`deleted_at = now()`, `updated_at = now()`, `deleted_by = actorId` jeżeli kolumna istnieje) poprzez `OrdersRepository.softDelete`.
  - Rejestruje wpis w `audit_log` (akcja `DELETE`, `old_row` = poprzedni stan, `new_row` = null) z `actor` i `request_id`.
  - Emisja telemetry/zdarzenia domenowego (`telemetryService.emitOrderDeleted(order)`) asynchronicznie.
- Serwis kończy bez danych zwrotnych; kontroler zwraca `204`.
- Centralny `ExceptionFilter` mapuje błędy repozytorium (`PostgrestError`) na odp. HTTP.

## 5. Względy bezpieczeństwa
- Uwierzytelnianie: `@ApiBearerAuth()` + `SupabaseAuthGuard` (JWT weryfikowany przez Supabase).
- Autoryzacja: `RolesGuard` + weryfikacja w serwisie, że aktor ma rolę `editor`/`owner`; RLS w Supabase odcina dostęp do rekordów innych tenantów oraz aktywnych/nieaktywnych zasobów.
- Walidacja danych wejściowych uniemożliwia ataki typu path traversal/SQLi (UUID, brak ciała żądania);
- Logi (`Logger`) maskują identyfikatory (np. wyświetlanie tylko prefiksu) i zawierają `requestId` dla korelacji; brak wrażliwych danych w komunikatach.
- Odpowiedzi błędów nie ujawniają, czy ID kiedykolwiek istniało (404 zarówno dla braku rekordu, jak i już usuniętego) ograniczając enumerację.

## 6. Obsługa błędów
- `400 Bad Request`: niepoprawny UUID w ścieżce (walidacja DTO) lub naruszenie dodatkowych reguł (np. Supabase zwróci błąd formatu).
- `401 Unauthorized`: brak lub niepoprawny token JWT (obsługiwane przez guard autentykacji).
- `403 Forbidden`: użytkownik bez roli `editor`/`owner`, lub RLS odrzuca aktualizację (mapowane na `ForbiddenException`).
- `404 Not Found`: zamówienie nie istnieje, należy do innego tenanta, lub już ma `deleted_at != null`.
- `500 Internal Server Error`: błędy Supabase (np. awaria transakcji), problem z audytem/telemetrią; logować `Logger.error`, wysyłać do systemu monitoringu (np. Sentry). Brak dedykowanej tabeli błędów – korzystamy z istniejącej infrastruktury logującej.

## 7. Wydajność
- Operacja wykonuje jedno zapytanie SELECT + jedno UPDATE w transakcji; indeks `orders_soft_delete_idx` przyspiesza wyszukiwanie aktywnych rekordów.
- Brak serializacji odpowiedzi zmniejsza koszty I/O; telemetria wykonywana asynchronicznie, aby nie blokować odpowiedzi.
- Zapewnienie ponownego użycia połączenia Supabase (singleton klienta) i brak zbędnych mapowań minimalizuje narzut.
- Audyt wykonywany triggerem lub dedykowaną usługą w tej samej transakcji – brak dodatkowych okrążeń do bazy.

## 8. Kroki implementacji
1. **DTO**: utworzyć/rozszerzyć `order-id-param.dto.ts` z `@IsUUID('4')` i dodać dekoratory Swagger `@ApiParam`/`@ApiProperty`.
2. **Controller**: w `OrdersController` dodać metodę `@Delete(':orderId')`, zastosować `@UseGuards(SupabaseAuthGuard, RolesGuard)`, dekoratory Swagger (`@ApiNoContentResponse`, `@ApiUnauthorizedResponse`, itp.).
3. **Serwis**: zaimplementować `OrdersService.delete(orderId: string, actor: RequestActor)` z walidacją ról, pobraniem rekordu, delegacją do repozytorium i obsługą audytu/telemetrii.
4. **Repozytorium**: dodać metody `findActiveById` i `softDelete` korzystające z Supabase (`eq('deleted_at', null)`), mapować kody błędów na wyjątki Nest (`NotFound`, `Forbidden`).
5. **Audyt i telemetry**: upewnić się, że transakcja zapisuje wpis do `audit_log` oraz wywołuje `TelemetryService` (fire-and-forget); użyć istniejących helperów.
7. **Dokumentacja i jakość**: zaktualizować Swagger (`OrdersController`), sprawdzić linting (`nx lint api`), oraz dopisać notatkę w `.cursor/api-plan.md` jeśli zmieniają się szczegóły zachowania.

