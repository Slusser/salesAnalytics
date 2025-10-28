import { HttpClient, HttpParams } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  EMPTY,
  Observable,
  catchError,
  distinctUntilChanged,
  finalize,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';

import type {
  CustomerDetailResponse,
  CustomerDto,
  ListCustomersQuery,
  ListCustomersResponse,
  UpdateCustomerCommand,
} from '@shared/dtos/customers.dto';
import type { AppRole } from '@shared/dtos/user-roles.dto';

import { AuthSessionService } from '../auth/auth-session.service';

import {
  CUSTOMERS_DEFAULT_LIMIT,
  CUSTOMERS_DEFAULT_PAGE,
  CUSTOMERS_LIMIT_OPTIONS,
  CUSTOMERS_MAX_SEARCH_LENGTH,
  ConfirmationState,
  CreateCustomerRequest,
  CustomerRowVm,
  CustomersMutationAction,
  CustomersQueryParamsVm,
} from './customers.types';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);

  readonly roles = signal<AppRole[]>(['viewer']);

  private readonly paramsSignal = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => this.normalizeParams(params))
    ),
    {
      initialValue: this.normalizeParams(this.route.snapshot.queryParamMap),
    }
  );

  readonly params = signal<CustomersQueryParamsVm>(
    this.paramsSignal() as CustomersQueryParamsVm
  );
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  readonly data = signal<ListCustomersResponse | null>(null);

  private readonly confirmation = signal<ConfirmationState>({
    open: false,
    title: '',
  });
  private readonly mutationInProgress = signal(false);

  readonly confirmDialogOpen = computed(() => this.confirmation().open);
  readonly confirmDialogTitle = computed(() => this.confirmation().title);
  readonly confirmDialogDescription = computed(
    () => this.confirmation().description ?? ''
  );
  readonly confirmDialogCustomerName = computed(
    () => this.confirmation().customer?.name ?? ''
  );
  readonly confirmDialogLoading = computed(() => this.mutationInProgress());

  constructor() {
    this.initializeRoles();
    this.watchParams();
  }

  get(query: ListCustomersQuery = {}): Observable<CustomerDto[]> {
    const httpParams = new HttpParams({
      fromObject: this.toHttpParams(query),
    });

    return this.http
      .get<ListCustomersResponse>('/api/customers', { params: httpParams })
      .pipe(map((response) => response.items ?? []));
  }

  createCustomer(payload: CreateCustomerRequest): Observable<CustomerDto> {
    return this.http.post<CustomerDto>('/api/customers', payload);
  }

  getById(customerId: string): Observable<CustomerDetailResponse> {
    return this.http.get<CustomerDetailResponse>(
      `/api/customers/${customerId}`
    );
  }

  update(
    customerId: string,
    payload: UpdateCustomerCommand
  ): Observable<CustomerDetailResponse> {
    return this.http.put<CustomerDetailResponse>(
      `/api/customers/${customerId}`,
      payload
    );
  }

  softDelete(customerId: string): Observable<CustomerDetailResponse> {
    return this.http.delete<CustomerDetailResponse>(
      `/api/customers/${customerId}`
    );
  }

  refetch(): void {
    this.fetchCustomers(this.params());
  }

  resetFilters(): void {
    this.setParams(
      { search: undefined, includeInactive: undefined },
      { resetPage: true }
    );
  }

  setParams(
    partial: Partial<CustomersQueryParamsVm>,
    options: { resetPage?: boolean } = {}
  ): void {
    const current = this.params();
    const merged = {
      ...current,
      ...partial,
      ...(options.resetPage ? { page: CUSTOMERS_DEFAULT_PAGE } : {}),
    };
    const normalized = this.normalizeState(merged);
    if (this.areParamsEqual(current, normalized)) {
      return;
    }

    this.params.set(normalized);
    this.navigateWithParams(normalized);
    this.fetchCustomers(normalized);
  }

  navigateToEdit(customerId: string): void {
    this.router.navigate(['/customers', customerId]);
  }

  askSoftDelete(customer: CustomerRowVm): void {
    if (this.mutationInProgress()) {
      return;
    }

    this.confirmation.set({
      open: true,
      action: 'soft-delete',
      customer,
      title: 'Usuń kontrahenta',
      description: `Czy na pewno chcesz oznaczyć kontrahenta "${customer.name}" jako usuniętego?`,
    });
  }

  askRestore(customer: CustomerRowVm): void {
    if (this.mutationInProgress()) {
      return;
    }

    this.confirmation.set({
      open: true,
      action: 'restore',
      customer,
      title: 'Przywróć kontrahenta',
      description: `Czy na pewno chcesz przywrócić kontrahenta "${customer.name}"?`,
    });
  }

  confirmDialogConfirm(): void {
    const state = this.confirmation();
    if (!state.open || !state.customer || !state.action) {
      this.resetConfirmation();
      return;
    }

    this.performAction(state.customer, state.action);
  }

  confirmDialogClose(): void {
    if (this.mutationInProgress()) {
      return;
    }

    this.resetConfirmation();
  }

  canMutate(): boolean {
    const roles: string[] = this.roles();
    return roles.includes('owner') || roles.includes('editor');
  }

  private initializeRoles(): void {
    effect(
      () => {
        const user = this.session.user();
        this.roles.set(user?.roles ?? ['viewer']);
      },
      { allowSignalWrites: true }
    );
  }

  private watchParams(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => this.normalizeParams(params)),
        distinctUntilChanged((a, b) => this.areParamsEqual(a, b))
      )
      .subscribe((normalized) => {
        this.params.set(normalized);
        this.fetchCustomers(normalized);
      });
  }

  private fetchCustomers(params: CustomersQueryParamsVm): void {
    this.loading.set(true);
    this.error.set(null);

    this.requestCustomers(params)
      .pipe(
        tap((response) => {
          this.data.set(response);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.error.set(err);
          return of(null);
        })
      )
      .subscribe();
  }

  private requestCustomers(
    params: CustomersQueryParamsVm
  ): Observable<ListCustomersResponse> {
    const dtoParams = this.toDtoParams(params);
    const httpParams = new HttpParams({
      fromObject: this.toHttpParams(dtoParams),
    });
    return this.http
      .get<ListCustomersResponse>('/api/customers', { params: httpParams })
      .pipe(shareReplay(1));
  }

  private performAction(
    customer: CustomerRowVm,
    action: CustomersMutationAction
  ): void {
    if (this.mutationInProgress()) {
      return;
    }

    this.mutationInProgress.set(true);

    let request$: Observable<CustomerDetailResponse>;

    if (action === 'soft-delete') {
      request$ = this.deleteCustomer(customer.id);
    } else {
      request$ = this.restoreCustomer(customer.id);
    }

    request$
      .pipe(
        tap((response) => {
          this.message.success(
            action === 'soft-delete'
              ? `Kontrahent "${response.name}" został oznaczony jako usunięty.`
              : `Kontrahent "${response.name}" został przywrócony.`
          );

          this.resetConfirmation();
          this.refetch();
        }),
        catchError((error) => this.handleMutationError(error, action)),
        finalize(() => {
          this.mutationInProgress.set(false);
        })
      )
      .subscribe();
  }

  private deleteCustomer(
    customerId: string
  ): Observable<CustomerDetailResponse> {
    return this.http.delete<CustomerDetailResponse>(
      `/api/customers/${customerId}`
    );
  }

  private restoreCustomer(
    customerId: string
  ): Observable<CustomerDetailResponse> {
    const payload = {
      isActive: true,
      deletedAt: null,
    };
    return this.http.put<CustomerDetailResponse>(
      `/api/customers/${customerId}`,
      payload
    );
  }

  private handleMutationError(
    error: unknown,
    action: CustomersMutationAction
  ): Observable<never> {
    const defaultMessage =
      action === 'soft-delete'
        ? 'Nie udało się usunąć kontrahenta. Spróbuj ponownie później.'
        : 'Nie udało się przywrócić kontrahenta. Spróbuj ponownie później.';

    const message = this.extractErrorMessage(error) ?? defaultMessage;

    this.message.error(message);
    this.resetConfirmation();

    return EMPTY;
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

    if (typeof error === 'object') {
      const maybeMessage = (error as { message?: string }).message;
      if (maybeMessage) {
        return maybeMessage;
      }

      const maybeNestedMessage = (error as { error?: { message?: string } })
        .error?.message;
      if (maybeNestedMessage) {
        return maybeNestedMessage;
      }
    }

    return null;
  }

  private resetConfirmation(): void {
    this.confirmation.set({ open: false, title: '' });
  }

  private navigateWithParams(vm: CustomersQueryParamsVm): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.toQueryParams(vm),
      queryParamsHandling: 'merge',
    });
  }

  private normalizeParams(source: Params | any): CustomersQueryParamsVm {
    const getValue = (key: string): unknown =>
      source?.get ? source.get(key) : source[key];

    const page = this.toInt(getValue('page'), CUSTOMERS_DEFAULT_PAGE);
    const limit = this.toInt(getValue('limit'), CUSTOMERS_DEFAULT_LIMIT);
    const search = this.toSearch(getValue('search'));
    const includeInactive = this.toBoolean(getValue('includeInactive'), false);

    return this.normalizeState({ page, limit, search, includeInactive });
  }

  private normalizeState(
    partial: Partial<CustomersQueryParamsVm>
  ): CustomersQueryParamsVm {
    const page = this.ensurePage(partial.page);
    const limit = this.ensureLimit(partial.limit);
    const search = this.ensureSearch(partial.search);
    const includeInactive = this.ensureIncludeInactive(partial.includeInactive);

    return {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(includeInactive ? { includeInactive } : {}),
    };
  }

  private toQueryParams(vm: CustomersQueryParamsVm): Params {
    return {
      page: vm.page,
      limit: vm.limit,
      ...(vm.search ? { search: vm.search } : { search: undefined }),
      ...(vm.includeInactive
        ? { includeInactive: true }
        : { includeInactive: undefined }),
    };
  }

  private toDtoParams(vm: CustomersQueryParamsVm): ListCustomersQuery {
    return {
      page: vm.page,
      limit: vm.limit,
      search: vm.search,
      includeInactive: vm.includeInactive,
    };
  }

  private toHttpParams(query: ListCustomersQuery): Record<string, string> {
    const params: Record<string, string> = {};

    if (query.page !== undefined) {
      params['page'] = String(query.page);
    }

    if (query.limit !== undefined) {
      params['limit'] = String(query.limit);
    }

    if (query.search) {
      params['search'] = query.search;
    }

    if (query.includeInactive) {
      params['includeInactive'] = 'true';
    }

    return params;
  }

  private toInt(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number' && Number.isFinite(value))
      return Math.trunc(value);
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) return fallback;
      const n = Number(normalized);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
    return fallback;
  }

  private toBoolean(value: unknown, defaultValue: boolean): boolean {
    if (value === undefined || value === null || value === '')
      return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0') return false;
    }
    return defaultValue;
  }

  private toSearch(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, CUSTOMERS_MAX_SEARCH_LENGTH);
    return trimmed || undefined;
  }

  private ensurePage(value: number | undefined): number {
    if (!value || value < CUSTOMERS_DEFAULT_PAGE) return CUSTOMERS_DEFAULT_PAGE;
    return value;
  }

  private ensureLimit(value: number | undefined): number {
    if (!value) return CUSTOMERS_DEFAULT_LIMIT;
    if (!CUSTOMERS_LIMIT_OPTIONS.includes(value as any))
      return CUSTOMERS_DEFAULT_LIMIT;
    return value;
  }

  private ensureSearch(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim().slice(0, CUSTOMERS_MAX_SEARCH_LENGTH);
    return trimmed || undefined;
  }

  private ensureIncludeInactive(
    value: boolean | undefined
  ): boolean | undefined {
    if (!this.canMutate()) return undefined;
    return value ? true : undefined;
  }

  private areParamsEqual(
    a: CustomersQueryParamsVm,
    b: CustomersQueryParamsVm
  ): boolean {
    return (
      a.page === b.page &&
      a.limit === b.limit &&
      (a.search ?? '') === (b.search ?? '') &&
      !!a.includeInactive === !!b.includeInactive
    );
  }
}