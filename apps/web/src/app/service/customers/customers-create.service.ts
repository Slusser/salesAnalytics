import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { CustomerDto } from 'apps/shared/dtos/customers.dto';

export interface CreateCustomerRequest {
  name: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomersCreateService {
  private readonly http = inject(HttpClient);

  createCustomer(payload: CreateCustomerRequest): Observable<CustomerDto> {
    return this.http.post<CustomerDto>('/api/customers', payload);
  }
}
