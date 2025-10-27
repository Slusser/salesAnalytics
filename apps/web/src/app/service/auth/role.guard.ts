import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';

import type { AppRole } from '@shared/dtos/user-roles.dto';

import { AuthSessionService } from './auth-session.service';

export const roleGuard =
  (requiredRoles: AppRole[]): CanMatchFn =>
  (_route: Route, _segments: UrlSegment[]) => {
    const session = inject(AuthSessionService);
    const router = inject(Router);

    if (requiredRoles.length === 0) {
      return true;
    }

    if (!session.isLoggedIn()) {
      return router.createUrlTree(['/auth/login']);
    }

    const user = session.user();
    if (!user) {
      return router.createUrlTree(['/auth/login']);
    }

    const hasRequiredRole = user.roles.some((role) =>
      requiredRoles.includes(role)
    );
    if (!hasRequiredRole) {
      return router.createUrlTree(['/403']);
    }

    return true;
  };
