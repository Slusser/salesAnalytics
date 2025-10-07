# Dokument wymagań produktu (PRD) - SalesAnalysis (MVP)

## 1. Przegląd produktu

SalesAnalysis (MVP) to webowa aplikacja do ewidencji i analizy zamówień B2B, integrująca dane w jednym miejscu oraz dostarczająca podstawowe analizy i trendy sprzedaży. System umożliwia wprowadzanie zamówień ręcznie i poprzez import XLSX, ich walidację, przeliczanie kwot według zdefiniowanego algorytmu oraz prezentację metryk na dashboardzie. Dostęp do danych jest kontrolowany przez role użytkowników.

Zakres MVP koncentruje się na niezawodnym CRUD zamówień z audytem, imporcie danych zgodnym ze wzorcem, kalkulacjach netto→brutto z rabatami i VAT, podstawowych raportach w PLN oraz prostym RBAC opartym o Supabase.

Kluczowi interesariusze: kierownicy sprzedaży (editor), analitycy/zarząd (viewer), administrator IT (admin).

## 2. Problem użytkownika

Organizacje śledzą zamówienia w wielu skoroszytach i plikach, co utrudnia spójny wgląd w sprzedaż, zwiększa ryzyko błędów (duplikaty, niespójne przeliczenia walut/VAT) i utrudnia szybkie raportowanie. Brakuje jednego miejsca do wprowadzania, porządkowania i analizowania zamówień oraz prostego widoku trendów i KPI. SalesAnalysis rozwiązuje to, centralizując dane, pilnując reguł walidacji i udostępniając czytelny dashboard z filtrami.

## 3. Wymagania funkcjonalne

3.1 Uwierzytelnianie, role i zarządzanie użytkownikami

1) RBAC: role viewer (podgląd), editor/kierownik (podgląd + dodawanie/edycja/usuwanie), admin (jak editor + zarządzanie użytkownikami). Brak ograniczeń per-kontrahent. Brak locków edycji.
2) Uwierzytelnianie i role przez Supabase. Admin tworzy konto i nadaje hasło (bez zaproszeń/resetu).
3) Niewłaściwe uprawnienia blokują akcje modyfikujące. Ekrany i akcje są ukryte/wyłączone zgodnie z rolą.

3.2 Model danych i identyfikacja rekordów

1) Zamówienie: wewnętrzny GUID, unikalny numer zamówienia, nazwa kontrahenta, nazwa elementu, ilość sztuk, kwota netto, kwota brutto, rabat producenta (%), rabat dystrybutora (%), waluta (PLN/EUR), kurs EUR (wymagany dla EUR), data zamówienia.
2) Unikalność numeru zamówienia: brak duplikatów; błąd unikalności przy próbie zapisu. Zakres unikalności domyślnie globalny w MVP (do doprecyzowania).
3) Data zamówienia: z formatki przy ręcznym wprowadzaniu; przy imporcie z pliku – z daty utworzenia pliku (do ponownej oceny).

3.3 CRUD zamówień, walidacja i audyt

1) Dodawanie, odczyt, przeglądanie, edytowanie i usuwanie zamówień (CRUD) zgodnie z rolami.
2) Walidacje: istnienie kontrahenta, unikalny numer, wymagane pola, poprawność typów, spójność netto↔brutto z tolerancją ±0,01, wymagany kurs EUR dla waluty EUR.
3) Algorytm kalkulacji: netto → rabat producenta (%) → rabat dystrybutora (%) → VAT 23% → brutto; stały VAT 23%; tolerancja rozbieżności ±0,01. Zasady zaokrągleń do potwierdzenia.
4) Audyt zmian: zapis autora, daty i czasu, wartości przed/po w formacie JSON; wpis audytowy dla każdej operacji modyfikującej.
5) Telemetria MVP: logowanie zdarzenia „zapis zamówienia do bazy”.

3.4 Import XLSX (tryb wczytaj i popraw)

