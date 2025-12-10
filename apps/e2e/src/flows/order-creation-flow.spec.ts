import { expect, test } from '../fixtures/orders.fixture';
import { buildOrderPayload } from '../helpers/test-data';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../helpers/test-credentials';
import { LoginPage } from '../pages/login.po';
import { CustomersPage } from '../pages/customers.po';
import { MainLayoutPage } from '../pages/main-layout.po';
import { OrdersPage } from '../pages/orders.po';
import { OrdersNewPage } from '../pages/orders-new.po';

test.describe('Flow: tworzenie zamówienia', () => {
  test.skip(!hasTestUserCredentials, describeSkipMessage);

  test('tworzy zamówienie w UI i weryfikuje je w API', async ({
    page,
    apiClient,
    authenticatedUser,
    createTestCustomer,
  }) => {
    const credentials = ensureTestUserCredentials(
      'Brak TEST_USER_EMAIL/TEST_USER_PASSWORD – wymagane do testów UI.'
    );
    const customer = await createTestCustomer();
    const orderPayload = buildOrderPayload({ customerId: customer.id });

    let createdOrderId: string | null = null;

    try {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(credentials.email, credentials.password);

      const customersPage = new CustomersPage(page);
      await customersPage.expectLoaded();

      const layout = new MainLayoutPage(page);
      await layout.navigateTo('Zamówienia');

      const ordersPage = new OrdersPage(page);
      await ordersPage.expectLoaded();

      await page.getByRole('button', { name: 'Dodaj' }).click();

      const ordersNewPage = new OrdersNewPage(page);
      await ordersNewPage.expectLoaded();
      await ordersNewPage.fillForm(orderPayload, customer.name);
      await ordersNewPage.waitForCalculation();
      await ordersNewPage.submit();

      await expect(
        page.getByText('Zamówienie zostało utworzone.')
      ).toBeVisible();
      await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/i);

      createdOrderId = page.url().split('/').pop() ?? null;
      expect(createdOrderId).toBeTruthy();

      const order = await apiClient.getOrder(
        authenticatedUser.accessToken,
        createdOrderId!
      );
      expect(order.orderNo).toBe(orderPayload.orderNo);
      expect(order.customerId).toBe(customer.id);
      expect(order.itemName).toBe(orderPayload.itemName);
    } finally {
      if (createdOrderId) {
        await apiClient
          .deleteOrder(authenticatedUser.accessToken, createdOrderId)
          .catch(() => undefined);
      }
    }
  });
});

