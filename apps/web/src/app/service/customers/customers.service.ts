import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import type {
  CustomerDto,
  ListCustomersQuery,
  ListCustomersResponse,
} from '@shared/dtos/customers.dto';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);

  get(query: ListCustomersQuery = {}): Observable<CustomerDto[]> {
    const httpParams = new HttpParams({
      fromObject: this.toHttpParams(query),
    });

    return this.http
      .get<ListCustomersResponse>('/api/customers', { params: httpParams })
      .pipe(map((response) => response.items ?? []));
  }

  private toHttpParams(query: ListCustomersQuery): Record<string, string> {
    const params: Record<string, string> = {};

    if (query.page !== undefined) {
      params['page'] = String(query.page);
    }

    if (query.limit !== undefined) {
      params['limit'] = String(query.limit);
    }

    if (query.search) {
      params['search'] = query.search;
    }

    if (query.includeInactive) {
      params['includeInactive'] = 'true';
    }

    return params;
  }
}