1) Plik XLSX: 1 arkusz, maks. 1 MB; stały wzorzec nagłówków. A1 w formacie „numer zamówienia – nazwa kontrahenta” (separator: myślnik).
2) Prewalidacja: wczytaj i popraw – interfejs mapowania kolumn, podświetlenie błędów w komórkach/wierszach, raport błędów z opisami.
3) Brak paska progresu w MVP. Brak idempotentnej aktualizacji; duplikat numeru zamówienia kończy się błędem i nie zapisuje rekordu.
4) Źródło daty zamówienia przy imporcie: z daty utworzenia pliku (do ponownej oceny wiarygodności).

3.5 Kursy walut i kalkulacje

1) Waluta raportowa i agregacyjna: PLN. Kurs NBP z daty zamówienia; możliwość ręcznej zmiany kursu dla editor/admin.
2) Dla waluty EUR kurs jest wymagany; po zmianie kursu przeliczenia i KPI automatycznie się aktualizują.

3.6 Dashboard i analityka

1) Widok domyślny: roczny. Po wyborze miesiąca – widok dzienny.
2) Filtry: kontrahent i zakres czasu. Trend m/m kalendarzowy.
3) KPI: suma netto, liczba zamówień, średnia wartość zamówienia. Agregacja w PLN.
4) Brak drill-downu w MVP.

3.7 Lista zamówień i eksport

1) Lista z paginacją, sortowanie domyślne: od najnowszych.
2) Filtry spójne z dashboardem. Eksport wyników do XLSX według zastosowanych filtrów/sortowania.

3.8 Kopie zapasowe i zgodność

1) Tygodniowy backup z roczną retencją. Możliwość odtworzenia potwierdzona procedurą testową.
2) RODO obowiązuje. Brak szyfrowania at-rest zaakceptowany w MVP; rozważyć szyfrowanie backupów i ścisłą kontrolę dostępu.

3.9 Niefunkcjonalne i ograniczenia

1) Skala: mała organizacja; brak formalnych wymagań wydajnościowych/SLA. Brak limitu wierszy w imporcie poza rozmiarem 1 MB.
2) Brak retencji danych poza operacjami CRUD.
3) Brak śledzenia realizacji zamówień/ wysyłki.

## 4. Granice produktu

4.1 Poza zakresem MVP

1) Rekomendacje sprzedaży.
2) Zapis wczytanych plików XLSX w repozytorium.
3) Tracking stanu realizacji zamówienia i wysyłki.
4) Pasek progresu przy imporcie.
5) Idempotentna aktualizacja istniejących zamówień przez import.
6) Szyfrowanie danych at-rest (akceptowane ryzyko na MVP; możliwe rozszerzenie dot. backupów).
7) Reset haseł, zaproszenia e-mail, MFA (do decyzji poza MVP).
8) Drill-down w dashboardzie i zaawansowane KPI.

4.2 Otwarte kwestie do doprecyzowania

1) Polityka haseł, blokada konta, MFA oraz wymagania TLS.
2) Dokładne typy i liczba miejsc dziesiętnych dla kwot i procentów oraz zasada zaokrągleń (np. banker's rounding).
3) Klucz unikalności numeru zamówienia: globalnie czy per kontrahent (A1 może zawierać myślnik w nazwie).
4) Źródło „daty zamówienia” przy imporcie: użycie daty utworzenia pliku może być mylące.
5) Mechanizm dopasowywania kontrahentów (progi podobieństwa, aliasy, ręczne zatwierdzanie).
6) Telemetria i KPI operacyjne: poza „zapis do bazy” (np. sukces/porażka importu, czas przetwarzania).
7) NFR: limit wierszy/rekordów w imporcie, SLA, RPO/RTO – do ustalenia i przetestowania.
8) Brak paska progresu przy imporcie – ocena akceptowalności UX przy większych plikach.
9) Szyfrowanie backupów i kontrola dostępu – do rozważenia.

4.3 Założenia projektowe

