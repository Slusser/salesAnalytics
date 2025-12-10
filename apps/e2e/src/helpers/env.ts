const DEFAULT_BASE_URL = 'http://localhost:4200';
const DEFAULT_API_URL = 'http://localhost:3000';
const AUTH_STORAGE_KEY = 'salesAnalysis:auth';

export interface TestCredentials {
  email: string;
  password: string;
}

export const getBaseUrl = (): string =>
  process.env['BASE_URL'] ?? DEFAULT_BASE_URL;

export const getApiUrl = (): string =>
  process.env['API_URL'] ?? DEFAULT_API_URL;

export const getAuthStorageKey = (): string => AUTH_STORAGE_KEY;

export const getTestCredentials = (): TestCredentials => {
  const email = process.env['TEST_USER_EMAIL'];
  const password = process.env['TEST_USER_PASSWORD'];

  if (!email || !password) {
    throw new Error(
      'Brakuje zmiennych TEST_USER_EMAIL oraz TEST_USER_PASSWORD dla testów E2E.'
    );
  }

  return { email, password };
};

