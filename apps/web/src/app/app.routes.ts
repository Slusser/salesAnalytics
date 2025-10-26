import { Route } from '@angular/router';

import { authGuard } from './service/auth/auth.guard';
import { roleGuard } from './service/auth/role.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./pages/auth/auth.layout').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/auth/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'logout',
        loadComponent: () =>
          import('./pages/auth/logout.page').then((m) => m.LogoutPage),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/main/main.layout').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'customers/new',
        canMatch: [roleGuard(['editor', 'owner'])],
        loadComponent: () =>
          import('./pages/customers/new/customers-new.page').then((m) => m.CustomersNewPageComponent),
      },
      {
        path: 'customers',
        canMatch: [roleGuard(['viewer', 'owner', 'editor'])],
        loadComponent: () =>
          import('./pages/customers/customers.page').then((m) => m.CustomersPage),
      },
      {
        path: 'customers/:id',
        canMatch: [roleGuard(['viewer', 'owner', 'editor'])],
        data: { title: 'Kontrahent — Detal' },
        loadComponent: () =>
          import('./pages/customers/customer-detail.page').then((m) => m.CustomerDetailPage),
      },
      {
        path: 'orders',
        canMatch: [roleGuard(['viewer', 'owner', 'editor'])],
        loadComponent: () =>
          import('./pages/orders/orders.page').then((m) => m.OrdersPage),
      },
      {
        path: '403',
        loadComponent: () =>
          import('./pages/error/forbidden.page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        redirectTo: 'customers',
      },
    ],
  },
];