1) Unikalność numeru zamówienia traktowana jako globalna w MVP, do rewizji po doprecyzowaniu.
2) Rounding: tymczasowo standard do 2 miejsc (half up), tolerancja rozbieżności ±0,01 do walidacji.
3) Domyślna strefa czasu: czas lokalny organizacji; przechowywanie w UTC zalecane na backendzie.

## 5. Historyjki użytkowników

US-001
Tytuł: Logowanie i dostęp ról
Opis: Jako zalogowany użytkownik chcę uzyskać dostęp zgodny z rolą (viewer/editor/admin), aby bezpiecznie przeglądać lub modyfikować dane.
Kryteria akceptacji:
- Próba dostępu bez logowania przekierowuje do logowania.
- Po poprawnym logowaniu widok i akcje są zgodne z rolą.
- Użytkownik bez uprawnień do edycji nie widzi przycisków zapisu/usuń.
- Sesja wygasa zgodnie z konfiguracją; po wygaśnięciu wymagane ponowne logowanie.

US-002
Tytuł: Administracja użytkownikami (Supabase)
Opis: Jako admin chcę tworzyć konta użytkowników i nadawać im role, aby kontrolować dostęp do aplikacji.
Kryteria akceptacji:
- Admin może utworzyć konto z rolą viewer/editor/admin i nadać hasło.
- Brak mechanizmu zaproszeń i resetu haseł w MVP.
- Zmiana roli użytkownika natychmiast wpływa na uprawnienia w aplikacji.

US-003
Tytuł: Dodanie zamówienia (formularz)
Opis: Jako editor chcę dodać zamówienie przez formularz, aby rejestrować nowe dane.
Kryteria akceptacji:
- Wymagane pola: numer zamówienia, kontrahent, nazwa elementu, ilość, netto, waluta, data.
- Dla EUR wymagany kurs; PLN nie wymaga kursu.
- Spójność netto↔brutto weryfikowana z tolerancją ±0,01.
- Numer zamówienia musi być unikalny; duplikat blokuje zapis z komunikatem.
- Po zapisie powstaje wpis audytu i zdarzenie telemetrii „zapis zamówienia do bazy”.

US-004
Tytuł: Edycja zamówienia
Opis: Jako editor chcę edytować istniejące zamówienie, aby korygować dane (w tym kurs EUR).
Kryteria akceptacji:
- Edycja dostępna tylko dla editor/admin.
- Możliwość zmiany kursu EUR; po zmianie przeliczenia aktualizują brutto i KPI.
- Po zapisie walidacja jak przy dodaniu i wpis audytu z wartościami przed/po.

US-005
Tytuł: Usunięcie zamówienia
Opis: Jako editor chcę usunąć zamówienie, aby utrzymywać porządek danych.
Kryteria akceptacji:
- Potwierdzenie akcji wymagane (modal/pole tekstowe).
- Usunięcie niedostępne dla viewer.
- Wpis audytu tworzy się z informacją o usuniętym rekordzie.

US-006
Tytuł: Przegląd listy zamówień
Opis: Jako użytkownik chcę przeglądać listę zamówień z paginacją i sortowaniem od najnowszych.
Kryteria akceptacji:
- Domyślne sortowanie: data zamówienia malejąco.
- Paginacja działa dla dużych zbiorów danych.
- Filtry po kontrahencie i zakresie dat są dostępne i działają.

US-007
Tytuł: Szczegóły zamówienia
Opis: Jako użytkownik chcę zobaczyć szczegóły pojedynczego zamówienia, w tym obliczenia i historię zmian.
Kryteria akceptacji:
- Widok detalu zawiera wszystkie pola zamówienia oraz link do audytu.
- Dostępny dla viewer/editor/admin.

US-008
Tytuł: Eksport listy do XLSX
Opis: Jako użytkownik chcę wyeksportować widoczne (przefiltrowane) zamówienia do XLSX.
Kryteria akceptacji:
- Eksport uwzględnia aktualne filtry i sortowanie.
- Rozmiar pliku adekwatny do liczby rekordów; brak utraty danych.

