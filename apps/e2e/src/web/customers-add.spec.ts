import { randomUUID } from 'node:crypto';

import { expect, test } from '../fixtures/app-fixtures';

test.describe('Kontrahenci - tworzenie', () => {
  test('powinien dodać nowego kontrahenta przez UI', async ({
    page,
    apiClient,
    customersListPage,
    customersNewPage,
    authSession,
  }) => {
    const suffix = randomUUID().slice(0, 8);
    const customerName = `E2E Kontrahent ${suffix}`;
    const defaultDiscount = 7.5;

    await apiClient.removeCustomersByName(authSession.accessToken, customerName);

    try {
      await test.step('Przejdź do listy kontrahentów', async () => {
        await customersListPage.goto();
        await customersListPage.waitForUrl();
        await customersListPage.waitForLoaded();
      });

      await test.step('Otwórz formularz dodawania', async () => {
        await customersListPage.openCreateForm();
        await page.waitForURL('**/customers/new');
        await customersNewPage.waitForLoaded();
      });

      await test.step('Wypełnij formularz kontrahenta', async () => {
        await customersNewPage.fillName(customerName);
        await customersNewPage.fillDiscount(defaultDiscount);
        await expect(customersNewPage.form).toHaveScreenshot(
          'customers-add__form.png',
          {
            animations: 'disabled',
            mask: [customersNewPage.nameInput, customersNewPage.discountInput],
          }
        );
      });

      await test.step('Zapisz i wróć na listę', async () => {
        await customersNewPage.submit();
        await page.waitForURL('**/customers**');
        await customersListPage.waitForLoaded();
      });

      await test.step('Zweryfikuj komunikaty i dane', async () => {
        await expect(
          page.getByText(`Kontrahent "${customerName}" został utworzony.`)
        ).toBeVisible();
        await customersListPage.expectCustomerVisible(customerName);
      });
    } finally {
      await apiClient.removeCustomersByName(
        authSession.accessToken,
        customerName
      );
    }
  });
});

