import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, type Signal } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import {
  EMPTY,
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  tap,
} from 'rxjs';

import type {
  OrderAuditEntryDto,
  OrderAuditResponse,
  OrderDetailDto,
  OrderResponse,
  RestoreOrderCommand,
  UpdateOrderCommand,
} from '@shared/dtos/orders.dto';
import type { AppRole } from '@shared/dtos/user-roles.dto';

import { AuthSessionService } from '../auth/auth-session.service';

import {
  createDefaultFormValidation,
  createInitialActionsState,
  createInitialConfirmDialog,
  mapAuditEntryDtoToVm,
  mapOrderDetailDtoToFormValue,
  mapOrderDetailDtoToMetadata,
} from './order-detail.mappers';
import type {
  ConfirmDialogStateVm,
  OrderActionsStateVm,
  OrderAuditVm,
  OrderDetailStatus,
  OrderDetailVm,
  OrderFormValidationVm,
  OrderFormVm,
  OrderFormValue,
  OrderMutationResultVm,
  OrderFormControls,
  OrderRolePermissionsVm,
} from './order-detail.types';

interface AuditPanelState {
  data: OrderAuditVm | null;
  loading: boolean;
  error: string | null;
  visible: boolean;
  nextCursor?: string | null;
}

const EMPTY_FORM_VALUE: OrderFormValue = {
  orderNo: '',
  customerId: '',
  orderDate: '',
  itemName: '',
  quantity: 1,
  isEur: false,
  eurRate: null,
  producerDiscountPct: 0,
  distributorDiscountPct: 0,
  vatRatePct: 23,
  totalNetPln: 0,
  totalGrossPln: 0,
  totalGrossEur: null,
  comment: null,
};

const EMPTY_PERMISSIONS: OrderRolePermissionsVm = {
  canEdit: false,
  canDelete: false,
  canRestore: false,
  canViewAudit: false,
};

const INITIAL_AUDIT_STATE: AuditPanelState = {
  data: null,
  loading: false,
  error: null,
  visible: false,
  nextCursor: null,
};

@Injectable()
export class OrderDetailStore {
  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  private readonly notification = inject(NzNotificationService);
  private readonly session = inject(AuthSessionService);

  private readonly statusSignal = signal<OrderDetailStatus>('idle');
  private readonly errorSignal = signal<string | null>(null);
  private readonly orderDtoSignal = signal<OrderDetailDto | null>(null);
  private readonly permissionsSignal = signal<OrderRolePermissionsVm>(
    EMPTY_PERMISSIONS,
  );
  private readonly initialFormValueSignal = signal<OrderFormValue>({
    ...EMPTY_FORM_VALUE,
  });
  private readonly formStateSignal = signal<OrderFormVm>({
    form: null,
    value: { ...EMPTY_FORM_VALUE },
    dirty: false,
    valid: false,
    errors: [] as string[],
    disabled: true,
    validation: createDefaultFormValidation(),
  });
  private readonly metadataExtrasSignal = signal<{
    customerName?: string | null;
    createdByName?: string | null;
  }>({});
  private readonly auditStateSignal = signal<AuditPanelState>({
    ...INITIAL_AUDIT_STATE,
  });
  private readonly confirmDialogSignal = signal<ConfirmDialogStateVm>(
    createInitialConfirmDialog(),
  );
  private readonly mutationResultSignal = signal<OrderMutationResultVm | null>(
    null,
  );
  private readonly mutationModeSignal = signal<'delete' | 'restore' | null>(
    null,
  );
  private readonly orderIdSignal = signal<string | null>(null);

  readonly status = computed(() => this.statusSignal());
  readonly error = computed(() => this.errorSignal());
  readonly permissions = computed(() => this.permissionsSignal());
  readonly formState = computed(() => this.formStateSignal());
  readonly confirmDialog = computed(() => this.confirmDialogSignal());
  readonly mutationResult = computed(() => this.mutationResultSignal());
  readonly auditState = computed(() => this.auditStateSignal());
  readonly orderId = computed(() => this.orderIdSignal());

