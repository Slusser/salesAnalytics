import { test } from '@playwright/test';

import { LoginPage } from '../../pages/login.po';
import { CustomersPage } from '../../pages/customers.po';
import { MainLayoutPage } from '../../pages/main-layout.po';
import { OrdersPage } from '../../pages/orders.po';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../../helpers/test-credentials';

test.describe('Lista zamówień', () => {
  test.skip(!hasTestUserCredentials, describeSkipMessage);

  test.beforeEach(async ({ page }) => {
    const { email, password } = ensureTestUserCredentials();
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);

    const customersPage = new CustomersPage(page);
    await customersPage.expectLoaded();

    const layout = new MainLayoutPage(page);
    await layout.navigateTo('Zamówienia');
  });

  test('wyświetla pasek filtrów i tabelę lub pusty stan', async ({ page }) => {
    const ordersPage = new OrdersPage(page);
    await ordersPage.expectLoaded();
    await ordersPage.waitForContent();
    await ordersPage.expectListOrEmptyState();
  });
});

