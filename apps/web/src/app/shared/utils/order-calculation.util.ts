import type {
  OrderCalculationInput,
  OrderCalculationResult,
} from '../../pages/orders/new/orders-new.types';

export function computeOrderTotals(
  input: OrderCalculationInput
): OrderCalculationResult {
  const unitGross = normalizeNumber(input.catalogUnitGrossPln);
  const quantity = Math.max(0, normalizeNumber(input.quantity));
  const producerDiscount = clampPercentage(input.producerDiscountPct);
  const distributorDiscount = clampPercentage(input.distributorDiscountPct);
  const vatRate = clampPercentage(input.vatRatePct);

  const totalGrossPln = roundCurrency(unitGross * quantity);
  const vatMultiplier = 1 + vatRate / 100;
  const totalNetPln =
    vatMultiplier <= 0 ? totalGrossPln : roundCurrency(totalGrossPln / vatMultiplier);
  const vatAmount = roundCurrency(totalGrossPln - totalNetPln);

  const distributorPricePln = roundCurrency(
    totalNetPln * (1 - distributorDiscount / 100)
  );
  const customerPricePln = roundCurrency(
    totalNetPln * (1 - producerDiscount / 100)
  );
  const profitPln = roundCurrency(distributorPricePln - customerPricePln);

  return {
    totalGrossPln,
    totalNetPln,
    distributorPricePln,
    customerPricePln,
    profitPln,
    vatAmount,
  };
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
