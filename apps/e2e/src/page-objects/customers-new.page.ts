import { expect, type Locator, type Page } from '@playwright/test';

export class CustomersNewPage {
  readonly form: Locator;
  readonly nameInput: Locator;
  readonly discountWrapper: Locator;
  readonly discountInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.form = page.getByTestId('customer-form');
    this.nameInput = page.getByTestId('customer-name-input');
    this.discountWrapper = page.getByTestId('customer-default-discount-input');
    this.discountInput = this.discountWrapper.locator('input');
    this.submitButton = page.getByTestId('customer-submit-button');
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.form).toBeVisible();
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.fill('');
    await this.nameInput.fill(name);
  }

  async fillDiscount(value: number): Promise<void> {
    await this.discountInput.fill('');
    await this.discountInput.fill(value.toFixed(2));
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}

