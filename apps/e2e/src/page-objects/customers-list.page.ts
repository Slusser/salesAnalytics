import { expect, type Locator, type Page } from '@playwright/test';

import { getBaseUrl } from '../helpers/env';

export class CustomersListPage {
  readonly addButton: Locator;
  readonly table: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.addButton = page.getByTestId('customers-add-button');
    this.table = page.getByTestId('customers-table');
    this.rows = page.getByTestId('customers-table-row');
  }

  async goto(): Promise<void> {
    await this.page.goto(`${getBaseUrl()}/customers`);
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.table).toBeVisible();
  }

  async openCreateForm(): Promise<void> {
    await this.addButton.click();
  }

  async expectCustomerVisible(name: string): Promise<void> {
    const targetRow = this.rows.filter({ hasText: name });
    await expect(targetRow.first()).toBeVisible();
  }

  async waitForUrl(): Promise<void> {
    await this.page.waitForURL('**/customers**');
  }
}