US-009
Tytuł: Import XLSX – wczytaj i popraw
Opis: Jako editor chcę zaimportować plik XLSX zgodny ze wzorcem i poprawić błędy przed zapisem.
Kryteria akceptacji:
- Akceptowany plik: 1 arkusz, ≤1 MB; A1 w formacie „numer zamówienia – nazwa kontrahenta”.
- Interfejs mapowania kolumn i podświetlanie błędów na wiersz/komórkę.
- Duplikaty numeru zamówienia są wskazane jako błąd i nie są zapisywane.
- Brak paska progresu w MVP.

US-010
Tytuł: Prewalidacja importu
Opis: Jako editor chcę otrzymać raport błędów z opisami, aby poprawić dane przed zapisem.
Kryteria akceptacji:
- Lista błędów zawiera typ błędu, lokalizację (wiersz/kolumna) i sugestię poprawy.
- Po korekcie użytkownik może ponowić walidację bez utraty mapowania.

US-011
Tytuł: Dashboard – widok roczny i dzienny
Opis: Jako viewer chcę zobaczyć KPI roczne i po wyborze miesiąca – rozkład dzienny.
Kryteria akceptacji:
- Widok domyślny: rok bieżący.
- Po kliknięciu miesiąca pokazuje się rozkład dzienny.
- KPI: suma netto, liczba zamówień, średnia wartość.

US-012
Tytuł: Trend sprzedaży m/m
Opis: Jako viewer chcę zobaczyć trend miesiąc-do-miesięca dla wszystkich lub wybranych kontrahentów.
Kryteria akceptacji:
- Wykres trendu m/m dla wybranego zakresu czasu.
- Filtr kontrahenta wpływa na trend.

US-013
Tytuł: Filtry analityczne
Opis: Jako użytkownik chcę filtrować dashboard i listę po kontrahencie i zakresie dat.
Kryteria akceptacji:
- Zastosowane filtry są spójne między listą a dashboardem (zakres sesji/ekranu).
- Zmiana filtrów aktualizuje KPI i wykresy.

US-014
Tytuł: Kurs NBP i przeliczenia do PLN
Opis: Jako system chcę pobrać kurs NBP z daty zamówienia, aby agregować w PLN.
Kryteria akceptacji:
- Dla EUR pobierany jest kurs z daty zamówienia; przy braku kursu – komunikat i możliwość ręcznego wprowadzenia dla editor/admin.
- Zmiana kursu wywołuje ponowne przeliczenia.

US-015
Tytuł: Audyt zmian
Opis: Jako admin chcę przeglądać dziennik zmian, aby rozumieć kto i kiedy modyfikował dane.
Kryteria akceptacji:
- Każda operacja modyfikująca generuje wpis (autor, timestamp, wartości przed/po w JSON).
- Widok audytu pozwala filtrować po użytkowniku, dacie, numerze zamówienia.

US-016
Tytuł: Telemetria zapisu
Opis: Jako właściciel produktu chcę rejestrować zdarzenie „zapis zamówienia do bazy”, aby monitorować użycie.
Kryteria akceptacji:
- Zdarzenie jest wysyłane przy każdym udanym zapisie nowego lub edytowanego zamówienia.
- Zdarzenie zawiera minimalny kontekst (czas, użytkownik, powodzenie).

US-017
Tytuł: Spójność netto↔brutto i tolerancje
Opis: Jako system chcę walidować spójność obliczeń, aby zapewnić jakość danych.
Kryteria akceptacji:
- Różnica między wyliczonym a wprowadzonym brutto nie przekracza ±0,01.
- W przypadku przekroczenia – blokada zapisu i komunikat.

US-018
Tytuł: Unikalność numeru zamówienia
Opis: Jako system chcę wymuszać unikalność numeru zamówienia, aby uniknąć duplikatów.
Kryteria akceptacji:
- Próba zapisu duplikatu kończy się błędem unikalności.
- W imporcie wskazane są wszystkie duplikaty z lokalizacją wiersza.

