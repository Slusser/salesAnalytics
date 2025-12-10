import { expect, Page } from '@playwright/test';
import type { CreateCustomerCommand } from '@shared/dtos/customers.dto';

export class CustomersNewPage {
  constructor(private readonly page: Page) {}

  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Nowy kontrahent' })
    ).toBeVisible();
  }

  async fillForm(data: CreateCustomerCommand): Promise<void> {
    await this.page.getByLabel('Nazwa kontrahenta').fill(data.name);

    if (typeof data.defaultDistributorDiscountPct === 'number') {
      await this.fillNumber(
        '#customer-default-discount',
        data.defaultDistributorDiscountPct
      );
    }

    if (data.comment) {
      await this.page.getByLabel('Komentarz').fill(data.comment);
    }

    const activeCheckbox = this.page.locator('#customer-active input');
    const shouldBeActive = data.isActive ?? true;

    if ((await activeCheckbox.count()) > 0) {
      const checked = await activeCheckbox.isChecked();
      if (checked !== shouldBeActive) {
        await activeCheckbox.click();
      }
    }
  }

  async submit(): Promise<void> {
    const submitButton = this.page.getByRole('button', { name: 'Zapisz' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  private async fillNumber(selector: string, value: number): Promise<void> {
    const input = this.page.locator(`${selector} input`);
    if (await input.count()) {
      await input.fill(value.toString());
      return;
    }

    const fallback = this.page.locator(selector);
    await fallback.fill(value.toString());
  }
}