  readonly orderDetail: Signal<OrderDetailVm | null> = computed(() => {
    const dto = this.orderDtoSignal();
    if (!dto) {
      return null;
    }

    const metadata = mapOrderDetailDtoToMetadata(
      dto,
      this.metadataExtrasSignal(),
    );
    const audit = this.auditStateSignal().data;
    const actions = this.computeActionsState(dto);

    return {
      order: dto,
      metadata,
      actions,
      audit,
      isDeleted: Boolean(dto.deletedAt),
    };
  });

  readonly navigationBlocked = computed(() =>
    this.shouldBlockNavigation(),
  );

  constructor() {
    effect(
      () => {
        const roles = this.session.user()?.roles ?? ([] as AppRole[]);
        this.permissionsSignal.set(this.computePermissions(roles));
        this.reconcileFormDisabledState();
      },
      { allowSignalWrites: true },
    );
  }

  load(orderId: string | null | undefined): void {
    if (!orderId) {
      this.statusSignal.set('error');
      this.errorSignal.set('Nieprawidłowy identyfikator zamówienia.');
      return;
    }

    if (this.orderIdSignal() === orderId && this.orderDtoSignal()) {
      return;
    }

    this.orderIdSignal.set(orderId);
    this.statusSignal.set('loading');
    this.errorSignal.set(null);

    this.fetchOrder(orderId);
  }

  refresh(): void {
    const orderId = this.orderIdSignal();
    if (!orderId) {
      return;
    }

    this.statusSignal.set('loading');
    this.fetchOrder(orderId);
  }

  updateFormValue(
    partial: Partial<OrderFormValue>,
    options: { markDirty?: boolean } = {},
  ): void {
    const shouldMarkDirty = options.markDirty ?? true;

    this.formStateSignal.update((current) => {
      const nextValue = { ...current.value, ...partial };
      return {
        ...current,
        value: nextValue,
        dirty: shouldMarkDirty ? true : current.dirty,
      };
    });
  }

  setFormValidity(
    valid: boolean,
    errors: string[],
    validation?: Partial<OrderFormValidationVm>,
  ): void {
    this.formStateSignal.update((current) => ({
      ...current,
      valid,
      errors: [...errors],
      validation: {
        ...current.validation,
        ...(validation ?? {}),
      },
    }));
  }

  markFormDirty(dirty: boolean): void {
    this.formStateSignal.update((current) => ({
      ...current,
      dirty,
    }));
  }

  setFormDisabled(disabled: boolean): void {
    const snapshot = this.formStateSignal();
    if (snapshot.disabled === disabled) {
      return;
    }

    this.formStateSignal.update((current) => ({
      ...current,
      disabled,
    }));

    if (snapshot.form) {
      if (disabled) {
        snapshot.form.disable({ emitEvent: false });
      } else {
        snapshot.form.enable({ emitEvent: false });
      }
    }
  }

  registerForm(form: FormGroup<OrderFormControls>): void {
    this.formStateSignal.update((current) => ({
      ...current,
      form,
    }));
    this.reconcileFormDisabledState();
  }

  resetForm(): void {
    const initialValue = this.initialFormValueSignal();
    const snapshot = this.formStateSignal();

    snapshot.form?.reset(initialValue, { emitEvent: false });

    this.formStateSignal.update((current) => ({
      ...current,
      value: { ...initialValue },
      dirty: false,
      valid: snapshot.form?.valid ?? false,
      errors: [],
      validation: createDefaultFormValidation(),
    }));
  }

  toggleAuditVisibility(): void {
    this.auditStateSignal.update((current) => ({
      ...current,
      visible: !current.visible,
    }));

    const state = this.auditStateSignal();
    if (state.visible && !state.data) {
      void this.loadAudit();
    }
  }

