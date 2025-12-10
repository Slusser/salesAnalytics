import { expect, test } from '../fixtures/customers.fixture';
import { buildCustomerPayload } from '../helpers/test-data';

test.describe('Customers API', () => {
  test('zwraca listę klientów z podstawowymi danymi', async ({
    apiClient,
    authenticatedUser,
  }) => {
    const customers = await apiClient.listCustomers(
      authenticatedUser.accessToken,
      { limit: 10 }
    );

    expect(Array.isArray(customers.items)).toBe(true);
    expect(customers.page).toBeGreaterThan(0);
    expect(customers.total).toBeGreaterThanOrEqual(0);
  });

  test('pozwala utworzyć i usunąć klienta', async ({
    apiClient,
    authenticatedUser,
  }) => {
    const payload = buildCustomerPayload();

    const created = await apiClient.createCustomer(
      authenticatedUser.accessToken,
      payload
    );

    expect(created.name).toBe(payload.name);
    expect(created.isActive).toBe(true);

    await apiClient.deleteCustomer(
      authenticatedUser.accessToken,
      created.id
    );
  });
});

