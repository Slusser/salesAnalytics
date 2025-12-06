import type {
  OrderCalculationInput,
  OrderCalculationResult,
} from '../../pages/orders/new/orders-new.types';

const TOLERANCE = 0.01;

export function computeOrderTotals(
  input: OrderCalculationInput
): OrderCalculationResult {
  const net = normalizeNumber(input.net);
  const producerDiscount = clampPercentage(input.producerDiscountPct);
  const distributorDiscount = clampPercentage(input.distributorDiscountPct);
  const vatRate = clampPercentage(input.vatRatePct);

  const netAfterProducer = roundCurrency(net * (1 - producerDiscount / 100));
  const netAfterDistributor = roundCurrency(
    netAfterProducer * (1 - distributorDiscount / 100)
  );
  const vatAmount = roundCurrency(netAfterDistributor * (vatRate / 100));
  const grossPln = roundCurrency(netAfterDistributor + vatAmount);

  const differencePln = roundCurrency(grossPln - net);

  const withinTolerance = Math.abs(differencePln) <= TOLERANCE;

  return {
    netAfterProducer,
    netAfterDistributor,
    vatAmount,
    grossPln,
    differencePln,
    withinTolerance,
  };
}

export function isWithinTolerance(expected: number, actual: number): boolean {
  return Math.abs(roundCurrency(actual) - roundCurrency(expected)) <= TOLERANCE;
}

function clampPercentage(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function normalizeNumber(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
