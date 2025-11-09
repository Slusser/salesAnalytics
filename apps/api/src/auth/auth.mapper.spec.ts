import { beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';

import type { UserRoleValue } from '@shared/dtos/user-roles.dto';

import { AuthMapper } from './auth.mapper';

type SessionOverrides = {
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  user?: {
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
};

const createSession = (overrides: SessionOverrides = {}): Session => {
  const userOverrides = overrides.user ?? {};

  return {
    access_token:
      overrides.access_token ?? 'access-token',
    refresh_token:
      overrides.refresh_token === undefined
        ? 'refresh-token'
        : overrides.refresh_token,
    expires_in:
      overrides.expires_in === undefined ? 3600 : overrides.expires_in,
    user: {
      id: userOverrides.id ?? 'user-id',
      email:
        userOverrides.email === undefined
          ? 'user@example.com'
          : userOverrides.email,
      user_metadata: userOverrides.user_metadata ?? {},
    },
  } as unknown as Session;
};

describe('AuthMapper', () => {
  let mapper: AuthMapper;
  const roles: UserRoleValue[] = ['owner' as UserRoleValue];

  beforeEach(() => {
    mapper = new AuthMapper();
  });

  it('mapuje sesję na odpowiedź logowania uwzględniając pełne imię i nazwisko', () => {
    const session = createSession({
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_in: 7200,
      user: {
        user_metadata: { full_name: 'Anna Nowak' },
      },
    });

    const result = mapper.toLoginResponse(session, roles);

    expect(result).toEqual({
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      expiresIn: 7200,
      user: {
        id: 'user-id',
        email: 'user@example.com',
        displayName: 'Anna Nowak',
        roles,
      },
    });
  });

  it('ustawia displayName na adres email, gdy brak wartości w metadanych', () => {
    const session = createSession({
      user: {
        email: 'kontakt@example.com',
        user_metadata: {},
      },
    });

    const result = mapper.toLoginResponse(session, roles);

    expect(result.user.displayName).toBe('kontakt@example.com');
    expect(result.user.email).toBe('kontakt@example.com');
  });

  it('zwraca wartości domyślne, gdy brakuje refresha, czasu wygaśnięcia i adresu email', () => {
    const session = createSession({
      refresh_token: null,
      expires_in: null,
      user: {
        email: null,
        user_metadata: {},
      },
    });

    const result = mapper.toLoginResponse(session, roles);

    expect(result.refreshToken).toBe('');
    expect(result.expiresIn).toBe(0);
    expect(result.user.email).toBe('');
    expect(result.user.displayName).toBe('');
  });
});


