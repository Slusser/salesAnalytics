import { HttpClient, HttpParams } from '@angular/common/http';
import { formatDate } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import {
  catchError,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';

import type {
  ListOrdersQuery,
  ListOrdersResponse,
  OrderListItemDto,
} from '@shared/dtos/orders.dto';
import type { AppRole } from '@shared/dtos/user-roles.dto';

import { AuthSessionService } from '../auth/auth-session.service';
import {
  ORDERS_ALLOWED_SORT_FIELDS,
  ORDERS_DEFAULT_LIMIT,
  ORDERS_DEFAULT_PAGE,
  ORDERS_LIMIT_OPTIONS,
  ORDERS_MAX_ORDER_NO_LENGTH,
  OrderRowVm,
  OrdersFilterFormState,
  OrdersListVm,
  OrdersQueryParamsVm,
  OrdersRolePermissionsVm,
  OrdersSortDirection,
  OrdersSortField,
  OrdersSortState,
} from './orders-list.types';

interface ConfirmationState {
  open: boolean;
  action?: 'soft-delete' | 'restore';
  order?: OrderRowVm;
  title: string;
  description?: string;
  loading: boolean;
}

interface ExportState {
  inProgress: boolean;
}

const DEFAULT_SORT: OrdersSortState = Object.freeze({
  field: 'orderDate',
  direction: 'desc',
});

@Injectable({ providedIn: 'root' })
export class OrdersListService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly notification = inject(NzNotificationService);

  readonly permissions = signal<OrdersRolePermissionsVm>({
    canMutate: false,
    canIncludeDeleted: false,
  });

  private readonly initialParams = this.normalizeParams(
    this.route.snapshot.queryParamMap
  );

  private readonly paramsSignal = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => this.normalizeParams(params))
    ),
    { initialValue: this.initialParams }
  );

  readonly params = signal<OrdersQueryParamsVm>(
    this.paramsSignal() ?? this.initialParams
  );
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  readonly data = signal<OrdersListVm | null>(null);

  private readonly confirmation = signal<ConfirmationState>({
    open: false,
    title: '',
    loading: false,
  });
  private readonly exportState = signal<ExportState>({ inProgress: false });
  readonly expandedRowId = signal<string | null>(null);

  readonly confirmDialogOpen = computed(() => this.confirmation().open);
  readonly confirmDialogTitle = computed(() => this.confirmation().title);
  readonly confirmDialogDescription = computed(
    () => this.confirmation().description ?? ''
  );
  readonly confirmDialogOrderNo = computed(
    () => this.confirmation().order?.orderNo ?? ''
  );
  readonly confirmDialogLoading = computed(() => this.confirmation().loading);

  readonly exportInProgress = computed(() => this.exportState().inProgress);

  readonly items = computed<OrderRowVm[]>(() => this.data()?.items ?? []);
  readonly total = computed(() => this.data()?.total ?? 0);

  readonly showEmpty = computed(
    () => !this.loading() && !this.error() && this.items().length === 0
  );
  readonly showError = computed(() => Boolean(this.error()));

  constructor() {
    this.initializePermissions();
    this.initializeParamsEffect();
    this.fetchOrders(this.params());
  }

  setParams(
    partial: Partial<OrdersQueryParamsVm>,
    options: { resetPage?: boolean } = {}
  ): void {
    const current = this.params();
    const merged = {
      ...current,
      ...partial,
      ...(options.resetPage ? { page: ORDERS_DEFAULT_PAGE } : {}),
    };
    const normalized = this.normalizeState(merged);

    if (this.areParamsEqual(current, normalized)) {
      return;
    }

    this.params.set(normalized);
    this.navigateWithParams(normalized);
    this.fetchOrders(normalized);
  }

  resetFilters(): void {
    this.setParams(
      {
        orderNo: undefined,
        customerId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sort: DEFAULT_SORT,
      },
      { resetPage: true }
    );
  }

  refetch(): void {
    this.fetchOrders(this.params());
  }

  setFilterFormState(form: OrdersFilterFormState): void {
    this.setParams(
      {
        orderNo: this.normalizeOrderNo(form.orderNo),
        customerId: this.normalizeCustomerId(form.customerId),
        ...this.normalizeDateRange(form.dateRange),
      },
      { resetPage: true }
    );
  }

  toggleIncludeDeleted(enabled: boolean): void {
    if (!this.permissions().canIncludeDeleted) {
      this.message.warning(
        'Nie masz uprawnień do przeglądania usuniętych zamówień.'
      );
      return;
    }

    this.setParams({ includeDeleted: enabled ? true : undefined });
  }

  handleSortChange(sort: OrdersSortState): void {
    this.setParams({ sort }, { resetPage: true });
  }

  handlePaginationChange(page: number, limit?: number): void {
    const partial: Partial<OrdersQueryParamsVm> = { page };
    if (limit && limit !== this.params().limit) {
      partial.limit = limit;
    }

    this.setParams(partial, {
      resetPage: Boolean(limit && limit !== this.params().limit),
    });
  }

  askSoftDelete(order: OrderRowVm): void {
    if (!this.permissions().canMutate || this.loading()) {
      return;
    }

    this.confirmation.set({
      open: true,
      action: 'soft-delete',
      order,
      title: 'Usuń zamówienie',
      description: `Czy na pewno chcesz oznaczyć zamówienie "${order.orderNo}" jako usunięte?`,
      loading: false,
    });
  }

  askRestore(order: OrderRowVm): void {
    if (!this.permissions().canMutate || this.loading()) {
      return;
    }

    this.confirmation.set({
      open: true,
      action: 'restore',
      order,
      title: 'Przywróć zamówienie',
      description: `Czy na pewno chcesz przywrócić zamówienie "${order.orderNo}"?`,
      loading: false,
    });
  }

  confirmDialogConfirm(): void {
    const snapshot = this.confirmation();
    if (!snapshot.open || !snapshot.action || !snapshot.order) {
      this.resetConfirmation();
      return;
    }

    this.performMutation(snapshot.order, snapshot.action);
  }

  confirmDialogClose(): void {
    if (this.confirmation().loading) {
      return;
    }

    this.resetConfirmation();
  }

  setExpandedRow(orderId: string | null): void {
    this.expandedRowId.set(orderId);
  }

  navigateToOrder(orderId: string): void {
    this.router.navigate(['/orders', orderId]);
  }

  canMutate(): boolean {
    return this.permissions().canMutate;
  }

  private initializePermissions(): void {
    effect(
      () => {
        const user = this.session.user();
        const roles = user?.roles ?? [];
        const canMutate =
          roles.includes('owner' as AppRole) ||
          roles.includes('editor' as AppRole);
        const canIncludeDeleted = canMutate;

        this.permissions.set({ canMutate, canIncludeDeleted });
      },
      { allowSignalWrites: true }
    );
  }

  private initializeParamsEffect(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => this.normalizeParams(params)),
        distinctUntilChanged((a, b) => this.areParamsEqual(a, b))
      )
      .subscribe((normalized) => {
        this.params.set(normalized);
        this.fetchOrders(normalized);
      });
  }

  private fetchOrders(params: OrdersQueryParamsVm): void {
    this.loading.set(true);
    this.error.set(null);

    this.requestOrders(params)
      .pipe(
        tap((response) => {
          if (!response) {
            return;
          }

          this.data.set(this.mapResponseToVm(response));
          this.loading.set(false);
        }),
        catchError((error) => {
          this.loading.set(false);
          this.error.set(error);
          this.handleFetchError(error, params);
          return of(null);
        })
      )
      .subscribe();
  }

  private requestOrders(params: OrdersQueryParamsVm) {
    const dtoParams = this.toDtoParams(params);
    const httpParams = new HttpParams({
      fromObject: this.toHttpParams(dtoParams),
    });
    return this.http
      .get<ListOrdersResponse>('/api/orders', { params: httpParams })
      .pipe(shareReplay(1));
  }

  private performMutation(
    order: OrderRowVm,
    action: 'soft-delete' | 'restore'
  ): void {
    if (this.confirmation().loading) {
      return;
    }

    this.confirmation.update((state) => ({ ...state, loading: true }));

    const request$ =
      action === 'soft-delete'
        ? this.http.delete(`/api/orders/${order.id}`)
        : this.http.put(`/api/orders/${order.id}`, { ...order, deletedAt: null,  deleted: false });

    request$
      .pipe(
        tap(() => {
          this.message.success(
            action === 'soft-delete'
              ? `Zamówienie "${order.orderNo}" zostało oznaczone jako usunięte.`
              : `Zamówienie "${order.orderNo}" zostało przywrócone.`
          );
          this.resetConfirmation();
          this.refetch();
        }),
        catchError((error) => {
          this.handleMutationError(error, action);
          this.confirmation.update((state) => ({ ...state, loading: false }));
          return of(null);
        })
      )
      .subscribe();
  }

  private handleFetchError(error: unknown, params: OrdersQueryParamsVm): void {
    if (!error) {
      return;
    }

    console.error('Orders list error', error);

    if (this.isForbiddenError(error) && params.includeDeleted) {
      this.message.warning(
        'Brak uprawnień do podglądu usuniętych zamówień. Przywrócono filtr domyślny.'
      );
      this.setParams({ includeDeleted: undefined });
      return;
    }

    if (this.isValidationError(error)) {
      this.message.error(
        'Niepoprawne parametry wyszukiwania zamówień. Sprawdź filtry.'
      );
      return;
    }

    this.notification.error(
      'Nie udało się pobrać zamówień',
      'Spróbuj ponownie później.'
    );
  }

  private handleMutationError(
    error: unknown,
    action: 'soft-delete' | 'restore'
  ): void {
    console.error('Orders mutation error', error);
    const defaultMessage =
      action === 'soft-delete'
        ? 'Nie udało się usunąć zamówienia. Spróbuj ponownie później.'
        : 'Nie udało się przywrócić zamówienia. Spróbuj ponownie później.';

    const message = this.extractErrorMessage(error) ?? defaultMessage;
    this.message.error(message);
  }

  private handleExportError(error: unknown): void {
    console.error('Orders export error', error);
    this.message.error(
      'Nie udało się wyeksportować zamówień. Spróbuj ponownie później.'
    );
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private buildExportSuffix(timestamp: string): string {
    return timestamp.replace(/[:T]/g, '-').split('.')[0] ?? 'export';
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

    if (typeof error === 'object' && error) {
      const message = (error as { message?: string }).message;
      if (message) {
        return message;
      }

      const nested = (error as { error?: { message?: string } }).error?.message;
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private resetConfirmation(): void {
    this.confirmation.set({
      open: false,
      action: undefined,
      order: undefined,
      title: '',
      loading: false,
    });
  }

  private navigateWithParams(vm: OrdersQueryParamsVm): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.toQueryParams(vm),
      queryParamsHandling: 'merge',
    });
  }

  private normalizeParams(source: Params | any): OrdersQueryParamsVm {
    const getValue = (key: string): unknown =>
      source?.get ? source.get(key) : source[key];

    const page = this.toInt(getValue('page'), ORDERS_DEFAULT_PAGE);
    const limit = this.toInt(getValue('limit'), ORDERS_DEFAULT_LIMIT);
    const sort = this.toSort(getValue('sort'));
    const orderNo = this.normalizeOrderNo(getValue('orderNo'));
    const customerId = this.normalizeCustomerId(getValue('customerId'));
    const includeDeleted = this.toBoolean(getValue('includeDeleted'));
    const { dateFrom, dateTo } = this.normalizeDateRangeFromParams(
      getValue('dateFrom'),
      getValue('dateTo')
    );

    return this.normalizeState({
      page,
      limit,
      sort,
      orderNo,
      customerId,
      dateFrom,
      dateTo,
      includeDeleted,
    });
  }

  private normalizeState(
    partial: Partial<OrdersQueryParamsVm>
  ): OrdersQueryParamsVm {
    const page = this.ensurePage(partial.page);
    const limit = this.ensureLimit(partial.limit);
    const sort = this.ensureSort(partial.sort);
    const orderNo = this.ensureOrderNo(partial.orderNo);
    const customerId = this.ensureCustomerId(partial.customerId);
    const { dateFrom, dateTo } = this.ensureDateRange(
      partial.dateFrom,
      partial.dateTo
    );
    const includeDeleted = this.ensureIncludeDeleted(partial.includeDeleted);

    return {
      page,
      limit,
      sort,
      ...(orderNo ? { orderNo } : {}),
      ...(customerId ? { customerId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(includeDeleted ? { includeDeleted } : {}),
    };
  }

  private ensureSort(value: OrdersSortState | undefined): OrdersSortState {
    if (!value) {
      return DEFAULT_SORT;
    }

    if (!ORDERS_ALLOWED_SORT_FIELDS.includes(value.field)) {
      return DEFAULT_SORT;
    }

    if (value.direction !== 'asc' && value.direction !== 'desc') {
      return DEFAULT_SORT;
    }

    return value;
  }

  private ensureOrderNo(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.slice(0, ORDERS_MAX_ORDER_NO_LENGTH);
  }

  private ensureCustomerId(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(trimmed) ? trimmed : undefined;
  }

  private ensureDateRange(
    dateFrom?: string,
    dateTo?: string
  ): { dateFrom?: string; dateTo?: string } {
    if (!dateFrom && !dateTo) {
      return {};
    }

    if (dateFrom && !this.isValidDate(dateFrom)) {
      return {};
    }

    if (dateTo && !this.isValidDate(dateTo)) {
      return {};
    }

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return {};
    }

    return { dateFrom, dateTo };
  }

  private ensureIncludeDeleted(
    value: boolean | undefined
  ): boolean | undefined {
    if (!value) {
      return undefined;
    }

    return this.permissions().canIncludeDeleted ? true : undefined;
  }

  private ensurePage(value: number | undefined): number {
    if (!value || value < ORDERS_DEFAULT_PAGE) {
      return ORDERS_DEFAULT_PAGE;
    }

    return value;
  }

  private ensureLimit(value: number | undefined): number {
    if (!value) {
      return ORDERS_DEFAULT_LIMIT;
    }

    if (!ORDERS_LIMIT_OPTIONS.includes(value as any)) {
      return ORDERS_DEFAULT_LIMIT;
    }

    return value;
  }

  private normalizeOrderNo(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.slice(0, ORDERS_MAX_ORDER_NO_LENGTH).toLowerCase();
  }

  private normalizeCustomerId(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(trimmed) ? trimmed : undefined;
  }

  private normalizeDateRange(range: OrdersFilterFormState['dateRange']): {
    dateFrom?: string;
    dateTo?: string;
  } {
    if (range?.length !== 2) {
      return {};
    }

    const [from, to] = range;
    const dateFrom = this.normalizeDate(from);
    const dateTo = this.normalizeDate(to);

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return {};
    }

    return {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    };
  }

  private normalizeDate(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return formatDate(date, 'yyyy-MM-dd', 'en-US');
  }

  private normalizeDateRangeFromParams(
    dateFrom: unknown,
    dateTo: unknown
  ): {
    dateFrom?: string;
    dateTo?: string;
  } {
    const normalizedFrom = typeof dateFrom === 'string' ? dateFrom : undefined;
    const normalizedTo = typeof dateTo === 'string' ? dateTo : undefined;
    return this.ensureDateRange(normalizedFrom, normalizedTo);
  }

  private toQueryParams(vm: OrdersQueryParamsVm): Params {
    return {
      page: vm.page,
      limit: vm.limit,
      sort: `${vm.sort.field}:${vm.sort.direction}`,
      ...(vm.orderNo ? { orderNo: vm.orderNo } : { orderNo: undefined }),
      ...(vm.customerId
        ? { customerId: vm.customerId }
        : { customerId: undefined }),
      ...(vm.dateFrom ? { dateFrom: vm.dateFrom } : { dateFrom: undefined }),
      ...(vm.dateTo ? { dateTo: vm.dateTo } : { dateTo: undefined }),
      ...(vm.includeDeleted
        ? { includeDeleted: true }
        : { includeDeleted: undefined }),
    };
  }

  private toDtoParams(vm: OrdersQueryParamsVm): ListOrdersQuery {
    return {
      page: vm.page,
      limit: vm.limit,
      customerId: vm.customerId,
      orderNo: vm.orderNo,
      dateFrom: vm.dateFrom,
      dateTo: vm.dateTo,
      includeDeleted: vm.includeDeleted,
      sort: `${vm.sort.field}:${vm.sort.direction}`,
    };
  }

  private toHttpParams(dto: ListOrdersQuery): Record<string, string> {
    const params: Record<string, string> = {
      page: String(dto.page ?? ORDERS_DEFAULT_PAGE),
      limit: String(dto.limit ?? ORDERS_DEFAULT_LIMIT),
      sort: dto.sort ?? `${DEFAULT_SORT.field}:${DEFAULT_SORT.direction}`,
    };

    if (dto.orderNo) {
      params['orderNo'] = dto.orderNo;
    }

    if (dto.customerId) {
      params['customerId'] = dto.customerId;
    }

    if (dto.dateFrom) {
      params['dateFrom'] = dto.dateFrom;
    }

    if (dto.dateTo) {
      params['dateTo'] = dto.dateTo;
    }

    if (dto.includeDeleted) {
      params['includeDeleted'] = 'true';
    }

    return params;
  }

  private mapResponseToVm(response: ListOrdersResponse): OrdersListVm {
    return {
      items: response.items.map((item) => this.mapRow(item)),
      total: response.total,
      page: response.page,
      limit: response.limit,
    };
  }

  private mapRow(dto: OrderListItemDto): OrderRowVm {
    const deleted = Boolean(dto.deletedAt);
    const currencyCode = dto.isEur ? 'EUR' : 'PLN';
    const currencyLabel = dto.isEur ? 'EUR' : 'PLN';
    const rowDisabled = deleted;

    return {
      id: dto.id,
      orderNo: dto.orderNo,
      customerId: dto.customerId,
      customerName: dto.customerId,
      orderDate: dto.orderDate,
      totalNetPln: dto.totalNetPln,
      totalGrossPln: dto.totalGrossPln,
      vatRatePct: dto.vatRatePct,
      currencyCode,
      currencyLabel,
      netFormatted: this.formatCurrency(dto.totalNetPln, 'PLN'),
      grossFormatted: this.formatCurrency(
        dto.totalGrossPln,
        dto.isEur ? 'EUR' : 'PLN'
      ),
      createdAt: dto.createdAt,
      createdByName: undefined,
      deleted,
      rowDisabled,
    };
  }

  private formatCurrency(value: number, currency: 'PLN' | 'EUR'): string {
    const formatter = new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formatter.format(value);
  }

  private toSort(value: unknown): OrdersSortState | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const [fieldRaw, directionRaw] = trimmed.split(':', 2);
    const fieldCandidate = fieldRaw?.trim() ?? '';
    const directionCandidate = (directionRaw?.trim() ?? 'asc').toLowerCase();

    const normalizedField = this.normalizeSortField(fieldCandidate);
    const normalizedDirection = this.normalizeSortDirection(directionCandidate);

    if (!normalizedField || !normalizedDirection) {
      return undefined;
    }

    return { field: normalizedField, direction: normalizedDirection };
  }

  private normalizeSortField(field: string): OrdersSortField | null {
    const normalized = field.replace(/\s+/g, '') as OrdersSortField;
    return ORDERS_ALLOWED_SORT_FIELDS.includes(normalized) ? normalized : null;
  }

  private normalizeSortDirection(
    direction: string
  ): OrdersSortDirection | null {
    if (direction === 'asc' || direction === 'desc') {
      return direction;
    }

    return null;
  }

  private areParamsEqual(
    a: OrdersQueryParamsVm,
    b: OrdersQueryParamsVm
  ): boolean {
    return (
      a.page === b.page &&
      a.limit === b.limit &&
      a.sort.field === b.sort.field &&
      a.sort.direction === b.sort.direction &&
      (a.orderNo ?? '') === (b.orderNo ?? '') &&
      (a.customerId ?? '') === (b.customerId ?? '') &&
      (a.dateFrom ?? '') === (b.dateFrom ?? '') &&
      (a.dateTo ?? '') === (b.dateTo ?? '') &&
      !!a.includeDeleted === !!b.includeDeleted
    );
  }

  private toInt(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return fallback;
      }
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return Math.trunc(parsed);
      }
    }

    return fallback;
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }

    return undefined;
  }

  private isValidDate(value: string): boolean {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }

  private isForbiddenError(error: unknown): boolean {
    return this.extractStatus(error) === 403;
  }

  private isValidationError(error: unknown): boolean {
    return this.extractStatus(error) === 400;
  }

  private extractStatus(error: unknown): number | null {
    if (typeof error === 'object' && error) {
      const status =
        (error as { status?: number }).status ??
        (error as { statusCode?: number }).statusCode;
      if (typeof status === 'number') {
        return status;
      }

      const nestedStatus =
        (error as { error?: { status?: number; statusCode?: number } }).error
          ?.status ??
        (error as { error?: { status?: number; statusCode?: number } }).error
          ?.statusCode;

      if (typeof nestedStatus === 'number') {
        return nestedStatus;
      }
    }

    return null;
  }
}
