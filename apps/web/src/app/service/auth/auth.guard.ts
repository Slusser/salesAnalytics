import { inject } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  Router,
  RouterStateSnapshot
} from '@angular/router'

import { AUTH_RETURN_URL_QUERY_PARAM } from './auth.tokens'
import { AuthSessionService } from './auth-session.service'

export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): GuardResult => {
  const session = inject(AuthSessionService)
  const router = inject(Router)

  if (session.isLoggedIn()) {
    return true
  }

  const returnUrl = state.url && state.url !== '/' ? state.url : undefined
  return router.createUrlTree(['/auth/login'], {
    queryParams: returnUrl ? { [AUTH_RETURN_URL_QUERY_PARAM]: returnUrl } : undefined
  })
}


