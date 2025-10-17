import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { Observable, catchError, tap } from 'rxjs'

import { AUTH_RETURN_URL_QUERY_PARAM } from './auth.tokens'
import { AuthSessionService } from './auth-session.service'

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const session = inject(AuthSessionService)
  const router = inject(Router)

  const accessToken = session.tokens()?.accessToken
  const authorizedRequest = accessToken
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`
        }
      })
    : req

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        const redirectUrl = router.url
        session.logout()
        router.navigate(['/auth/login'], {
          queryParams: redirectUrl ? { [AUTH_RETURN_URL_QUERY_PARAM]: redirectUrl } : undefined
        })
      }
      throw error
    })
  )
}


