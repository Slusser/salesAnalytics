import { Route } from '@angular/router'

import { authGuard } from './service/auth/auth.guard'

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
    path: 'customers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/customers/customers.page').then((m) => m.CustomersPage),
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
