import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';

import type {
  CreateOrderCommand,
  OrderResponse,
} from '@shared/dtos/orders.dto';

import {
  OrdersCreateService,
  type OrdersCreateError,
} from './orders-create.service';

describe('OrdersCreateService', () => {
  let service: OrdersCreateService;
  let httpMock: HttpTestingController;

  const buildPayload = (
    overrides: Partial<CreateOrderCommand> = {}
  ): CreateOrderCommand => ({
    orderNo: 'ORD-123',
    customerId: 'customer-1',
    orderDate: '2024-05-01',
    itemName: 'Produkt testowy',
    quantity: 10,
    isEur: false,
    producerDiscountPct: 5,
    distributorDiscountPct: 3,
    vatRatePct: 23,
    totalNetPln: 1000,
    totalGrossPln: 1230,
    ...overrides,
  });

  const buildResponse = (
    overrides: Partial<OrderResponse> = {}
  ): OrderResponse => ({
    id: 'order-id',
    orderNo: 'ORD-123',
    customerId: 'customer-1',
    orderDate: '2024-05-01',
    itemName: 'Produkt testowy',
    quantity: 10,
    isEur: false,
    eurRate: null,
    producerDiscountPct: 5,
    distributorDiscountPct: 3,
    vatRatePct: 23,
    totalNetPln: 1000,
    totalGrossPln: 1230,
    totalGrossEur: null,
    comment: null,
    createdAt: '2024-05-01T10:00:00.000Z',
    updatedAt: '2024-05-01T10:00:00.000Z',
    deletedAt: null,
    createdBy: 'user-1',
    currencyCode: 'PLN',
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrdersCreateService],
    });

    service = TestBed.inject(OrdersCreateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('wysyła żądanie POST i zwraca utworzone zamówienie', async () => {
    const payload = buildPayload();
    const expectedResponse = buildResponse();

    const resultPromise = firstValueFrom(service.create(payload));

    const request = httpMock.expectOne('/api/orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);

    request.flush(expectedResponse);

    await expect(resultPromise).resolves.toEqual(expectedResponse);
  });

  it('mapuje odpowiedź błędu API na OrdersCreateError z treścią odpowiedzi', async () => {
    const payload = buildPayload();
    const errorResponse = {
      code: 'VALIDATION_ERROR',
      message: 'Nieprawidłowe dane zamówienia',
      details: [{ field: 'orderNo', message: 'Numer zamówienia jest wymagany.' }],
    };

    const resultPromise = firstValueFrom(service.create(payload));

    const request = httpMock.expectOne('/api/orders');
    request.flush(errorResponse, {
      status: 422,
      statusText: 'Unprocessable Entity',
    });

    await expect(resultPromise).rejects.toMatchObject({
      message: 'Nie udało się utworzyć zamówienia.',
      status: 422,
      response: errorResponse,
    } as Partial<OrdersCreateError>);
  });

  it('ustawia status błędu i pomija response gdy backend zwraca prymityw', async () => {
    const payload = buildPayload();
    const create$ = service.create(payload);
    const resultPromise = firstValueFrom(create$);

    const request = httpMock.expectOne('/api/orders');
    request.flush('Błąd serwera', {
      status: 500,
      statusText: 'Server Error',
    });

    try {
      await resultPromise;
      throw new Error('Oczekiwano rzucenia błędu.');
    } catch (error) {
      const mapped = error as OrdersCreateError;
      expect(mapped).toBeInstanceOf(Error);
      expect(mapped.message).toBe('Nie udało się utworzyć zamówienia.');
      expect(mapped.status).toBe(500);
      expect(mapped.response).toBeUndefined();
    }
  });
});

