import { expect, test } from '../fixtures/auth.fixture';
import { buildCustomerPayload } from '../helpers/test-data';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../helpers/test-credentials';
import { CustomersNewPage } from '../pages/customers-new.po';
import { CustomersPage } from '../pages/customers.po';
import { LoginPage } from '../pages/login.po';
import { MainLayoutPage } from '../pages/main-layout.po';

test.describe('Flow: ścieżka kontrahenta', () => {
  test.skip(!hasTestUserCredentials, describeSkipMessage);

  test('tworzy kontrahenta w UI i weryfikuje go w API', async ({
    page,
    apiClient,
    authenticatedUser,
  }) => {
    const credentials = ensureTestUserCredentials(
      'Brak danych logowania testowego dla flow kontrahenta.'
    );
    const payload = buildCustomerPayload();
    let createdCustomerId: string | null = null;

    try {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(credentials.email, credentials.password);

      const customersPage = new CustomersPage(page);
      await customersPage.expectLoaded();

      const layout = new MainLayoutPage(page);
      await layout.expectNavigationVisible();

      await page.getByRole('button', { name: 'Dodaj' }).click();

      const customersNewPage = new CustomersNewPage(page);
      await customersNewPage.expectLoaded();
      await customersNewPage.fillForm(payload);
      await customersNewPage.submit();

      await expect(
        page.getByText(`Kontrahent "${payload.name}" został utworzony.`)
      ).toBeVisible();

      await customersPage.expectLoaded();
      await customersPage.searchByName(payload.name);
      await customersPage.expectRowWithName(payload.name);

      const list = await apiClient.listCustomers(
        authenticatedUser.accessToken,
        { search: payload.name.toLowerCase() }
      );
      const match = list.items.find(
        (item) => item.name.toLowerCase() === payload.name.toLowerCase()
      );

      expect(match).toBeTruthy();
      createdCustomerId = match?.id ?? null;
    } finally {
      if (createdCustomerId) {
        await apiClient
          .deleteCustomer(authenticatedUser.accessToken, createdCustomerId)
          .catch(() => undefined);
      }
    }
  });
});


