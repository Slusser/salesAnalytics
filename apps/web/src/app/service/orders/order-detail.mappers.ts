import type {
  OrderAuditEntryDto,
  OrderDetailDto,
} from '@shared/dtos/orders.dto';

import type {
  ConfirmDialogStateVm,
  OrderActionsStateVm,
  OrderAuditEntryVm,
  OrderAuditVm,
  OrderDetailVm,
  OrderFormValidationVm,
  OrderFormValue,
  OrderMetadataVm,
  OrderRolePermissionsVm,
} from './order-detail.types';

export function mapOrderDetailDtoToFormValue(
  dto: OrderDetailDto,
): OrderFormValue {
  return {
    orderNo: dto.orderNo,
    customerId: dto.customerId,
    orderDate: dto.orderDate,
    itemName: dto.itemName,
    quantity: dto.quantity,
    catalogUnitGrossPln: dto.catalogUnitGrossPln,
    producerDiscountPct: dto.producerDiscountPct,
    distributorDiscountPct: dto.distributorDiscountPct,
    vatRatePct: dto.vatRatePct,
    totalNetPln: dto.totalNetPln,
    totalGrossPln: dto.totalGrossPln,
    distributorPricePln: dto.distributorPricePln,
    customerPricePln: dto.customerPricePln,
    profitPln: dto.profitPln,
    comment: dto.comment ?? null,
  };
}

export function mapOrderDetailDtoToMetadata(
  dto: OrderDetailDto,
  options: { customerName?: string | null; createdByName?: string | null } = {},
): OrderMetadataVm {
  return {
    id: dto.id,
    orderNo: dto.orderNo,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    deletedAt: dto.deletedAt,
    createdByName: options.createdByName ?? null,
    customerName: options.customerName ?? dto.customerId,
  };
}

export function createDefaultFormValidation(): OrderFormValidationVm {
  return {
    toleranceExceeded: false,
    invalidCustomer: false,
  };
}

export function createInitialActionsState(): OrderActionsStateVm {
  return {
    submitting: false,
    canSubmit: false,
    canReset: false,
    disableDelete: true,
    disableRestore: true,
    showRestore: false,
    showDelete: false,
  };
}

export function createInitialConfirmDialog(): ConfirmDialogStateVm {
  return {
    visible: false,
    mode: 'delete',
    message: '',
    confirmLabel: 'Potwierdź',
    loading: false,
  };
}

export function mapAuditEntryDtoToVm(
  dto: OrderAuditEntryDto,
): OrderAuditEntryVm {
  const operation = normalizeAuditOperation(dto.operation);

  return {
    id: dto.id,
    occurredAt: dto.occurredAt,
    operation,
    userName: dto.changedBy?.displayName ?? null,
    diffSummary: buildDiffSummary(operation),
    oldValue: dto.oldValue,
    newValue: dto.newValue,
  };
}

function normalizeAuditOperation(
  operation: string,
): OrderAuditEntryVm['operation'] {
  if (operation === 'create' || operation === 'update' || operation === 'delete' || operation === 'restore') {
    return operation;
  }

  return 'update';
}

function buildDiffSummary(operation: OrderAuditEntryVm['operation']): string {
  switch (operation) {
    case 'create':
      return 'Utworzono zamówienie';
    case 'delete':
      return 'Usunięto (soft delete) zamówienie';
    case 'restore':
      return 'Przywrócono zamówienie';
    default:
      return 'Zaktualizowano zamówienie';
  }
}

export function createOrderDetailVm(
  dto: OrderDetailDto,
  permissions: OrderRolePermissionsVm,
  audit: OrderAuditVm | null = null,
): OrderDetailVm {
  const isDeleted = Boolean(dto.deletedAt);

  const actions: OrderActionsStateVm = {
    ...createInitialActionsState(),
    showDelete: permissions.canDelete,
    showRestore: permissions.canRestore,
    disableDelete: !permissions.canDelete || isDeleted,
    disableRestore: !permissions.canRestore || !isDeleted,
    canReset: permissions.canEdit,
    canSubmit: permissions.canEdit,
  };

  const metadata = mapOrderDetailDtoToMetadata(dto);

  return {
    order: dto,
    metadata,
    actions,
    audit,
    isDeleted,
  };
}