  async loadAudit(): Promise<void> {
    const orderId = this.orderIdSignal();
    if (!orderId || !this.permissionsSignal().canViewAudit) {
      return;
    }

    this.auditStateSignal.update((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const response = await firstValueFrom(this.requestAudit(orderId));
      if (!response) {
        return;
      }

      const auditVm = this.mapAuditResponse(response);
      this.auditStateSignal.set({
        data: auditVm,
        loading: false,
        error: null,
        visible: true,
        nextCursor: auditVm.nextCursor ?? null,
      });
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Nie udało się pobrać audytu.';
      this.auditStateSignal.set({
        ...INITIAL_AUDIT_STATE,
        visible: true,
        loading: false,
        error: message,
      });
      this.message.error(message);
    }
  }

  submit(): void {
    const orderId = this.orderIdSignal();
    const dto = this.orderDtoSignal();
    const form = this.formStateSignal();
    const permissions = this.permissionsSignal();

    if (!orderId || !dto) {
      return;
    }

    if (!permissions.canEdit) {
      this.message.warning('Brak uprawnień do edycji zamówienia.');
      return;
    }

    if (dto.deletedAt) {
      this.message.warning('Przywróć zamówienie, aby móc je edytować.');
      return;
    }

    if (!form.valid) {
      this.message.error('Formularz zawiera błędy. Popraw dane przed zapisem.');
      return;
    }

    this.statusSignal.set('saving');

    const payload = this.toUpdatePayload(form.value, dto);

    this.mutationResultSignal.set(null);

    this.requestUpdate(orderId, payload)
      .pipe(
        tap((response) => {
          this.applyOrderResponse(response);
          this.statusSignal.set('idle');
          this.message.success('Zamówienie zapisane.');
          this.mutationResultSignal.set({ success: true });
        }),
        catchError((error) => {
          this.handleSubmitError(error);
          return EMPTY;
        }),
        finalize(() => {
          if (this.statusSignal() === 'saving') {
            this.statusSignal.set('idle');
          }
        }),
      )
      .subscribe();
  }

  openDeleteDialog(): void {
    const dto = this.orderDtoSignal();
    const permissions = this.permissionsSignal();

    if (!dto || !permissions.canDelete || this.statusSignal() === 'saving') {
      return;
    }

    this.confirmDialogSignal.set({
      visible: true,
      mode: 'delete',
      message: `Czy na pewno chcesz oznaczyć zamówienie "${dto.orderNo}" jako usunięte?`,
      confirmLabel: 'Usuń zamówienie',
      loading: false,
    });
    this.mutationModeSignal.set('delete');
  }

  openRestoreDialog(): void {
    const dto = this.orderDtoSignal();
    const permissions = this.permissionsSignal();

    if (!dto || !permissions.canRestore || this.statusSignal() === 'saving') {
      return;
    }

    this.confirmDialogSignal.set({
      visible: true,
      mode: 'restore',
      message: `Czy na pewno chcesz przywrócić zamówienie "${dto.orderNo}"?`,
      confirmLabel: 'Przywróć zamówienie',
      loading: false,
    });
    this.mutationModeSignal.set('restore');
  }

  confirmMutation(): void {
    const mode = this.mutationModeSignal();
    const orderId = this.orderIdSignal();

    if (!mode || !orderId) {
      this.cancelDialog();
      return;
    }

    this.confirmDialogSignal.update((current) => ({
      ...current,
      loading: true,
    }));

    const request$ =
      mode === 'delete'
        ? this.requestDelete(orderId)
        : this.requestRestore(orderId);

    request$
      .pipe(
        tap((response) => {
          if (response) {
            this.applyOrderResponse(response);
          } else {
            this.refresh();
          }

          const successMessage =
            mode === 'delete'
              ? 'Zamówienie zostało oznaczone jako usunięte.'
              : 'Zamówienie zostało przywrócone.';
          this.message.success(successMessage);
          this.mutationResultSignal.set({ success: true });
          this.cancelDialog();
        }),
        catchError((error) => {
          this.handleMutationError(error, mode);
          return EMPTY;
        }),
        finalize(() => {
          this.confirmDialogSignal.update((current) => ({
            ...current,
            loading: false,
          }));
        }),
      )
      .subscribe();
  }

  cancelDialog(): void {
    this.confirmDialogSignal.set(createInitialConfirmDialog());
    this.mutationModeSignal.set(null);
  }

  clearMutationResult(): void {
    this.mutationResultSignal.set(null);
  }

  shouldBlockNavigation(): boolean {
    const form = this.formStateSignal();
    if (!form.dirty) {
      return false;
    }

    return this.statusSignal() !== 'saving';
  }

  private reconcileFormDisabledState(): void {
    const dto = this.orderDtoSignal();
    const permissions = this.permissionsSignal();
    const canEdit = permissions.canEdit && !dto?.deletedAt;
    this.setFormDisabled(!canEdit);
  }

  private fetchOrder(orderId: string): void {
    this.requestOrder(orderId)
      .pipe(
        tap((response) => {
          this.applyOrderResponse(response);
          this.statusSignal.set('idle');
        }),
        catchError((error) => {
          this.handleFetchError(error);
          return EMPTY;
        }),
        finalize(() => {
          if (this.statusSignal() === 'loading') {
            this.statusSignal.set('idle');
          }
        }),
      )
      .subscribe();
  }

  private applyOrderResponse(response: OrderResponse): void {
    this.orderDtoSignal.set(response);
    const nextValue = mapOrderDetailDtoToFormValue(response);
    this.initialFormValueSignal.set({ ...nextValue });

    const snapshot = this.formStateSignal();
    this.formStateSignal.set({
      ...snapshot,
      value: { ...nextValue },
      dirty: false,
      valid: snapshot.form?.valid ?? true,
      errors: [],
      disabled: !this.permissionsSignal().canEdit || Boolean(response.deletedAt),
      validation: createDefaultFormValidation(),
    });

    const formRef = snapshot.form;
    if (formRef) {
      formRef.reset(nextValue, { emitEvent: false });
      if (this.formStateSignal().disabled) {
        formRef.disable({ emitEvent: false });
      } else {
        formRef.enable({ emitEvent: false });
      }
    }
  }

  private requestOrder(orderId: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`/api/orders/${orderId}`);
  }

