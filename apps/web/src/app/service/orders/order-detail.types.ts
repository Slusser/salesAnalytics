import type { FormControl, FormGroup } from '@angular/forms';

import type {
  OrderDetailDto,
  OrderResponse,
  UpdateOrderCommand,
} from '@shared/dtos/orders.dto';

export type OrderDetailStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'error'
  | 'forbidden'
  | 'not-found';

export interface OrderMetadataVm {
  id: string;
  orderNo: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdByName?: string | null;
  customerName: string;
  currencyCode: 'PLN' | 'EUR';
}

export interface OrderRolePermissionsVm {
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canViewAudit: boolean;
}

export interface OrderFormValue {
  orderNo: string;
  customerId: string;
  orderDate: string;
  itemName: string;
  quantity: number;
  isEur: boolean;
  eurRate?: number | null;
  producerDiscountPct: number;
  distributorDiscountPct: number;
  vatRatePct: number;
  totalNetPln: number;
  totalGrossPln: number;
  totalGrossEur?: number | null;
  comment?: string | null;
}

export interface OrderFormControls {
  orderNo: FormControl<string>;
  customerId: FormControl<string>;
  orderDate: FormControl<string>;
  itemName: FormControl<string>;
  quantity: FormControl<number>;
  isEur: FormControl<boolean>;
  eurRate: FormControl<number | null>;
  producerDiscountPct: FormControl<number>;
  distributorDiscountPct: FormControl<number>;
  vatRatePct: FormControl<number>;
  totalNetPln: FormControl<number>;
  totalGrossPln: FormControl<number>;
  totalGrossEur: FormControl<number | null>;
  comment: FormControl<string | null>;
}

export interface OrderFormValidationVm {
  toleranceExceeded: boolean;
  eurRateMissing: boolean;
  invalidCustomer: boolean;
}

export interface OrderFormVm {
  form: FormGroup<OrderFormControls> | null;
  value: OrderFormValue;
  dirty: boolean;
  valid: boolean;
  errors: string[];
  disabled: boolean;
  validation: OrderFormValidationVm;
}

export interface OrderActionsStateVm {
  submitting: boolean;
  canSubmit: boolean;
  canReset: boolean;
  disableDelete: boolean;
  disableRestore: boolean;
  showRestore: boolean;
  showDelete: boolean;
}

export interface OrderAuditEntryVm {
  id: number;
  occurredAt: string;
  operation: 'create' | 'update' | 'delete' | 'restore';
  userName?: string | null;
  diffSummary: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

export interface OrderAuditVm {
  entries: OrderAuditEntryVm[];
  total: number;
  nextCursor?: string | null;
}

export interface OrderMutationResultVm {
  success: boolean;
  mode: 'update' | 'delete' | 'restore';
  errorCode?: string;
  message?: string;
}

export interface ConfirmDialogStateVm {
  visible: boolean;
  mode: 'delete' | 'restore';
  message: string;
  confirmLabel: string;
  loading: boolean;
}

export interface FxRateBannerVm {
  visible: boolean;
  severity: 'info' | 'warning';
  rate?: number;
  rateDate?: string;
  manualOverride: boolean;
  disableRefresh: boolean;
}

export interface OrderDetailVm {
  order: OrderDetailDto;
  metadata: OrderMetadataVm;
  actions: OrderActionsStateVm;
  audit: OrderAuditVm | null;
  isDeleted: boolean;
}

export interface CustomerOptionVm {
  value: string;
  label: string;
  disabled: boolean;
}

export type OrderMutationPayload = UpdateOrderCommand;

export interface OrderDetailDataSnapshot {
  dto: OrderDetailDto;
  response: OrderResponse;
}

