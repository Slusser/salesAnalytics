import type { OrderResponse } from '@shared/dtos/orders.dto';

export interface OrderFormModel {
  orderNo: string;
  customerId: string;
  orderDate: string;
  itemName: string;
  quantity: number;
  catalogUnitGrossPln: number;
  producerDiscountPct: number;
  distributorDiscountPct: number;
  vatRatePct: number;
  totalNetPln: number;
  totalGrossPln: number;
  distributorPricePln: number;
  customerPricePln: number;
  profitPln: number;
  comment?: string;
}

export interface OrderFormServerErrors {
  generalError?: string;
  fieldErrors?: Partial<Record<keyof OrderFormModel, string>>;
  conflictOrderNo?: string;
}

export interface OrderCalculationInput {
  catalogUnitGrossPln: number;
  quantity: number;
  vatRatePct: number;
  producerDiscountPct: number;
  distributorDiscountPct: number;
}

export interface OrderCalculationResult {
  totalGrossPln: number;
  totalNetPln: number;
  distributorPricePln: number;
  customerPricePln: number;
  profitPln: number;
  vatAmount: number;
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
  importState: ImportPanelState;
  lastResponse?: OrderResponse;
}
