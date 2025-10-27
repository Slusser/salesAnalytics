import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import type {
  CreateOrderCommand,
  OrderResponse,
} from '@shared/dtos/orders.dto';

export type CreateOrderPayload = CreateOrderCommand;

export interface OrdersCreateErrorResponse {
  code?: string;
  message?: string;
  details?: Array<
    { field?: keyof CreateOrderCommand; message: string } | string
  >;
}

export interface OrdersCreateError extends Error {
  status?: number;
  response?: OrdersCreateErrorResponse;
}

@Injectable({ providedIn: 'root' })
export class OrdersCreateService {
  private readonly http = inject(HttpClient);

  create(payload: CreateOrderPayload): Observable<OrderResponse> {
    return this.http.post<OrderResponse>('/api/orders', payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const mapped = this.mapError(error);
        return throwError(() => mapped);
      })
    );
  }

  private mapError(error: HttpErrorResponse): OrdersCreateError {
    const mapped: OrdersCreateError = new Error(
      'Nie udało się utworzyć zamówienia.'
    );
    mapped.status = error.status;

    if (error.error && typeof error.error === 'object') {
      mapped.response = error.error as OrdersCreateErrorResponse;
    }

    return mapped;
  }
}
