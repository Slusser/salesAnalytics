# Testy E2E (`apps/e2e`)

Zunifikowany projekt Playwright obejmuje testy API (request context), scenariusze UI oraz pełne przepływy łączące UI i API.

## Struktura katalogów

- `api/` – testy endpointów (`request` context)
- `web/` – scenariusze UI (Chromium desktop)
- `flows/` – testy pełnych przepływów biznesowych
- `fixtures/` – wspólne fixtures (np. logowanie, fabryki klientów/zamówień)
- `helpers/` – narzędzia (np. `ApiClient`, generatory danych)
- `pages/` – obiekty stron (Page Object Pattern)

## Uruchamianie

```bash
# Cały pakiet
npx nx e2e e2e

# Tylko API (request context)
npx nx e2e e2e --project=api

# UI na Chromium
npx nx e2e e2e --project=chromium

# Scenariusze flow
npx nx e2e e2e --project=flows

# Tryb debugowania Playwright
npx nx e2e e2e --project=chromium --debug
```

## Zmienne środowiskowe

- `TEST_USER_EMAIL` oraz `TEST_USER_PASSWORD` – konto używane do logowania w UI i API
- `BASE_URL` (domyślnie `http://localhost:4200`) – adres aplikacji web
- `API_URL` (domyślnie `http://localhost:3000`) – adres API (bez sufiksu `/api`)

W CI wartości są ustawiane przez pipeline (patrz `.github/workflows`).


