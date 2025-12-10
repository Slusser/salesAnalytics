import type { APIRequestContext } from '@playwright/test';

import type { AuthLoginResponse } from '@shared/dtos/auth.dto';
import type { CustomerDto, ListCustomersResponse } from '@shared/dtos/customers.dto';

export interface LoginPayload {
  email: string;
  password: string;
}

interface ApiClientOptions {
  apiUrl: string;
}

export class ApiClient {
  private readonly apiUrl: string;

  constructor(
    private readonly request: APIRequestContext,
    options: ApiClientOptions
  ) {
    this.apiUrl = options.apiUrl.replace(/\/$/, '');
  }

  async login(payload: LoginPayload): Promise<AuthLoginResponse> {
    const response = await this.request.post(`${this.apiUrl}/auth/login`, {
      data: payload,
    });

    if (!response.ok()) {
      const message = await response.text();
      throw new Error(
        `Logowanie nie powiodło się (status ${response.status()}): ${message}`
      );
    }

    const json = (await response.json()) as AuthLoginResponse;
    return json;
  }

  async listCustomers(
    accessToken: string,
    search?: string,
    limit = 50
  ): Promise<CustomerDto[]> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (search) {
      params.append('search', search);
    }

    const url = `${this.apiUrl}/customers?${params.toString()}`;
    const response = await this.request.get(url, {
      headers: this.authHeaders(accessToken),
    });

    if (!response.ok()) {
      const message = await response.text();
      throw new Error(
        `Nie udało się pobrać listy kontrahentów (status ${response.status()}): ${message}`
      );
    }

    const json = (await response.json()) as ListCustomersResponse;
    return json.items ?? [];
  }

  async deleteCustomer(accessToken: string, customerId: string): Promise<void> {
    const response = await this.request.delete(
      `${this.apiUrl}/customers/${customerId}`,
      {
        headers: this.authHeaders(accessToken),
      }
    );

    if (!response.ok()) {
      const message = await response.text();
      throw new Error(
        `Nie udało się usunąć kontrahenta ${customerId} (status ${response.status()}): ${message}`
      );
    }
  }

  async removeCustomersByName(
    accessToken: string,
    customerName: string
  ): Promise<void> {
    const existing = await this.listCustomers(accessToken, customerName);
    const candidates = existing.filter(
      (customer) =>
        customer.name.trim().toLowerCase() === customerName.trim().toLowerCase()
    );

    if (!candidates.length) {
      return;
    }

    for (const customer of candidates) {
      await this.deleteCustomer(accessToken, customer.id);
    }
  }

  private authHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }
}

