import type { OrderResponse } from 'apps/shared/dtos/orders.dto';

export type CurrencyCode = 'PLN' | 'EUR';

export interface OrderFormModel {
  orderNo: string;
  customerId: string;
  orderDate: string;
  itemName: string;
  quantity: number;
  currencyCode: CurrencyCode;
  eurRate?: number;
  producerDiscountPct: number;
  distributorDiscountPct: number;
  vatRatePct: number;
  totalNetPln: number;
  totalGrossPln: number;
  totalGrossEur?: number;
  comment?: string;
  isEur: boolean;
}

export interface OrderFormServerErrors {
  generalError?: string;
  fieldErrors?: Partial<Record<keyof OrderFormModel, string>>;
  conflictOrderNo?: string;
}

export interface OrderCalculationInput {
  net: number;
  producerDiscountPct: number;
  distributorDiscountPct: number;
  vatRatePct: number;
  currency: CurrencyCode;
  eurRate?: number;
}

export interface OrderCalculationResult {
  netAfterProducer: number;
  netAfterDistributor: number;
  vatAmount: number;
  grossPln: number;
  grossEur?: number;
  differencePln: number;
  differenceEur?: number;
  withinTolerance: boolean;
}

export interface FxRateState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  rate?: number;
  sourceDate?: string;
  message?: string;
  manualOverride: boolean;
}

export interface FxRateOverride {
  enabled: boolean;
  rate?: number;
}

export interface ImportValidationIssue {
  type: 'format' | 'required' | 'range' | 'duplicate' | 'unknown';
  message: string;
  location?: { row: number; column?: string };
}

export interface ImportMappingOption {
  field: keyof OrderFormModel;
  column?: string;
  required: boolean;
}

export interface ImportXlsxPreview {
  rawRow: Record<string, string | number | Date>;
  parsedModel: Partial<OrderFormModel>;
}

export interface ImportPanelState {
  status: 'idle' | 'parsing' | 'mapped' | 'error';
  fileName?: string;
  size?: number;
  mapping: ImportMappingOption[];
  preview?: ImportXlsxPreview;
  issues: ImportValidationIssue[];
}

export interface OrdersNewPageState {
  formModel: OrderFormModel;
  calculation: OrderCalculationResult | null;
  formDirty: boolean;
  submitting: boolean;
  serverErrors: OrderFormServerErrors | null;
  fxRate: FxRateState;
  importState: ImportPanelState;
  lastResponse?: OrderResponse;
}
