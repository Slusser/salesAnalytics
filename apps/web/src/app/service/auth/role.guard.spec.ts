import { TestBed } from '@angular/core/testing';
import type { UrlSegment, UrlTree, Route } from '@angular/router';
import { Router } from '@angular/router';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import type { AuthenticatedUserDto } from '@shared/dtos/auth.dto';
import type { AppRole } from '@shared/dtos/user-roles.dto';

import { AuthSessionService } from './auth-session.service';
import { roleGuard } from './role.guard';

const dummyRoute = {} as Route;
const dummySegments: UrlSegment[] = [];

describe('roleGuard', () => {
  let isLoggedInMock: ReturnType<typeof vi.fn>;
  let userMock: ReturnType<typeof vi.fn>;
  let routerMock: { createUrlTree: ReturnType<typeof vi.fn> };

  const callGuard = (roles: AppRole[]) =>
    TestBed.runInInjectionContext(() =>
      roleGuard(roles)(dummyRoute, dummySegments)
    );

  beforeEach(() => {
    isLoggedInMock = vi.fn();
    userMock = vi.fn();
    routerMock = {
      createUrlTree: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            isLoggedIn: isLoggedInMock as unknown,
            user: userMock as unknown,
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

  it('zwraca true, jeżeli nie ma wymaganych ról', () => {
    const result = callGuard([]);

    expect(result).toBe(true);
    expect(isLoggedInMock).not.toHaveBeenCalled();
    expect(routerMock.createUrlTree).not.toHaveBeenCalled();
  });

  it('przekierowuje na ekran logowania, gdy użytkownik nie jest zalogowany', () => {
    const loginTree = {} as UrlTree;
    isLoggedInMock.mockReturnValue(false);
    routerMock.createUrlTree.mockReturnValue(loginTree);

    const result = callGuard(['owner']);

    expect(isLoggedInMock).toHaveBeenCalledTimes(1);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
    expect(result).toBe(loginTree);
  });

  it('przekierowuje na ekran logowania, gdy brak danych użytkownika w sesji', () => {
    const loginTree = {} as UrlTree;
    isLoggedInMock.mockReturnValue(true);
    userMock.mockReturnValue(null);
    routerMock.createUrlTree.mockReturnValue(loginTree);

    const result = callGuard(['owner']);

    expect(userMock).toHaveBeenCalledTimes(1);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
    expect(result).toBe(loginTree);
  });

  it('przekierowuje na stronę 403, gdy użytkownik nie ma wymaganej roli', () => {
    const forbiddenTree = {} as UrlTree;
    const user: AuthenticatedUserDto = {
      id: 'user-1',
      displayName: 'Viewer User',
      email: 'viewer@example.com',
      roles: ['viewer'],
    };

    isLoggedInMock.mockReturnValue(true);
    userMock.mockReturnValue(user);
    routerMock.createUrlTree.mockReturnValue(forbiddenTree);

    const result = callGuard(['owner']);

    expect(userMock).toHaveBeenCalledTimes(1);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/403']);
    expect(result).toBe(forbiddenTree);
  });

  it('zwraca true, gdy użytkownik posiada jedną z wymaganych ról', () => {
    const user: AuthenticatedUserDto = {
      id: 'user-2',
      displayName: 'Owner User',
      email: 'owner@example.com',
      roles: ['editor', 'owner'],
    };

    isLoggedInMock.mockReturnValue(true);
    userMock.mockReturnValue(user);

    const result = callGuard(['owner', 'viewer']);

    expect(result).toBe(true);
    expect(routerMock.createUrlTree).not.toHaveBeenCalled();
  });
});

