import { expect, test } from '@playwright/test';

import { LoginPage } from '../../pages/login.po';
import { CustomersPage } from '../../pages/customers.po';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../../helpers/test-credentials';

test.describe('Strona logowania', () => {
  test('wyświetla nagłówek logowania', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.expectLoginHeading();
  });

  test('waliduje pola formularza przed wysłaniem', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.fillEmail('niepoprawny');
    await page.getByLabel('Email').blur();
    await loginPage.fillPassword('123');
    await page.getByLabel('Hasło').blur();

    await loginPage.expectValidationMessage('Podaj poprawny adres email.');
    await loginPage.expectValidationMessage(
      'Hasło jest wymagane (min. 8 znaków).'
    );
    await expect(
      page.getByRole('button', { name: 'Zaloguj się' })
    ).toBeDisabled();
  });

  test.describe('z poprawnymi danymi', () => {
    test.skip(!hasTestUserCredentials, describeSkipMessage);

    test('pozwala zalogować się i przejść do listy kontrahentów', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const { email, password } = ensureTestUserCredentials();

      await loginPage.goto();
      await loginPage.login(email, password);

      const customersPage = new CustomersPage(page);
      await customersPage.expectLoaded();
      await customersPage.waitForContent();
    });
  });
});
