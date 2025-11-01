export const ORDERS_DEFAULT_PAGE = 1;
export const ORDERS_DEFAULT_LIMIT = 25;
export const ORDERS_LIMIT_OPTIONS = [25, 50, 100] as const;
export const ORDERS_MAX_ORDER_NO_LENGTH = 64;

export const ORDERS_ALLOWED_SORT_FIELDS = [
  'orderDate',
  'orderNo',
  'customerName',
  'totalNetPln',
  'createdAt',
] as const;

export type OrdersSortField = (typeof ORDERS_ALLOWED_SORT_FIELDS)[number];
export type OrdersSortDirection = 'asc' | 'desc';

export interface OrdersSortState {
  field: OrdersSortField;
  direction: OrdersSortDirection;
}

export interface OrdersQueryParamsVm {
  page: number;
  limit: number;
  sort: OrdersSortState;
  orderNo?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted?: boolean;
}

export interface OrdersFilterFormState {
  orderNo?: string;
  customerId?: string;
  dateRange?: [string, string];
}

export interface OrdersListVm {
  items: OrderRowVm[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderRowVm {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  totalNetPln: number;
  totalGrossPln: number;
  currencyCode: string;
  currencyLabel: string;
  netFormatted: string;
  grossFormatted: string;
  producerDiscountPct: number;
  distributorDiscountPct: number;
  totalGrossEur: number | null;
  vatRatePct: number;
  createdAt: string;
  createdByName?: string;
  deleted: boolean;
  rowDisabled: boolean;
}

export interface OrdersRolePermissionsVm {
  canMutate: boolean;
  canIncludeDeleted: boolean;
}

export type OrdersActionEvent =
  | { type: 'edit'; order: OrderRowVm }
  | { type: 'soft-delete'; order: OrderRowVm }
  | { type: 'restore'; order: OrderRowVm }
  | { type: 'view'; order: OrderRowVm };

export interface OrdersExportPayload {
  params: OrdersQueryParamsVm;
  timestamp: string;
}
