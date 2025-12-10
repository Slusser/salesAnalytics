import type {
  CreateCustomerCommand,
  CustomerDto,
} from '@shared/dtos/customers.dto';

import { buildCustomerPayload } from '../helpers/test-data';
import { expect, test as base } from './auth.fixture';

type CustomersFixtures = {
  createTestCustomer: (
    overrides?: Partial<CreateCustomerCommand>
  ) => Promise<CustomerDto>;
};

export const test = base.extend<CustomersFixtures>({
  createTestCustomer: async ({ apiClient, authenticatedUser }, use) => {
    const createdCustomerIds: string[] = [];

    const factory = async (
      overrides: Partial<CreateCustomerCommand> = {}
    ): Promise<CustomerDto> => {
      const payload = buildCustomerPayload(overrides);
      const customer = await apiClient.createCustomer(
        authenticatedUser.accessToken,
        payload
      );

      createdCustomerIds.push(customer.id);

      return customer;
    };

    await use(factory);

    await Promise.allSettled(
      createdCustomerIds.map((id) =>
        apiClient
          .deleteCustomer(authenticatedUser.accessToken, id)
          .catch(() => undefined)
      )
    );
  },
});

export { expect } from './auth.fixture';


