import { describe, expect, it } from 'vitest';

import type { OrderCalculationInput } from '../../pages/orders/new/orders-new.types';
import {
  computeOrderTotals,
  isWithinTolerance,
} from './order-calculation.util';

const PLN_INPUT: OrderCalculationInput = {
  net: 1000,
  producerDiscountPct: 10,
  distributorDiscountPct: 5,
  vatRatePct: 23,
  currency: 'PLN',
};

describe('computeOrderTotals', () => {
  it('powinno poprawnie obliczać wartości dla waluty PLN', () => {
    const result = computeOrderTotals(PLN_INPUT);

    expect(result.netAfterProducer).toBeCloseTo(900);
    expect(result.netAfterDistributor).toBeCloseTo(855);
    expect(result.vatAmount).toBeCloseTo(196.65);
    expect(result.grossPln).toBeCloseTo(1051.65);
    expect(result.grossEur).toBeUndefined();
    expect(result.withinTolerance).toBe(true);
  });

  it('powinno uwzględniać kurs EUR przy walucie EUR', () => {
    const input: OrderCalculationInput = {
      ...PLN_INPUT,
      currency: 'EUR',
      eurRate: 4.5,
    };

    const result = computeOrderTotals(input);

    expect(result.grossEur).toBeCloseTo(result.grossPln / 4.5);
    expect(result.withinTolerance).toBe(true);
  });

  it('powinno ograniczać procenty do zakresu 0-100', () => {
    const input: OrderCalculationInput = {
      net: 100,
      producerDiscountPct: 150,
      distributorDiscountPct: -20,
      vatRatePct: 200,
      currency: 'PLN',
    };

    const result = computeOrderTotals(input);

    expect(result.netAfterProducer).toBeCloseTo(0);
    expect(result.netAfterDistributor).toBeCloseTo(0);
    expect(result.vatAmount).toBeCloseTo(0);
    expect(result.grossPln).toBeCloseTo(0);
  });
});

describe('isWithinTolerance', () => {
  it('powinno zwracać true jeśli wartości mieszczą się w tolerancji', () => {
    expect(isWithinTolerance(100, 100.005)).toBe(true);
    expect(isWithinTolerance(100, 100.01)).toBe(true);
  });

  it('powinno zwracać false jeśli wartości przekraczają tolerancję', () => {
    expect(isWithinTolerance(100, 100.02)).toBe(false);
  });
});
