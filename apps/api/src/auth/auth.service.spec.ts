import {
    afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import type {
  AuthLoginCommand,
  AuthLoginResponse,
  UserRoleValue,
} from '@shared/dtos/user-roles.dto';
import type { Session } from '@supabase/supabase-js';

vi.mock('../supabase/supabase.factory', () => ({
  SupabaseFactory: vi.fn(),
}));

let AuthServiceClass: typeof import('./auth.service').AuthService;

beforeAll(async () => {
  const module = await import('./auth.service');
  AuthServiceClass = module.AuthService;
});

type RolesQueryResult = {
  data: Array<{ role: UserRoleValue }> | null;
  error: { code?: string; message?: string } | null;
};

const createRolesClient = (result: RolesQueryResult) => {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { client: { from }, eq, select, from };
};

const createSession = (
  overrides: Partial<Session> = {}
): Session =>
  ({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    user: {
      id: 'user-id',
      email: 'user@example.com',
      user_metadata: { full_name: 'User Example' },
      ...(overrides.user as Record<string, unknown> | undefined),
    },
    ...overrides,
  }) as Session;

describe('AuthService', () => {
  let service: InstanceType<typeof AuthServiceClass>;
  let supabaseFactoryMock: { create: ReturnType<typeof vi.fn> };
  let mapperMock: { toLoginResponse: ReturnType<typeof vi.fn> };

  const command: AuthLoginCommand = {
    email: 'user@example.com',
    password: 'secret',
  };

  beforeEach(() => {
    supabaseFactoryMock = { create: vi.fn() };
    mapperMock = { toLoginResponse: vi.fn() };

    service = new AuthServiceClass(
      supabaseFactoryMock as unknown as ConstructorParameters<
        typeof AuthServiceClass
      >[0],
      mapperMock as unknown as ConstructorParameters<
        typeof AuthServiceClass
      >[1]
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('zwraca DTO logowania przy poprawnych danych i przypisanych rolach', async () => {
    const session = createSession();
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
      },
    };
    const rolesClient = createRolesClient({
      data: [{ role: 'viewer' as UserRoleValue }],
      error: null,
    });
    supabaseFactoryMock.create
      .mockReturnValueOnce(supabaseAuthClient)
      .mockReturnValueOnce(rolesClient.client);

    const expectedResponse: AuthLoginResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        displayName: 'User Example',
        roles: ['viewer'],
      },
    };
    mapperMock.toLoginResponse.mockReturnValue(expectedResponse);

    const result = await service.login(command);

    expect(result).toBe(expectedResponse);
    expect(supabaseFactoryMock.create.mock.calls[0]).toEqual([]);
    expect(supabaseFactoryMock.create).toHaveBeenNthCalledWith(
      2,
      session.access_token
    );
    expect(supabaseAuthClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: command.email,
      password: command.password,
    });
    expect(rolesClient.from).toHaveBeenCalledWith('user_roles');
    expect(rolesClient.select).toHaveBeenCalledWith('role');
    expect(rolesClient.eq).toHaveBeenCalledWith('user_id', session.user.id);
    expect(mapperMock.toLoginResponse).toHaveBeenCalledWith(session, ['viewer']);
  });

  it('rzuca UnauthorizedException z kodem wrong_passoword przy błędnym haśle', async () => {
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: {
            message: 'Invalid login credentials',
            name: 'AuthApiError',
            status: 400,
          },
        }),
      },
    };
    supabaseFactoryMock.create.mockReturnValueOnce(supabaseAuthClient);

    const loginPromise = service.login(command);

    await expect(loginPromise).rejects.toBeInstanceOf(UnauthorizedException);
    await loginPromise.catch((error: UnauthorizedException) => {
      expect(error.getResponse()).toEqual({
        code: 'wrong_passoword',
        message: 'Nieprawidłowe dane logowania.',
      });
    });
    expect(mapperMock.toLoginResponse).not.toHaveBeenCalled();
  });

  it('rzuca UnauthorizedException z kodem user_not_found gdy Supabase nie znajduje użytkownika', async () => {
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: {
            message: 'User not found',
            name: 'AuthApiError',
            status: 404,
          },
        }),
      },
    };
    supabaseFactoryMock.create.mockReturnValueOnce(supabaseAuthClient);

    const loginPromise = service.login(command);

    await expect(loginPromise).rejects.toBeInstanceOf(UnauthorizedException);
    await loginPromise.catch((error: UnauthorizedException) => {
      expect(error.getResponse()).toEqual({
        code: 'user_not_found',
        message: 'Nieprawidłowe dane logowania.',
      });
    });
  });

  it('rzuca UnauthorizedException gdy Supabase nie zwraca sesji mimo sukcesu logowania', async () => {
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    };
    supabaseFactoryMock.create.mockReturnValueOnce(supabaseAuthClient);

    await expect(service.login(command)).rejects.toMatchObject({
      response: {
        code: 'invalid_credentials',
        message: 'Nieprawidłowe dane logowania.',
      },
    });
    expect(mapperMock.toLoginResponse).not.toHaveBeenCalled();
  });

  it('ponawia pobranie ról z kluczem serwisowym gdy Supabase zwraca błąd 42P17 i finalnie zwraca DTO', async () => {
    const session = createSession();
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
      },
    };
    const userTokenRolesClient = createRolesClient({
      data: null,
      error: { code: '42P17', message: 'RLS recursion detected' },
    });
    const serviceTokenRolesClient = createRolesClient({
      data: [{ role: 'editor' as UserRoleValue }],
      error: null,
    });
    supabaseFactoryMock.create
      .mockReturnValueOnce(supabaseAuthClient)
      .mockReturnValueOnce(userTokenRolesClient.client)
      .mockReturnValueOnce(serviceTokenRolesClient.client);

    const expectedResponse: AuthLoginResponse = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token ?? '',
      expiresIn: session.expires_in ?? 0,
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        displayName: 'User Example',
        roles: ['editor'],
      },
    };
    mapperMock.toLoginResponse.mockReturnValue(expectedResponse);

    const result = await service.login(command);

    expect(result).toBe(expectedResponse);
    expect(supabaseFactoryMock.create.mock.calls[0]).toEqual([]);
    expect(supabaseFactoryMock.create).toHaveBeenNthCalledWith(
      2,
      session.access_token
    );
    expect(supabaseFactoryMock.create).toHaveBeenNthCalledWith(
      3,
      undefined,
      { serviceRole: true }
    );
    expect(mapperMock.toLoginResponse).toHaveBeenCalledWith(session, ['editor']);
  });

  it('rzuca UnauthorizedException gdy pobieranie ról kończy się błędem mimo próby z kluczem serwisowym', async () => {
    const session = createSession();
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
      },
    };
    const userTokenRolesClient = createRolesClient({
      data: null,
      error: { code: '42P17', message: 'RLS recursion detected' },
    });
    const serviceTokenRolesClient = createRolesClient({
      data: null,
      error: { code: 'P0001', message: 'unexpected error' },
    });
    supabaseFactoryMock.create
      .mockReturnValueOnce(supabaseAuthClient)
      .mockReturnValueOnce(userTokenRolesClient.client)
      .mockReturnValueOnce(serviceTokenRolesClient.client);

    const loginPromise = service.login(command);

    await expect(loginPromise).rejects.toBeInstanceOf(UnauthorizedException);
    await loginPromise.catch((error: UnauthorizedException) => {
      expect(error.getResponse()).toEqual({
        code: 'invalid_credentials',
        message: 'Nieprawidłowe dane logowania.',
      });
    });
    expect(mapperMock.toLoginResponse).not.toHaveBeenCalled();
  });

  it('zwraca DTO z pustą listą ról gdy użytkownik nie ma przypisań', async () => {
    const session = createSession();
    const supabaseAuthClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
      },
    };
    const rolesClient = createRolesClient({
      data: [],
      error: null,
    });
    supabaseFactoryMock.create
      .mockReturnValueOnce(supabaseAuthClient)
      .mockReturnValueOnce(rolesClient.client);

    const expectedResponse: AuthLoginResponse = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token ?? '',
      expiresIn: session.expires_in ?? 0,
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        displayName: 'User Example',
        roles: [],
      },
    };
    mapperMock.toLoginResponse.mockReturnValue(expectedResponse);

    const result = await service.login(command);

    expect(result).toBe(expectedResponse);
    expect(mapperMock.toLoginResponse).toHaveBeenCalledWith(session, []);
  });
});


