import { expect, test } from '../fixtures/auth.fixture';

test.describe('Auth API', () => {
  test('odrzuca niepoprawne dane logowania', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'nie-istnieje@example.com',
        password: 'incorrect-password',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      message: expect.stringContaining('Nieprawidłowe'),
    });
  });

  test.describe('z poprawnymi danymi', () => {
    test('zwraca tokeny i profil użytkownika', async ({
      apiClient,
      authenticatedUser,
    }) => {
      const loginResponse = await apiClient.login(
        authenticatedUser.credentials.email,
        authenticatedUser.credentials.password
      );

      expect(loginResponse.accessToken).toBeTruthy();
      expect(loginResponse.refreshToken).toBeTruthy();
      expect(loginResponse.user.email.toLowerCase()).toBe(
        authenticatedUser.credentials.email.toLowerCase()
      );
      expect(loginResponse.user.roles.length).toBeGreaterThan(0);
    });

    test('pozwala na wylogowanie z użyciem refresh tokena', async ({
      apiClient,
      authenticatedUser,
    }) => {
      const logoutResponse = await apiClient.logout(
        authenticatedUser.refreshToken
      );

      expect(logoutResponse.success).toBe(true);
    });
  });
});

