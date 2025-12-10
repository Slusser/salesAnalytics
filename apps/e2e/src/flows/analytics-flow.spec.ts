import { test } from '../fixtures/orders.fixture';
import { buildOrderPayload } from '../helpers/test-data';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../helpers/test-credentials';
import { CustomersPage } from '../pages/customers.po';
import { DashboardPage } from '../pages/dashboard.po';
import { LoginPage } from '../pages/login.po';
import { MainLayoutPage } from '../pages/main-layout.po';

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('pl-PL', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

const defaultYearRange = () => {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));

  return {
    dateFrom: formatDate(start),
    dateTo: formatDate(end),
  };
};

test.describe('Flow: dashboard analytics', () => {
  test.skip(!hasTestUserCredentials, describeSkipMessage);

  test('synchronizuje KPI pomiędzy API a UI', async ({
    page,
    apiClient,
    authenticatedUser,
    createTestCustomer,
  }) => {
    const credentials = ensureTestUserCredentials(
      'Brak danych logowania testowego dla dashboardu.'
    );
    const customer = await createTestCustomer();
    const today = new Date();
    const orderPayload = buildOrderPayload(
      { customerId: customer.id, orderDate: formatDate(today) },
      {}
    );

    let createdOrderId: string | null = null;

    try {
      const order = await apiClient.createOrder(
        authenticatedUser.accessToken,
        orderPayload
      );
      createdOrderId = order.id;

      const filters = defaultYearRange();
      const kpi = await apiClient.getAnalyticsKpi(
        authenticatedUser.accessToken,
        filters
      );

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(credentials.email, credentials.password);

      const customersPage = new CustomersPage(page);
      await customersPage.expectLoaded();

      const layout = new MainLayoutPage(page);
      const kpiRequest = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes('/api/analytics/kpi') && response.request().method() === 'GET'
      );
      await layout.navigateTo('Dashboard');

      const dashboardPage = new DashboardPage(page);
      await dashboardPage.expectLoaded();
      await kpiRequest;

      const expectedCards = [
        {
          label: 'Suma netto (PLN)',
          value: currencyFormatter.format(kpi.sumNetPln),
        },
        {
          label: 'Suma brutto (PLN)',
          value: currencyFormatter.format(kpi.sumGrossPln),
        },
        {
          label: 'Marża łączna (PLN)',
          value: currencyFormatter.format(kpi.sumProfitPln),
        },
        {
          label: 'Liczba zamówień',
          value: integerFormatter.format(kpi.ordersCount),
        },
        {
          label: 'Średnia wartość zamówienia',
          value: currencyFormatter.format(kpi.avgOrderValue ?? 0),
        },
        {
          label: 'Średnia marża (%)',
          value: percentFormatter.format((kpi.avgMarginPct ?? 0) / 100),
        },
      ];

      for (const card of expectedCards) {
        await dashboardPage.expectKpiValue(card.label, card.value);
      }
    } finally {
      if (createdOrderId) {
        await apiClient
          .deleteOrder(authenticatedUser.accessToken, createdOrderId)
          .catch(() => undefined);
      }
    }
  });
});


