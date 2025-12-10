import { expect, Page } from '@playwright/test';

export class CustomersPage {
  constructor(private readonly page: Page) {}

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Kontrahenci' })).toBeVisible();
    await expect(this.page.locator('app-filter-bar')).toBeVisible();
  }

  async waitForContent(): Promise<void> {
    const table = this.page.locator('app-customers-table');
    const emptyState = this.page.locator('app-empty-state');

    try {
      await Promise.race([
        table.waitFor({ state: 'visible', timeout: 8_000 }),
        emptyState.waitFor({ state: 'visible', timeout: 8_000 }),
      ]);
    } catch {
      // fallback to assertions below
    }
  }

  async expectListOrEmptyState(): Promise<void> {
    const table = this.page.locator('app-customers-table');
    const emptyState = this.page.locator('app-empty-state');

    if (await table.isVisible()) {
      await expect(table).toBeVisible();
      return;
    }

    await expect(
      emptyState.locator('text=Brak kontrahentów')
    ).toBeVisible();
  }

  async searchByName(name: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder('Szukaj kontrahenta');
    await searchInput.fill('');
    await searchInput.fill(name);
    await this.page.waitForLoadState('networkidle');
  }

  async expectRowWithName(name: string): Promise<void> {
    await expect(
      this.page.locator('.customers-table__name span', {
        hasText: name,
      })
    ).toBeVisible();
  }
}

