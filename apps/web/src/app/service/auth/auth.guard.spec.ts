import { TestBed } from '@angular/core/testing';
import type {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Router } from '@angular/router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { AuthSessionService } from './auth-session.service';
import { authGuard } from './auth.guard';
import { AUTH_RETURN_URL_QUERY_PARAM } from './auth.tokens';

describe('authGuard', () => {
  let isLoggedInMock: Mock<() => boolean>;
  let routerMock: { createUrlTree: Mock<(routes: unknown[], queryParams?: Record<string, unknown>) => UrlTree> };
  const route = {} as ActivatedRouteSnapshot;

  const createState = (url: string): RouterStateSnapshot =>
    ({ url } as RouterStateSnapshot);

  const callGuard = (state: RouterStateSnapshot) =>
    TestBed.runInInjectionContext(() => authGuard(route, state));

  beforeEach(() => {
    isLoggedInMock = vi.fn();
    routerMock = {
      createUrlTree: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            isLoggedIn: isLoggedInMock,
          },
        },
        {
          provide: Router,
          useValue: routerMock,
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('zwraca true, gdy użytkownik jest zalogowany', () => {
    const state = createState('/dashboard');
    isLoggedInMock.mockReturnValue(true);

    const result = callGuard(state);

    expect(isLoggedInMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(routerMock.createUrlTree).not.toHaveBeenCalled();
  });

  it('przekierowuje na stronę logowania bez parametru powrotu dla adresu głównego', () => {
    const loginTree = {} as UrlTree;
    const state = createState('/');
    isLoggedInMock.mockReturnValue(false);
    routerMock.createUrlTree.mockReturnValue(loginTree);

    const result = callGuard(state);

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: undefined,
    });
    expect(result).toBe(loginTree);
  });

  it('przekierowuje na stronę logowania z parametrem powrotu dla adresu innego niż główny', () => {
    const loginTree = {} as UrlTree;
    const state = createState('/orders?filter=open');
    isLoggedInMock.mockReturnValue(false);
    routerMock.createUrlTree.mockReturnValue(loginTree);

    const result = callGuard(state);

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { [AUTH_RETURN_URL_QUERY_PARAM]: state.url },
    });
    expect(result).toBe(loginTree);
  });
});


