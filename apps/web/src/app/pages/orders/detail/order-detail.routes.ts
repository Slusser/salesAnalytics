import type { Routes } from '@angular/router';

export const ORDER_DETAIL_ROUTES: Routes = [
  {
    path: '',
    data: { title: 'Zamówienie — Detal' },
    canDeactivate: [
      () =>
        import('./order-detail.can-deactivate.guard').then(
          (m) => m.orderDetailCanDeactivateGuard,
        ),
    ],
    loadComponent: () =>
      import('./order-detail.page').then(
        (m) => m.OrderDetailPageComponent,
      ),
  },
];

