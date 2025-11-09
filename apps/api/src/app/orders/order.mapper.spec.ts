import { describe, it, expect, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';

import type { OrderDetailRow, OrderListRow } from './order.mapper';
import { OrderMapper } from './order.mapper';

const createOrderListRow = (
  overrides: Partial<OrderListRow> = {}
): OrderListRow => ({
  id: 'order-1',
  order_no: 'ORD-001',
  order_date: '2024-01-15',
  item_name: 'Produkt testowy',
  quantity: 5,
  is_eur: false,
  eur_rate: null,
  producer_discount_pct: 10,
  distributor_discount_pct: 5,
  vat_rate_pct: 23,
  total_net_pln: 1000,
  total_gross_pln: 1230,
  total_gross_eur: null,
  created_at: '2024-01-16T10:30:00.000Z',
  updated_at: '2024-01-17T12:00:00.000Z',
  deleted_at: null,
  customer_id: 'customer-1',
  created_by: 'user-1',
  ...overrides,
});

const createOrderDetailRow = (
  overrides: Partial<OrderDetailRow> = {}
): OrderDetailRow => ({
  ...createOrderListRow(),
  comment: 'Komentarz do zamówienia',
  currency_code: 'PLN',
  ...overrides,
});

describe('OrderMapper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mapuje rekord listy na DTO z zachowaniem wszystkich pól', () => {
    const row = createOrderListRow({
      is_eur: true,
      eur_rate: 4.39,
      total_gross_eur: 280.18,
    });

    const result = OrderMapper.toListDto(row);

    expect(result).toEqual({
      id: 'order-1',
      orderNo: 'ORD-001',
      customerId: 'customer-1',
      orderDate: '2024-01-15',
      itemName: 'Produkt testowy',
      quantity: 5,
      isEur: true,
      eurRate: 4.39,
      producerDiscountPct: 10,
      distributorDiscountPct: 5,
      vatRatePct: 23,
      totalNetPln: 1000,
      totalGrossPln: 1230,
      totalGrossEur: 280.18,
      createdBy: 'user-1',
      createdAt: '2024-01-16T10:30:00.000Z',
      updatedAt: '2024-01-17T12:00:00.000Z',
      deletedAt: null,
    });
  });

  it('loguje ostrzeżenie, gdy brakuje informacji o autorze rekordu', () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const row = createOrderListRow({ created_by: '' });

    const result = OrderMapper.toListDto(row);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `Rekord zamówienia ${row.id} nie zawiera danych o użytkowniku tworzącym.`
    );
    expect(result.createdBy).toBe('');
  });

  it('mapuje rekord szczegółowy, zachowując komentarz i kod waluty', () => {
    const row = createOrderDetailRow({
      comment: null,
      currency_code: 'EUR',
    });

    const result = OrderMapper.toDetailDto(row);

    expect(result).toEqual({
      id: 'order-1',
      orderNo: 'ORD-001',
      customerId: 'customer-1',
      orderDate: '2024-01-15',
      itemName: 'Produkt testowy',
      quantity: 5,
      isEur: false,
      eurRate: null,
      producerDiscountPct: 10,
      distributorDiscountPct: 5,
      vatRatePct: 23,
      totalNetPln: 1000,
      totalGrossPln: 1230,
      totalGrossEur: null,
      createdBy: 'user-1',
      createdAt: '2024-01-16T10:30:00.000Z',
      updatedAt: '2024-01-17T12:00:00.000Z',
      deletedAt: null,
      comment: null,
      currencyCode: 'EUR',
    });
  });
});


