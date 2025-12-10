import { expect, test } from '../fixtures/auth.fixture';

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

test.describe('Analytics API', () => {
  test('zwraca agregaty KPI dla bieżącego zakresu dat', async ({
    apiClient,
    authenticatedUser,
  }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const kpi = await apiClient.getAnalyticsKpi(
      authenticatedUser.accessToken,
      {
      dateFrom: formatDate(thirtyDaysAgo),
      dateTo: formatDate(now),
      }
    );

    expect(typeof kpi.sumNetPln).toBe('number');
    expect(typeof kpi.ordersCount).toBe('number');
    expect(typeof kpi.avgOrderValue).toBe('number');
  });
});

