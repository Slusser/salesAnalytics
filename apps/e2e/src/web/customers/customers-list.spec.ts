import { test } from '@playwright/test';

import { LoginPage } from '../../pages/login.po';
import { CustomersPage } from '../../pages/customers.po';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../../helpers/test-credentials';

test.describe('Lista kontrahentów', () => {
  test.skip(!hasTestUserCredentials, describeSkipMessage);

  test('wyświetla tabelę lub pusty stan po zalogowaniu', async ({ page }) => {
    const { email, password } = ensureTestUserCredentials();
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(email, password);

    const customersPage = new CustomersPage(page);
    await customersPage.expectLoaded();
    await customersPage.waitForContent();
    await customersPage.expectListOrEmptyState();
  });
});

