import type { Routes } from '@angular/router';

export const ORDER_EDIT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'edit',
  },
  {
    path: 'edit',
    data: { title: 'Zamówienie — Edycja' },
    canDeactivate: [
      () =>
        import('./order-edit.can-deactivate.guard').then(
          (m) => m.orderEditCanDeactivateGuard,
        ),
    ],
    loadComponent: () =>
      import('./order-edit.page').then(
        (m) => m.OrderEditPageComponent,
      ),
  },
];

