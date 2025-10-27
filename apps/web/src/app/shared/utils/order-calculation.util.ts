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

  const eurRate =
    input.currency === 'EUR' ? normalizeNumber(input.eurRate ?? 0) : 0;
  const grossEur =
    input.currency === 'EUR' && eurRate > 0
      ? roundCurrency(grossPln / eurRate)
      : undefined;

  const differencePln = roundCurrency(grossPln - net);
  const differenceEur =
    grossEur != null
      ? roundCurrency(grossEur - net / (eurRate || 1))
      : undefined;

  const withinTolerance =
    Math.abs(differencePln) <= TOLERANCE &&
    (differenceEur == null || Math.abs(differenceEur) <= TOLERANCE);

  return {
    netAfterProducer,
    netAfterDistributor,
    vatAmount,
    grossPln,
    grossEur,
    differencePln,
    differenceEur,
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
