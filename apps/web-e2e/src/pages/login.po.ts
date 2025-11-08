import { expect, Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async expectLoginHeading(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: /logowanie/i })
    ).toBeVisible();
  }
}

