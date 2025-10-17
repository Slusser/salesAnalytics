import { inject } from '@angular/core'
import { CanMatchFn, Route, UrlSegment } from '@angular/router'

import type { AppRole } from 'apps/shared/dtos/user-roles.dto'

import { AuthSessionService } from './auth-session.service'

export const roleGuard = (requiredRoles: AppRole[]): CanMatchFn =>
  (_route: Route, _segments: UrlSegment[]) => {
    const session = inject(AuthSessionService)
    if (!session.isLoggedIn()) return false
    const user = session.user()
    if (!user) return false
    return user.roles.some((role) => requiredRoles.includes(role))
  }


