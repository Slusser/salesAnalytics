import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
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
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestContextService } from './request-context.service';
import type { CurrentUserRequest } from './types';
import type { UserRoleValue } from '@shared/dtos/user-roles.dto';

const createExecutionContext = (authorization?: string) => {
  const request = {
    headers: {} as Record<string, string | undefined>,
  } as CurrentUserRequest;

  if (authorization) {
    request.headers.authorization = authorization;
  }

  const handlerRef = Symbol('handler');
  const controllerRef = Symbol('controller');

  const getRequest = vi.fn().mockReturnValue(request);
  const context = {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest,
    }),
    getHandler: vi.fn().mockReturnValue(handlerRef),
    getClass: vi.fn().mockReturnValue(controllerRef),
  } as unknown as ExecutionContext;

  return {
    context,
    request,
    handlerRef,
    controllerRef,
  };
};

describe('JwtAuthGuard', () => {
  let resolveCurrentUser: Mock<(accessToken: string) => Promise<CustomerMutatorContext | undefined>>;
  let requestContext: RequestContextService;
  let getAllAndOverride: Mock<(key: unknown, targets: unknown[]) => boolean | undefined>;
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    resolveCurrentUser = vi.fn();
    requestContext = {
      resolveCurrentUser,
    } as unknown as RequestContextService;

    getAllAndOverride = vi.fn().mockReturnValue(false);
    reflector = {
      getAllAndOverride,
    } as unknown as Reflector;

    guard = new JwtAuthGuard(requestContext, reflector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('przepuszcza żądania oznaczone jako publiczne', async () => {
    getAllAndOverride.mockReturnValueOnce(true);
    const { context, handlerRef, controllerRef } = createExecutionContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handlerRef,
      controllerRef,
    ]);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it('odrzuca żądanie bez tokenu dostępowego', async () => {
    const { context } = createExecutionContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Brak tokenu uwierzytelniającego.').message
    );
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it('odrzuca żądanie, gdy nie uda się ustalić bieżącego użytkownika', async () => {
    const token = 'test-token';
    resolveCurrentUser.mockResolvedValue(undefined);
    const { context } = createExecutionContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Użytkownik nie jest uwierzytelniony.').message
    );
    expect(resolveCurrentUser).toHaveBeenCalledWith(token);
  });

  it('ustawia currentUser w żądaniu i przepuszcza je przy poprawnej autoryzacji', async () => {
    const token = 'test-token';
    const currentUser = {
      actorId: 'user-1',
      actorRoles: ['owner' as UserRoleValue],
    } satisfies CustomerMutatorContext;

    resolveCurrentUser.mockResolvedValue(currentUser);
    const { context, request } = createExecutionContext(`Bearer ${token}`);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(resolveCurrentUser).toHaveBeenCalledWith(token);
    expect(request.currentUser).toStrictEqual(currentUser);
  });
});

