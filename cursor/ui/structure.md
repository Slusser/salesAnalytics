SalesAnalysis Web Component Topology (start: app.ts)

App Component `app.ts`
|
+-- Template `app.html` -> `<router-outlet>`
+-- Routes `app.routes.ts`
    |
    +-- Path '' -> redirect to `auth/login`
    +-- Path `auth` -> `AuthLayoutComponent` (standalone, imports `RouterOutlet`)
    |   |
    |   +-- Template `auth.layout.html` -> `<router-outlet>`
    |   +-- Children
    |       |
    |       +-- Path `login` -> `LoginPage`
    |       |   +-- Services: `AuthApiService`, `AuthSessionService`, `Router`, `ActivatedRoute`
    |       |   +-- Shared components: `AuthCardComponent`, `AuthErrorComponent`, `AuthSpinnerComponent`
    |       |   +-- Modules: `ReactiveFormsModule`, `NzFormModule`, `NzInputModule`, `NzButtonModule`, `NzTypographyModule`, `CommonModule`
    |       |   `-- Uses `AUTH_RETURN_URL_QUERY_PARAM`; on success `AuthSessionService.setSession()` and navigates to stored return URL
    |       +-- Path `register` -> `RegisterPage`
    |       |   +-- Services: `FormBuilder`
    |       |   +-- Modules: `ReactiveFormsModule`, `NzFormModule`, `NzInputModule`, `NzButtonModule`, `NzTypographyModule`, `CommonModule`
    |       |   `-- Local signals for form state; mock async success (`setTimeout`)
    |       +-- Path `logout` -> `LogoutPage`
    |       |   `-- Depends on `AuthSessionService`; `queueMicrotask` triggers `logout()`
    |       `-- Path '' -> redirect to `login`
    +-- Path '' -> `MainLayoutComponent` (guard: `authGuard`)
        |
        +-- `authGuard` injects `AuthSessionService` and `Router`; redirects to `/auth/login` (adds `AUTH_RETURN_URL_QUERY_PARAM` when needed)
        +-- `MainLayoutComponent` imports `RouterOutlet`, `RouterLink`, `RouterLinkActive`, `NzLayoutModule`, `NzMenuModule`; template wraps shell layout and `<router-outlet>`
        +-- Children
            |
            +-- Path `customers/new` -> `CustomersNewPageComponent`
            |   +-- Guards: `roleGuard(['editor','owner'])`
            |   +-- Services: `CustomersService`, `NzMessageService`, `Router`
            |   +-- Shared components: `CustomerFormComponent`
            |   `-- Signals for submit/server errors; navigates back to `/customers` on success
            +-- Path `customers` -> `CustomersPage`
            |   +-- Guards: `roleGuard(['viewer','owner','editor'])`
            |   +-- Services: `CustomersService`, `Router`
            |   +-- Shared components: `FilterBarComponent`, `ManualRefreshButtonComponent`, `CustomersTableComponent`, `EmptyStateComponent`, `ConfirmDialogComponent`, `PaginationComponent`
            |   `-- Computed signals manage filters, list items, confirm dialog, and error logging
            +-- Path `customers/:id` -> `CustomerDetailPage`
            |   +-- Guards: `roleGuard(['viewer','owner','editor'])`; route data `title: 'Kontrahent - Detal'`
            |   +-- Services: `CustomersService`, `AuthSessionService`, `NzMessageService`, `Router`, `ActivatedRoute`
            |   +-- Shared components: `CustomerFormComponent`, `ConfirmDialogComponent`
            |   `-- Handles edit/delete/restore flows, validation (CUSTOMER_NAME_PATTERN), role-aware permissions
            +-- Path `orders` -> `OrdersPage`
            |   +-- Guards: `roleGuard(['viewer','owner','editor'])`
            |   +-- Services: `OrdersListService`, `Router`
            |   +-- Shared components: `OrdersToolbarComponent`, `OrdersDataTableComponent`, `PaginationComponent`, `ManualRefreshButtonComponent`, `EmptyStateComponent`, `ConfirmDialogComponent`
            |   `-- Manages filters, sorting, pagination, export, and confirm dialog state via signals
            +-- Path `orders/new` -> `OrdersNewPageComponent`
            |   +-- Guards: `roleGuard(['editor','owner'])`; `canDeactivate: ordersNewCanDeactivateGuard`
            |   +-- Providers: `OrdersNewStore`
            |   +-- Services: `OrdersCreateService`, `FxRateService`, `NzMessageService`, `Router`
            |   +-- Shared components: `OrderFormComponent`, `OrderCalculationPreviewComponent`, `FxRateBannerComponent`
            |   +-- Computed signals for form/calculation; success redirects to `/orders/{id}`
            |   `-- `ordersNewCanDeactivateGuard` injects `OrdersNewStore` + `NzModalService`; prompts when `store.dirty()`
            +-- Path `orders/:orderId` -> lazy `order-edit.routes.ts`
            |   +-- Guards: `roleGuard(['viewer','owner','editor'])`
            |   +-- `order-edit.routes.ts`
            |       |
            |       +-- Path '' -> redirect to `edit`
            |       `-- Path `edit` -> `OrderEditPageComponent`
            |           +-- Route data `title: 'Zamowienie - Edycja'`; `canDeactivate: orderEditCanDeactivateGuard`
            |           +-- Providers: `OrderDetailStore`
            |           +-- Services: `Router`, `ActivatedRoute`
            |           +-- Shared components: `OrderDetailHeaderComponent`, `OrderDetailFormComponent`, `SkeletonDetailComponent`, `ConfirmDialogComponent`
            |           +-- Effects load order via `OrderDetailStore`; on successful update navigates to `/orders` with `state: { refresh: true }`
            |           `-- `orderEditCanDeactivateGuard` (in `order-edit.can-deactivate.guard.ts`) uses `window.confirm` when navigation is blocked
            +-- Path `403` -> `ForbiddenPage`
            |   +-- Modules: `NzResultModule`, `NzButtonModule`; template offers back-navigation via `RouterLink`
            `-- Path `**` -> redirect to `customers`

Notes
=====
- `roleGuard(requiredRoles)` injects `AuthSessionService` and `Router`; redirects to `/auth/login` when unauthenticated or `/403` when lacking roles.
- Shared components referenced above live under `apps/web/src/app/shared/components`.
- Services reside under `apps/web/src/app/service`, using Angular signals for state handling across pages.

