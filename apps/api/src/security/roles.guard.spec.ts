import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AppRole } from '@shared/dtos/user-roles.dto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import type { CurrentUserRequest } from './types';

const createExecutionContext = (request?: CurrentUserRequest) => {
  const handlerRef = Symbol('handler');
  const controllerRef = Symbol('controller');

  const targetRequest = request ?? ({} as CurrentUserRequest);
  const getRequest = vi.fn().mockReturnValue(targetRequest);
  const switchToHttp = vi.fn().mockReturnValue({
    getRequest,
  });

  const context = {
    switchToHttp,
    getHandler: vi.fn().mockReturnValue(handlerRef),
    getClass: vi.fn().mockReturnValue(controllerRef),
  } as unknown as ExecutionContext;

  return {
    context,
    request: targetRequest,
    switchToHttp,
    getRequest,
    handlerRef,
    controllerRef,
  };
};

describe('RolesGuard', () => {
  let getAllAndOverride: Mock<(key: unknown, targets: unknown[]) => boolean | string[] | undefined>;
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    getAllAndOverride = vi.fn();
    reflector = {
      getAllAndOverride,
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('przepuszcza żądania oznaczone jako publiczne', () => {
    getAllAndOverride.mockReturnValueOnce(true);
    const { context, switchToHttp, handlerRef, controllerRef } = createExecutionContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledTimes(1);
    expect(getAllAndOverride).toHaveBeenNthCalledWith(1, IS_PUBLIC_KEY, [
      handlerRef,
      controllerRef,
    ]);
    expect(switchToHttp).not.toHaveBeenCalled();
  });

  it('przepuszcza żądania, gdy dekorator ról zwraca pustą listę', () => {
    getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce([]);
    const { context, switchToHttp, handlerRef, controllerRef } = createExecutionContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(getAllAndOverride).toHaveBeenNthCalledWith(1, IS_PUBLIC_KEY, [
      handlerRef,
      controllerRef,
    ]);
    expect(getAllAndOverride).toHaveBeenNthCalledWith(2, ROLES_KEY, [
      handlerRef,
      controllerRef,
    ]);
    expect(switchToHttp).not.toHaveBeenCalled();
  });

  it('odrzuca żądania bez bieżącego użytkownika', () => {
    getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['owner']);
    const { context } = createExecutionContext();

    expect(() => guard.canActivate(context)).toThrowError(
      new ForbiddenException('Brak uprawnień do wykonania operacji.')
    );
  });

  it('odrzuca żądania, gdy użytkownik nie ma wymaganej roli', () => {
    const viewerRole: AppRole = 'viewer';
    const request = {
      currentUser: {
        actorId: 'user-1',
        actorRoles: [viewerRole],
        accessToken: 'token-viewer',
      },
    } as CurrentUserRequest;

    getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['owner']);
    const { context } = createExecutionContext(request);

    expect(() => guard.canActivate(context)).toThrowError(
      new ForbiddenException('Brak wymaganych ról do wykonania operacji.')
    );
  });

  it('przepuszcza żądania, gdy użytkownik posiada wymaganą rolę', () => {
    const ownerRole: AppRole = 'owner';
    const request = {
      currentUser: {
        actorId: 'user-1',
        actorRoles: ['viewer', ownerRole],
        accessToken: 'token-owner',
      },
    } as CurrentUserRequest;

    getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['owner', 'editor']);
    const { context } = createExecutionContext(request);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});


