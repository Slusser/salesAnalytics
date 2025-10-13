import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'customers',
    loadComponent: () =>
      import('./pages/customers/customers.page').then((m) => m.CustomersPage),
  },
];
