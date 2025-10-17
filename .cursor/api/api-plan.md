# REST API Plan

## 1. Resources
- `AuthSession` (virtual) → Supabase Auth session metadata via NestJS guard
- `User` → `users` table (Supabase managed)
- `UserRole` → `user_roles` table
- `Customer` → `customers` table
- `Order` → `orders` table
- `OrderAuditEntry` → `audit_log` table (scoped to orders)
- `ImportJob` → staging metadata (backed by Supabase storage + temp tables)
- `ImportRowIssue` (virtual) → validation results derived from staging tables
- `AnalyticsSnapshot` (virtual) → aggregated metrics derived from `orders`
- `FxRate` → external NBP data cached in service layer (persists in config table or cache)

## 2. Endpoints

### 2.1 Authentication
- **POST /auth/login**
  - Description: Authenticate user against Supabase and issue JWT session.
  - Request Body:
    ```json
    {
      "email": "string",
      "password": "string"
    }
    ```
  - Response Body:
    ```json
    {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": 3600,
      "user": {
        "id": "uuid",
        "email": "string",
        "displayName": "string",
        "roles": ["owner" | "editor" | "viewer"]
      }
    }
    ```
  - Success: `200 OK`
  - Errors: `400 Bad Request` (missing fields), `401 Unauthorized` (invalid credentials), `423 Locked` (account locked if implemented)
- **POST /auth/logout**
  - Description: Invalidate current refresh token and clear session state.
  - Request Body:
    ```json
    {
      "refreshToken": "string"
    }
    ```
  - Response Body:
    ```json
    {
      "success": true
    }
    ```
  - Success: `200 OK`
  - Errors: `400 Bad Request` (missing token), `401 Unauthorized`

### 2.2 Users & Roles (owner scope)
- **POST /owner/users**
  - Description: Provision a Supabase user record and initial role assignment.
  - Request Body:
    ```json
    {
      "email": "string",
      "displayName": "string",
      "password": "string",
      "roles": ["owner" | "editor" | "viewer"]
    }
    ```
  - Response Body: created `User` with roles.
  - Success: `201 Created`
  - Errors: `400 Bad Request` (validation), `409 Conflict` (email exists), `403 Forbidden` (non-owner)
- **GET /owner/users**
  - Description: List users with assigned roles (owner only).
  - Query Params: `page`, `limit`, `search`
  - Response Body: paginated list with total count.
  - Success: `200 OK`
  - Errors: `403 Forbidden`
- **PATCH /owner/users/{userId}**
  - Description: Update display name or reset password (owner only).
  - Request Body (partial):
    ```json
    {
      "displayName": "string",
      "password": "string"
    }
    ```
  - Success: `200 OK`
  - Errors: `404 Not Found`, `403 Forbidden`
- **PUT /owner/users/{userId}/roles**
  - Description: Replace role set.
  - Request Body:
    ```json
    {
      "roles": ["owner" | "editor" | "viewer"]
    }
    ```
  - Success: `200 OK`
  - Errors: `400 Bad Request`, `403 Forbidden`, `404 Not Found`
- **DELETE /owner/users/{userId}**
  - Description: Deactivate Supabase user and remove all roles (owner only).
  - Response Body:
    ```json
    {
      "id": "uuid",
      "status": "deactivated"
    }
    ```
  - Success: `200 OK`
  - Errors: `403 Forbidden`, `404 Not Found`

### 2.3 Customers
- **GET /customers**
  - Description: Paginated list of active customers.
  - Query Params: `page`, `limit`, `search`, `includeInactive` (boolean)
  - Response Body: paginated payload with `items`, `total`, `page`, `limit`.
  - Success: `200 OK`
  - Errors: `403 Forbidden`
- **POST /customers**
  - Description: Create new customer (editor/owner only).
  - Request Body:
    ```json
    {
      "name": "string",
      "isActive": true,
      "comment": "string?"
    }
    ```
  - Response: created customer record.
  - Success: `201 Created`
  - Errors: `400 Bad Request` (duplicate name), `403 Forbidden`
- **GET /customers/{customerId}**
  - Description: Customer detail including soft-delete status.
  - Success: `200 OK`
  - Errors: `404 Not Found`
- **PATCH /customers/{customerId}**
  - Description: Update name or activation state (editor/owner).
  - Request Body:
    ```json
    {
      "name": "string",
      "isActive": true,
      "deletedAt": "ISO date-time|null"
    }
    ```
  - Success: `200 OK`
  - Errors: `400 Bad Request`, `403 Forbidden`, `404 Not Found`