  private requestUpdate(
    orderId: string,
    payload: UpdateOrderCommand,
  ): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`/api/orders/${orderId}`, payload);
  }

  private requestDelete(orderId: string): Observable<OrderResponse | null> {
    return this.http
      .delete<void>(`/api/orders/${orderId}`)
      .pipe(map(() => null));
  }

  private requestRestore(orderId: string): Observable<OrderResponse> {
    const payload: RestoreOrderCommand = { orderId };
    return this.http.post<OrderResponse>(
      `/api/orders/${orderId}/restore`,
      payload,
    );
  }

  private requestAudit(orderId: string): Observable<OrderAuditResponse> {
    return this.http.get<OrderAuditResponse>(`/api/orders/${orderId}/audit`);
  }

  private mapAuditResponse(response: OrderAuditResponse): OrderAuditVm {
    const entries = (response.items ?? []).map((item: OrderAuditEntryDto) =>
      mapAuditEntryDtoToVm(item),
    );

    return {
      entries,
      total: response.total ?? entries.length,
      nextCursor: null,
    };
  }

  private computePermissions(roles: AppRole[]): OrderRolePermissionsVm {
    const hasEditorRole = roles.includes('editor') || roles.includes('owner');
    const canViewAudit = roles.length > 0;

    return {
      canEdit: hasEditorRole,
      canDelete: hasEditorRole,
      canRestore: hasEditorRole,
      canViewAudit,
    };
  }

  private computeActionsState(dto: OrderDetailDto): OrderActionsStateVm {
    const permissions = this.permissionsSignal();
    const form = this.formStateSignal();
    const isDeleted = Boolean(dto.deletedAt);
    const isSaving = this.statusSignal() === 'saving';

    const canEdit = permissions.canEdit && !isDeleted;
    const canSubmit =
      canEdit && form.valid && form.dirty && !isSaving && form.errors.length === 0;
    const canReset = canEdit && form.dirty && !isSaving;

    return {
      ...createInitialActionsState(),
      submitting: isSaving,
      canSubmit,
      canReset,
      disableDelete: !permissions.canDelete || isDeleted || isSaving,
      disableRestore: !permissions.canRestore || !isDeleted || isSaving,
      showDelete: permissions.canDelete,
      showRestore: permissions.canRestore,
    };
  }

  private toUpdatePayload(
    value: OrderFormValue,
    dto: OrderDetailDto,
  ): UpdateOrderCommand {
    return {
      orderNo: value.orderNo.trim(),
      customerId: value.customerId,
      orderDate: value.orderDate,
      itemName: value.itemName.trim(),
      quantity: value.quantity,
      isEur: value.isEur,
      eurRate: value.isEur ? value.eurRate ?? 0 : null,
      producerDiscountPct: value.producerDiscountPct,
      distributorDiscountPct: value.distributorDiscountPct,
      vatRatePct: value.vatRatePct,
      totalNetPln: value.totalNetPln,
      totalGrossPln: value.totalGrossPln,
      totalGrossEur: value.isEur ? value.totalGrossEur ?? 0 : null,
      comment: value.comment?.trim() ?? null,
      deletedAt: dto.deletedAt ?? undefined,
    };
  }

  private handleFetchError(error: unknown): void {
    const status = this.extractStatus(error);

    if (status === 404) {
      this.statusSignal.set('not-found');
      this.errorSignal.set('Nie znaleziono zamówienia.');
      return;
    }

    if (status === 403) {
      this.statusSignal.set('forbidden');
      this.errorSignal.set('Brak uprawnień do podglądu zamówienia.');
      return;
    }

    this.statusSignal.set('error');
    const message =
      this.extractErrorMessage(error) ?? 'Nie udało się pobrać zamówienia.';
    this.errorSignal.set(message);
    this.notification.error('Nie udało się wczytać zamówienia', message);
  }

  private handleSubmitError(error: unknown): void {
    const message = this.extractErrorMessage(error);
    this.statusSignal.set('error');

    if (!message) {
      this.notification.error(
        'Nie udało się zapisać zmian',
        'Spróbuj ponownie później.',
      );
      return;
    }

    this.message.error(message);
  }

  private handleMutationError(error: unknown, mode: 'delete' | 'restore'): void {
    const message =
      this.extractErrorMessage(error) ??
      (mode === 'delete'
        ? 'Nie udało się usunąć zamówienia.'
        : 'Nie udało się przywrócić zamówienia.');

    this.notification.error('Operacja nie powiodła się', message);
    this.mutationResultSignal.set({ success: false, message });
  }

  private extractStatus(error: unknown): number | null {
    if (error instanceof HttpErrorResponse) {
      return error.status;
    }

    if (typeof error === 'object' && error) {
      const maybeStatus = (error as { status?: number }).status;
      if (typeof maybeStatus === 'number') {
        return maybeStatus;
      }
      const nestedStatus = (error as { error?: { status?: number } }).error?.status;
      if (typeof nestedStatus === 'number') {
        return nestedStatus;
      }
    }

    return null;
  }

  private extractErrorMessage(error: unknown): string | null {
    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (error instanceof HttpErrorResponse) {
      const message =
        typeof error.error === 'string'
          ? error.error
          : (error.error as { message?: string })?.message;
      return message ?? error.message;
    }

    if (typeof error === 'object') {
      const maybeMessage = (error as { message?: string }).message;
      if (maybeMessage) {
        return maybeMessage;
      }

      const nestedMessage = (error as { error?: { message?: string } }).error?.message;
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    return null;
  }
}