US-019
Tytuł: Kontrahenci – weryfikacja istnienia
Opis: Jako editor chcę wybierać kontrahenta z listy, aby unikać literówek.
Kryteria akceptacji:
- Pole kontrahenta korzysta z listy referencyjnej; brak w liście blokuje zapis lub wymaga dodania do słownika (poza zakresem dodawania w MVP, minimalnie walidacja istnienia).

US-020
Tytuł: Brak uprawnień do modyfikacji
Opis: Jako viewer nie powinienem móc dodawać/edytować/usunąć zamówień.
Kryteria akceptacji:
- Akcje modyfikujące są niewidoczne/nieaktywne dla viewer.
- Próba wywołania API zwraca błąd autoryzacji.

US-021
Tytuł: Błędy importu – rozmiar i arkusze
Opis: Jako editor chcę otrzymać jasne komunikaty, gdy plik jest >1 MB lub zawiera wiele arkuszy.
Kryteria akceptacji:
- Plik >1 MB – walidacja odrzuca z komunikatem.
- Wiele arkuszy – walidacja odrzuca lub wymaga wskazania właściwego (MVP: odrzuca).

US-022
Tytuł: A1 „numer – kontrahent”
Opis: Jako system chcę weryfikować format A1, aby zmapować numer i kontrahenta.
Kryteria akceptacji:
- Jeśli A1 nie zawiera separatora myślnika, import jest blokowany z komunikatem.
- Jeśli nazwa kontrahenta zawiera myślnik, parser stosuje pierwsze wystąpienie jako separator (do doprecyzowania).

US-023
Tytuł: Backup i odtworzenie
Opis: Jako admin chcę mieć tygodniowy backup i potwierdzoną procedurę odtworzenia.
Kryteria akceptacji:
- Harmonogram backupu działa; kopie przechowywane 12 miesięcy.
- Procedura odtworzenia przetestowana i udokumentowana.

US-024
Tytuł: Sortowanie domyślne i zmiana sortu
Opis: Jako użytkownik chcę zmienić sortowanie listy, gdy potrzebuję innego porządku.
Kryteria akceptacji:
- Domyślnie sort malejący po dacie.
- Użytkownik może wybrać inne pole; sort działa spójnie z paginacją.

US-025
Tytuł: Puste wyniki i komunikaty
Opis: Jako użytkownik chcę jasne komunikaty, gdy filtry zwracają 0 wyników.
Kryteria akceptacji:
- Widoczny komunikat „Brak wyników dla wybranych filtrów”.
- Eksport przy 0 wyników generuje pusty plik z nagłówkami.

## 6. Metryki sukcesu

6.1 Funkcjonalne

1) Użytkownik (editor) może wprowadzić zamówienia (formularz/import) i zobaczyć KPI na dashboardzie bez pomocy (czas do pierwszego sukcesu < 30 min).
2) Import XLSX: współczynnik udanych importów > 90% dla plików zgodnych ze wzorcem; 0% duplikatów zaakceptowanych do bazy.
3) Spójność netto↔brutto: odsetek rekordów odrzuconych z powodu niespójności < 2%.

6.2 Techniczne

1) Walidacja unikalności numeru zamówienia działa (testy integracyjne pokrywają przypadki duplikatów).
2) Kalkulacje rabatów i VAT zgodne z algorytmem; kursy NBP z właściwej daty; tolerancja ±0,01 potwierdzona testami.
3) Audyt zapisuje autora, timestamp i wartości przed/po dla każdej zmiany.
4) Zdarzenie telemetrii „zapis zamówienia do bazy” rejestrowane dla 100% udanych zapisów.

6.3 Operacyjne

1) Tygodniowy backup wykonywany i retencja 12 miesięcy spełniona; kwartalny test odtworzenia zakończony sukcesem.
2) Zgodność RODO: dostęp do danych kontrolowany przez role.
