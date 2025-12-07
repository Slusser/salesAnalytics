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
  catalog_unit_gross_pln: 246,
  producer_discount_pct: 10,
  distributor_discount_pct: 5,
  vat_rate_pct: 23,
  total_net_pln: 1000,
  total_gross_pln: 1230,
  distributor_price_pln: 950,
  customer_price_pln: 900,
  profit_pln: 50,
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
  ...overrides,
});

describe('OrderMapper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mapuje rekord listy na DTO z zachowaniem wszystkich pól', () => {
    const row = createOrderListRow();

    const result = OrderMapper.toListDto(row);

    expect(result).toEqual({
      id: 'order-1',
      orderNo: 'ORD-001',
      customerId: 'customer-1',
      orderDate: '2024-01-15',
      itemName: 'Produkt testowy',
      quantity: 5,
      catalogUnitGrossPln: 246,
      producerDiscountPct: 10,
      distributorDiscountPct: 5,
      vatRatePct: 23,
      totalNetPln: 1000,
      totalGrossPln: 1230,
      distributorPricePln: 950,
      customerPricePln: 900,
      profitPln: 50,
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

  it('mapuje rekord szczegółowy, zachowując komentarz', () => {
    const row = createOrderDetailRow({
      comment: null,
    });

    const result = OrderMapper.toDetailDto(row);

    expect(result).toEqual({
      id: 'order-1',
      orderNo: 'ORD-001',
      customerId: 'customer-1',
      orderDate: '2024-01-15',
      itemName: 'Produkt testowy',
      quantity: 5,
      catalogUnitGrossPln: 246,
      producerDiscountPct: 10,
      distributorDiscountPct: 5,
      vatRatePct: 23,
      totalNetPln: 1000,
      totalGrossPln: 1230,
      distributorPricePln: 950,
      customerPricePln: 900,
      profitPln: 50,
      createdBy: 'user-1',
      createdAt: '2024-01-16T10:30:00.000Z',
      updatedAt: '2024-01-17T12:00:00.000Z',
      deletedAt: null,
      comment: null,
    });
  });
});


