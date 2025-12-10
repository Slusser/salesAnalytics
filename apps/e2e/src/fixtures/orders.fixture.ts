import type {
  CreateOrderCommand,
  OrderResponse,
} from '@shared/dtos/orders.dto';
import type { CreateCustomerCommand } from '@shared/dtos/customers.dto';

import { buildOrderPayload } from '../helpers/test-data';
import { expect, test as base } from './customers.fixture';

type CreateOrderOptions = {
  customerId?: string;
  customerOverrides?: Partial<CreateCustomerCommand>;
  orderOverrides?: Partial<CreateOrderCommand>;
};

type OrdersFixtures = {
  createTestOrder: (
    options?: CreateOrderOptions
  ) => Promise<{
    order: OrderResponse;
    payload: CreateOrderCommand;
    customerId: string;
  }>;
};

export const test = base.extend<OrdersFixtures>({
  createTestOrder: async (
    { apiClient, authenticatedUser, createTestCustomer },
    use
  ) => {
    const createdOrderIds: string[] = [];

    const factory = async (
      options: CreateOrderOptions = {}
    ): Promise<{
      order: OrderResponse;
      payload: CreateOrderCommand;
      customerId: string;
    }> => {
      const customerId =
        options.customerId ??
        (await createTestCustomer(options.customerOverrides)).id;
      const payload = buildOrderPayload(
        { customerId },
        options.orderOverrides
      );

      const order = await apiClient.createOrder(
        authenticatedUser.accessToken,
        payload
      );

      createdOrderIds.push(order.id);

      return { order, payload, customerId };
    };

    await use(factory);

    await Promise.allSettled(
      createdOrderIds.map((id) =>
        apiClient
          .deleteOrder(authenticatedUser.accessToken, id)
          .catch(() => undefined)
      )
    );
  },
});

export { expect } from './customers.fixture';


