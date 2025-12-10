import { test } from '@playwright/test';

import { LoginPage } from '../../pages/login.po';
import { CustomersPage } from '../../pages/customers.po';
import { MainLayoutPage } from '../../pages/main-layout.po';
import { DashboardPage } from '../../pages/dashboard.po';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../../helpers/test-credentials';

test.describe('Dashboard UI', () => {
  test.skip(!hasTestUserCredentials, describeSkipMessage);

  test.beforeEach(async ({ page }) => {
    const { email, password } = ensureTestUserCredentials();
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);

    const customersPage = new CustomersPage(page);
    await customersPage.expectLoaded();

    const layout = new MainLayoutPage(page);
    await layout.navigateTo('Dashboard');
  });

  test('pokazuje KPI, trend i dzienny rozkład', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.expectLoaded();
    await dashboardPage.expectKpiCard('Suma netto (PLN)');
    await dashboardPage.expectKpiCard('Liczba zamówień');
    await dashboardPage.expectSection('Trend miesięczny');
    await dashboardPage.expectSection('Rozkład dzienny');
  });
});

