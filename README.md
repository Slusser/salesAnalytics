# SalesAnalysis

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

A monorepo MVP for B2B order recording and sales analysis. It centralizes order data, supports manual entry and XLSX import, validates inputs, calculates amounts using a defined algorithm, and visualizes metrics and trends on a dashboard.

## Table of Contents
- [1. Project name](#1-project-name)
- [2. Project description](#2-project-description)
- [3. Tech stack](#3-tech-stack)
- [4. Getting started locally](#4-getting-started-locally)
- [5. Available scripts](#5-available-scripts)
- [6. Project scope](#6-project-scope)
- [7. Project status](#7-project-status)
- [8. License](#8-license)

## 1. Project name
SalesAnalysis

## 2. Project description
SalesAnalysis is an MVP web application for B2B order recording and analysis. It integrates sales data in one place, enables manual order entry and XLSX import, performs validation and amount calculations according to a defined algorithm, and presents basic analytics and trends on a dashboard.

This repository is an Nx monorepo containing:
- Frontend: Angular application (`apps/web`)
- Backend: NestJS API (`apps/api`) with Swagger docs
- Shared: common types (`apps/shared/types`)
- DB: clients and types (e.g., Supabase placeholders in `apps/db`)

## 3. Tech stack
- Angular 20 (Standalone, SCSS)
- TypeScript 5
- NestJS 11 (Express)
- Nx 21 (monorepo/build tooling)
- Tooling and libs:
  - Vite 7 + Vitest 3 (web tests), ESLint 9, Prettier
  - RxJS 7.8, zone.js
  - Swagger (`@nestjs/swagger`, `swagger-ui-express`)
  - Axios
- Playwright (Chromium-only E2E suite for `apps/web`), Jest for `api-e2e`

## 4. Getting started locally

### Prerequisites
- Node.js ≥ 18 (20 LTS recommended)
- npm ≥ 9

### Install
```bash
npm ci
```

### Run the backend (API)
```bash
npx nx serve api
```
- API base URL: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`

### Run the frontend (Web)
```bash
npx nx serve web
```
- Web app: `http://localhost:4200`

### Build
```bash
# Production builds
npx nx build api
npx nx build web
```
Build artifacts are emitted under `dist/` (projects may output to `dist/apps/<project>` depending on target configuration).

### Lint
```bash
npx nx lint web
npx nx lint api
```

### Tests

#### Unit (Vitest)
```bash
# Angular
npx nx test web

# NestJS
npx nx test api

# Watch mode (frontend)
npx nx test web --watch

# Coverage (frontend/backend)
npx nx test web --coverage
npx nx test api --coverage
```

#### End-to-End
```bash
# Frontend UI (Playwright, Chromium only)
npx nx e2e web-e2e

# Run headed / specific project
npx nx e2e web-e2e --headed --project=chromium-desktop

# API contract tests (Jest + Supertest)
npx nx e2e api-e2e
```
Playwright artefacts (screenshots, traces, HTML report) are stored under `apps/web-e2e/dist/apps/web-e2e`. Set `BASE_URL` to run against a deployed frontend instead of the local dev server.

#### Unit testing assumptions
- Vitest 3 is the unit-test runner for both Angular (`@analogjs/vitest-angular`) and NestJS projects.
- Business logic (services, mappers, guards, validators, utilities) should reach at least 70% code coverage.
- Backend focus: `OrdersService`, `CustomersService`, `AuthService`, domain mappers, guards (`JwtAuthGuard`, `RolesGuard`), validation pipes, and utility helpers.
- Frontend focus: stateful services such as `OrdersListService`, `AuthSessionService`, `CustomersService`, form-driven components, presentation logic, pipes, and custom validators.
- Critical calculations like `totalGrossPln = totalNetPln * (1 + vatRatePct/100)` must be covered with tolerance up to 0.01.

### Explore the graph
```bash
npx nx graph
```

## 5. Available scripts
This workspace uses Nx targets instead of root npm scripts. Common commands:

| Task | Command | Notes |
| --- | --- | --- |
| Serve API | `npx nx serve api` | Builds with Webpack and runs NestJS (port 3000, `/api`, Swagger at `/api/docs`). |
| Serve Web | `npx nx serve web` | Angular dev server (port 4200). |
| Build API | `npx nx build api` | Production bundle for the API. |
| Build Web | `npx nx build web` | Production bundle for the web app. |
| Lint | `npx nx lint api` / `npx nx lint web` | ESLint rules configured per project. |
| Test (web) | `npx nx test web` | Vitest + @analogjs/vitest-angular (watch/coverage supported). |
| Test (api) | `npx nx test api` | Vitest (Node env, NestJS testing utilities). |
| E2E (web) | `npx nx e2e web-e2e` | Playwright, Chromium desktop, auto-dev-server. |
| E2E (api) | `npx nx e2e api-e2e` | Jest + Supertest contract checks. |
| Show project | `npx nx show project <name>` | Inspect available targets for a project. |
| Graph | `npx nx graph` | Visualize project dependencies. |

## 6. Project scope
In scope for MVP:
- Manual order entry
- XLSX import
- Order validation
- Amount calculations using a defined algorithm
- Metrics and trends on a dashboard
- Unified data model across frontend and backend (`apps/shared/types`)

Out of scope (for now):
- Auth and user management (not specified)
- Production-grade DB provisioning and environment secrets
- Advanced analytics beyond core KPIs
- CI/CD pipelines and deployment automation

## 7. Project status
- Status: Work in Progress (MVP)
- Current:
  - Nx monorepo scaffold with Angular and NestJS apps
  - API runs at `http://localhost:3000/api` with Swagger docs at `/api/docs`
  - Web app scaffold runs at `http://localhost:4200`
  - Linting oraz testy jednostkowe Vitest dla web i api
  - `web-e2e` (Playwright, Chromium) oraz `api-e2e` (Jest + Supertest) dostępne jako cele Nx
- Next:
  - Implement data model, storage (e.g., Supabase) and environment configuration
  - Implement XLSX import and validation pipeline
  - Implement amount calculation algorithm and dashboard metrics
  - Rozszerzyć scenariusze Playwright (`web-e2e`) o logowanie, zamówienia i klientów
  - Add CI and a `LICENSE` file

## 8. License
Licensed under the MIT License (see the `license` field in `package.json`). If present, refer to the `LICENSE` file for full terms.