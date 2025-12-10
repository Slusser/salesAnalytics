import { test as base, expect } from '@playwright/test';

import { ApiClient } from '../helpers/api-client';
import type { TestUserCredentials } from '../helpers/test-credentials';
import {
  describeSkipMessage,
  ensureTestUserCredentials,
  hasTestUserCredentials,
} from '../helpers/test-credentials';

type AuthenticatedUserFixture = Awaited<
  ReturnType<ApiClient['login']>
> & {
  credentials: TestUserCredentials;
};

type AuthFixtures = {
  apiClient: ApiClient;
  authenticatedUser: AuthenticatedUserFixture;
};

export const test = base.extend<AuthFixtures>({
  apiClient: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
  authenticatedUser: async ({ apiClient }, use, testInfo) => {
    if (!hasTestUserCredentials) {
      testInfo.skip(describeSkipMessage);
    }

    const credentials = ensureTestUserCredentials();
    const loginResponse = await apiClient.login(
      credentials.email,
      credentials.password
    );

    await use({
      ...loginResponse,
      credentials,
    });
  },
});

export { expect } from '@playwright/test';


