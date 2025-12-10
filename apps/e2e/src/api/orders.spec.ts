import { expect, test } from '../fixtures/orders.fixture';
import { buildOrderPayload } from '../helpers/test-data';

test.describe('Orders API', () => {
  test('zwraca listę zamówień z metadanymi paginacji', async ({
    apiClient,
    authenticatedUser,
  }) => {
    const orders = await apiClient.listOrders(
      authenticatedUser.accessToken,
      { limit: 5 }
    );

    expect(Array.isArray(orders.items)).toBe(true);
    expect(orders.page).toBeGreaterThan(0);
    expect(orders.limit).toBeGreaterThan(0);
  });

  test('pozwala utworzyć zamówienie i odczytać je po identyfikatorze', async ({
    apiClient,
    authenticatedUser,
    createTestCustomer,
  }) => {
    const customer = await createTestCustomer();
    const orderPayload = buildOrderPayload({ customerId: customer.id });

    let createdOrderId: string | null = null;

    try {
      const order = await apiClient.createOrder(
        authenticatedUser.accessToken,
        orderPayload
      );
      createdOrderId = order.id;

      expect(order.customerId).toBe(customer.id);
      expect(order.orderNo).toBe(orderPayload.orderNo);

      const fetched = await apiClient.getOrder(
        authenticatedUser.accessToken,
        order.id
      );

      expect(fetched.id).toBe(order.id);
      expect(fetched.itemName).toBe(orderPayload.itemName);
    } finally {
      if (createdOrderId) {
        await apiClient
          .deleteOrder(authenticatedUser.accessToken, createdOrderId)
          .catch(() => undefined);
      }
    }
  });
});

