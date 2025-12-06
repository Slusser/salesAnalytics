import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError } from 'rxjs';

import { AUTH_RETURN_URL_QUERY_PARAM } from './auth.tokens';
import { AuthSessionService } from './auth-session.service';

const BUSINESS_FORBIDDEN_PREFIXES = [
  'ANALYTICS_',
  'CUSTOMERS_',
  'ORDERS_',
  'FX_RATES_',
  'AUDIT_',
];

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const session = inject(AuthSessionService);
  const router = inject(Router);

  const accessToken = session.tokens()?.accessToken;
  const authorizedRequest = accessToken
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    : req;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (shouldForceLogout(error)) {
        const redirectUrl = router.url;
        session.logout();
        router.navigate(['/auth/login'], {
          queryParams: redirectUrl
            ? { [AUTH_RETURN_URL_QUERY_PARAM]: redirectUrl }
            : undefined,
        });
      }
      throw error;
    })
  );
}

function shouldForceLogout(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  if (error.status === 401) {
    return true;
  }

  if (error.status !== 403) {
    return false;
  }

  const codeCandidate =
    typeof error.error === 'object'
      ? (error.error as { code?: string })?.code
      : undefined;
  const code = typeof codeCandidate === 'string' ? codeCandidate : undefined;

  if (!code) {
    return true;
  }

  return !BUSINESS_FORBIDDEN_PREFIXES.some((prefix) =>
    code.startsWith(prefix)
  );
}
