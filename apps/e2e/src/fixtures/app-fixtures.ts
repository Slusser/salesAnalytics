import { test as base } from '@playwright/test';

import type { AuthLoginResponse } from '@shared/dtos/auth.dto';

import { ApiClient } from '../helpers/api-client';
import { getApiUrl, getAuthStorageKey, getTestCredentials } from '../helpers/env';
import { CustomersListPage } from '../page-objects/customers-list.page';
import { CustomersNewPage } from '../page-objects/customers-new.page';

type AppFixtures = {
  apiClient: ApiClient;
  authSession: AuthLoginResponse;
  customersListPage: CustomersListPage;
  customersNewPage: CustomersNewPage;
};

const test = base.extend<AppFixtures>({
  apiClient: async ({ request }, use) => {
    const client = new ApiClient(request, { apiUrl: getApiUrl() });
    await use(client);
  },
  authSession: [
    async ({ apiClient, context }, use) => {
      const credentials = getTestCredentials();
      const session = await apiClient.login(credentials);

      const snapshot = JSON.stringify({
        tokens: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
        },
        user: session.user,
      });

      await context.addInitScript(
        ({ key, value }) => {
          window.sessionStorage.setItem(key, value);
        },
        { key: getAuthStorageKey(), value: snapshot }
      );

      await use(session);
    },
    { auto: true },
  ],
  customersListPage: async ({ page }, use) => {
    const pageObject = new CustomersListPage(page);
    await use(pageObject);
  },
  customersNewPage: async ({ page }, use) => {
    const pageObject = new CustomersNewPage(page);
    await use(pageObject);
  },
});

export { test };
export const expect = test.expect;