- **POST /customers/{customerId}/restore**
  - Description: Undo soft-delete (owner/editor).
  - Success: `200 OK`
  - Errors: `409 Conflict` (already active)

### 2.4 Orders
- **GET /orders**
  - Description: Paginated list with filtering, sorting, and soft-delete awareness.
  - Query Params:
    - `page`, `limit`
    - `customerId`
    - `orderNo`
    - `dateFrom`, `dateTo`
    - `isEur`
    - `sort` (comma-separated `field:direction`, defaults `orderDate:desc`)
    - `includeDeleted` (owner/editor only)
  - Response Body:
    ```json
    {
      "items": [
        {
          "id": "uuid",
          "orderNo": "string",
          "customer": { "id": "uuid", "name": "string" },
          "orderDate": "date",
          "itemName": "string",
          "quantity": 0.0,
          "isEur": false,
          "eurRate": 0.0,
          "producerDiscountPct": 0.0,
          "distributorDiscountPct": 0.0,
          "vatRatePct": 23.0,
          "totalNetPln": 0.0,
          "totalGrossPln": 0.0,
          "totalGrossEur": 0.0,
          "createdBy": { "id": "uuid", "displayName": "string" },
          "createdAt": "ISO date-time",
          "updatedAt": "ISO date-time",
          "deletedAt": "ISO date-time|null"
        }
      ],
      "total": 0,
      "page": 1,
      "limit": 25
    }
    ```
  - Success: `200 OK`
  - Errors: `400 Bad Request`, `403 Forbidden`
- **POST /orders**
  - Description: Create order (editor/owner) with server-side calculation + telemetry.
  - Request Body:
    ```json
    {
      "orderNo": "string",
      "customerId": "uuid",
      "orderDate": "date",
      "itemName": "string",
      "quantity": 0.0,
      "isEur": false,
      "eurRate": 0.0,
      "producerDiscountPct": 0.0,
      "distributorDiscountPct": 0.0,
      "vatRatePct": 23.0,
      "totalNetPln": 0.0,
      "totalGrossPln": 0.0,
      "totalGrossEur": 0.0,
      "comment": "string"
    }
    ```
  - Response: persisted order with computed fields.
  - Success: `201 Created`
  - Errors: `400 Bad Request` (validation or tolerance breach), `409 Conflict` (duplicate orderNo), `403 Forbidden`
- **GET /orders/{orderId}**
  - Description: Retrieve order detail with computed metadata.
  - Success: `200 OK`
  - Errors: `404 Not Found`
- **PATCH /orders/{orderId}**
  - Description: Update order (editor/owner) with revalidation.
  - Request Body: same schema as POST but optional fields.
  - Success: `200 OK`
  - Errors: `400 Bad Request`, `403 Forbidden`, `404 Not Found`
- **DELETE /orders/{orderId}**
  - Description: Soft delete order (editor/owner) with audit entry.
  - Success: `204 No Content`
  - Errors: `403 Forbidden`, `404 Not Found`
- **POST /orders/{orderId}/restore**
  - Description: Restore soft-deleted order (owner/editor).
  - Success: `200 OK`
  - Errors: `409 Conflict`

### 2.6 Audit Log
- **GET /orders/{orderId}/audit**
  - Description: Order-specific change history (viewer/editor/owner).
  - Query Params: `page`, `limit`
  - Response Body: list of audit entries with `oldValue`, `newValue`, `changedBy`, `occurredAt`.
  - Success: `200 OK`
  - Errors: `403 Forbidden`, `404 Not Found`
- **GET /audit/logs**
  - Description: Global audit log (owner only) with filters.
  - Query Params: `table`, `operation`, `userId`, `from`, `to`, `page`, `limit`
  - Response Body: paginated entries.
  - Success: `200 OK`
  - Errors: `403 Forbidden`

### 2.8 Analytics
- **GET /analytics/kpi**
  - Description: Aggregate KPI (sum net, order count, avg value) for range.
  - Query Params: `dateFrom`, `dateTo`, `customerId`
  - Response Body:
    ```json
    {
      "sumNetPln": 0.0,
      "ordersCount": 0,
      "avgOrderValue": 0.0
    }
    ```
  - Success: `200 OK`
- **GET /analytics/trend**
  - Description: Month-over-month trend for selected range.
  - Query Params: `dateFrom`, `dateTo`, `customerId`
  - Response Body: array of `{ "period": "YYYY-MM", "sumNetPln": 0.0 }`.
  - Success: `200 OK`
