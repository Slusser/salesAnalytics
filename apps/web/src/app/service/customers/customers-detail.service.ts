import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import type {
  CustomerDetailResponse,
  UpdateCustomerCommand
} from 'apps/shared/dtos/customers.dto'

@Injectable({ providedIn: 'root' })
export class CustomersDetailService {
  private readonly http = inject(HttpClient)

  getById(customerId: string): Observable<CustomerDetailResponse> {
    return this.http.get<CustomerDetailResponse>(`/api/customers/${customerId}`)
  }

  update(customerId: string, payload: UpdateCustomerCommand): Observable<CustomerDetailResponse> {
    return this.http.put<CustomerDetailResponse>(`/api/customers/${customerId}`, payload)
  }

  softDelete(customerId: string): Observable<CustomerDetailResponse> {
    return this.http.delete<CustomerDetailResponse>(`/api/customers/${customerId}`)
  }
}


