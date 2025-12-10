import { expect, Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Dashboard sprzedażowy' })
    ).toBeVisible();
  }

  async expectKpiCard(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true })).toBeVisible();
  }

  async expectSection(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: true })).toBeVisible();
  }

  async expectKpiValue(label: string, value: string): Promise<void> {
    const card = this.page
      .locator('.kpi-cards__card')
      .filter({
        has: this.page.locator('.kpi-cards__label', { hasText: label }),
      })
      .first();

    await expect(card.locator('.kpi-cards__value')).toHaveText(value);
  }
}