- **GET /analytics/orders/daily**
  - Description: Daily breakdown for selected month.
  - Query Params: `year`, `month`, `customerId`
  - Response Body: array of `{ "date": "YYYY-MM-DD", "sumNetPln": 0.0, "ordersCount": 0 }`.
  - Success: `200 OK`
- Errors: `400 Bad Request` (invalid range), `403 Forbidden` (viewer-only restrictions handled via permissions)

### 2.9 FX Rates
- **GET /fx-rates/eur**
  - Description: Retrieve official NBP rate for given date.
  - Query Params: `date` (defaults to today)
  - Response Body:
    ```json
    {
      "date": "date",
      "source": "nbp",
      "rate": 4.5678,
      "fetchedAt": "ISO date-time"
    }
    ```
  - Success: `200 OK`
  - Errors: `404 Not Found` (no rate found)
- **POST /fx-rates/overrides**
  - Description: Allow editor/owner to override rate for specific date.
  - Request Body:
    ```json
    {
      "date": "date",
      "rate": 4.5000,
      "comment": "string"
    }
    ```
  - Response Body: stored override with metadata.
  - Success: `201 Created`
  - Errors: `400 Bad Request`, `403 Forbidden`

### 2.11 Telemetry (internal)
- No public endpoint; order service emits `order.saved` event to telemetry sink on create/update/import.

## 3. Authentication and Authorization
- Supabase JWT (access token) required for all endpoints except health checks.
- NestJS guard validates token and injects user context.
- Role-based authorization:
  - `viewer`: read-only access to `/orders` (list/detail), `/customers` (GET), analytics GET endpoints, `/orders/{id}/audit`.
  - `editor`: viewer rights + create/update/delete orders, imports, rate overrides, customer mutations.
  - `owner`: editor rights + `/owner/users`, global `/audit/logs`, includeDeleted filters, ability to restore records.
- Row-Level Security mirrored in Supabase to ensure backend enforcement even if token is misused.
- Use of API keys for internal services (e.g., telemetry sink) secured via environment-configured secrets.
- All routes served over HTTPS; rate limiting via NestJS guard (e.g., 100 req/min per user) on write-heavy endpoints.

## 4. Validation and Business Logic
- `User`:
  - Email unique; displayName required.
  - Role updates validate against enum {owner, editor, viewer}; owner role changes audited.
- `Customer`:
  - Name required, unique case-insensitive among non-deleted customers.
  - `isActive` and `deletedAt` kept consistent (if `isActive=false`, set `deletedAt`).
  - Restore endpoint clears `deletedAt`, sets `isActive=true`.
- `Order`:
  - `orderNo` unique case-insensitive for non-deleted orders; conflict returns 409.
  - `quantity > 0`; `producerDiscountPct` and `distributorDiscountPct` within 0–100.
  - If `isEur=false`, `eurRate` & `totalGrossEur` must be null; if `isEur=true`, require positive `eurRate` and ensure EUR totals >= 0.
  - `totalNetPln >= 0`; `totalGrossPln >= totalNetPln`; tolerance check ±0.01 when recalculating brutto from input data.
  - Optional constraint `orderDate <= current_date`; configurable via feature flag until confirmed.
  - Soft-delete sets `deletedAt`; restore clears it.
  - All mutations write to `audit_log` and emit telemetry (`order.saved`).
- `Order Preview`:
  - Runs same validation pipeline without persistence; returns highlighted errors for UI.
- `ImportJob`:
  - Accepts one-sheet XLSX ≤1 MB; validates header A1 pattern "order number – customer name"; rejects multiple sheets.
  - Validation identifies duplicates, missing customers, invalid amounts/currency; stores issues for UI retrieval.
  - Commit only proceeds when no blocking errors; partial commits optional if `includeInvalid=false`.
- `Analytics`:
  - Filters reuse `orders` validation; only non-deleted orders counted unless `includeDeleted` by owner.
  - Data served from optimized SQL views using indexed columns for performance.
- `Audit`:
  - Access restricted: order-level history visible to all roles; global log only for owners.
  - Responses redact sensitive fields (e.g., passwords) and include actor metadata.
- `FX Rates`:
  - NBP fetch validated for date (business days); override rates must be positive; override metadata audited.
- Error handling:
  - Use structured error object `{ code, message, details }` across API.
  - Early guard clauses enforce permissions before hitting core logic.
- Security & rate limiting:
  - Rate limiting on `POST/PUT/PATCH/DELETE` endpoints (per-user, per-minute).
  - File upload sanitization and virus scanning hook for imports.
  - Apply input validation via class-validator pipes; sanitize text fields to prevent injection.
