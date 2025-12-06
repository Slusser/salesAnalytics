import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  ParamMap,
  Params,
  Router,
} from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  takeUntilDestroyed,
  toObservable,
} from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  lastValueFrom,
  of,
} from 'rxjs';

import type {
  AnalyticsKpiResponseDto,
  AnalyticsTrendResponseDto,
  DailyOrdersAnalyticsItemDto,
} from '@shared/dtos/analytics.dto';

import { AnalyticsDashboardApiService } from './analytics-dashboard-api.service';
import { AuthSessionService } from '../auth/auth-session.service';
import {
  DashboardFilters,
  DashboardQueryParams,
  DashboardState,
  DataState,
  DailyPointViewModel,
  KpiViewModel,
  ManualRefreshState,
  MonthSelection,
  TrendPointViewModel,
} from './dashboard-store.types';

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

type LoadOptions = {
  force?: boolean;
};

const DEFAULT_TTL_MS = 90_000;
const FILTERS_DEBOUNCE_MS = 300;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MANUAL_REFRESH_ERROR =
  'Nie udało się odświeżyć wszystkich danych. Spróbuj ponownie.';

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
});

const CURRENCY_FORMATTER = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INTEGER_FORMATTER = new Intl.NumberFormat('pl-PL');

@Injectable({ providedIn: 'root' })
export class DashboardStoreService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AnalyticsDashboardApiService);
  private readonly notification = inject(NzNotificationService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authSession = inject(AuthSessionService);

  private readonly filtersSignal = signal<DashboardFilters>(
    this.createDefaultFilters()
  );
  private readonly activeMonthSignal = signal<MonthSelection | undefined>(
    undefined
  );

  private readonly kpiStateSignal = signal<DataState<AnalyticsKpiResponseDto>>({
    data: undefined,
    isLoading: false,
    error: null,
  });
  private readonly trendStateSignal = signal<DataState<AnalyticsTrendResponseDto>>(
    {
      data: undefined,
      isLoading: false,
      error: null,
    }
  );
  private readonly dailyStateSignal = signal<DataState<DailyOrdersAnalyticsItemDto[]>>(
    {
      data: undefined,
      isLoading: false,
      error: null,
    }
  );
  private readonly manualRefreshStateSignal = signal<ManualRefreshState>({
    lastRefreshedAt: undefined,
    isRefreshing: false,
    ttlMs: DEFAULT_TTL_MS,
    error: null,
  });
  private readonly canFilterByCustomerSignal = computed(() =>
    this.hasCustomerFilterPermission()
  );

  readonly filters = this.filtersSignal.asReadonly();
  readonly activeMonth = this.activeMonthSignal.asReadonly();
  readonly kpiState = this.kpiStateSignal.asReadonly();
  readonly trendState = this.trendStateSignal.asReadonly();
  readonly dailyState = this.dailyStateSignal.asReadonly();
  readonly manualRefreshState = this.manualRefreshStateSignal.asReadonly();
  readonly canFilterByCustomer = this.canFilterByCustomerSignal;

  readonly state = computed<DashboardState>(() => ({
    filters: this.filtersSignal(),
    kpi: this.kpiStateSignal(),
    trend: this.trendStateSignal(),
    daily: this.dailyStateSignal(),
    activeMonth: this.activeMonthSignal(),
    lastRefreshedAt: this.manualRefreshStateSignal().lastRefreshedAt,
  }));

  readonly kpiViewModel = computed<KpiViewModel[]>(() =>
    this.buildKpiViewModel()
  );
  readonly trendViewModel = computed<TrendPointViewModel[]>(() =>
    this.buildTrendViewModel()
  );
  readonly dailyViewModel = computed<DailyPointViewModel[]>(() =>
    this.buildDailyViewModel()
  );

  private readonly kpiCache = new Map<string, CacheEntry<AnalyticsKpiResponseDto>>();
  private readonly trendCache = new Map<
    string,
    CacheEntry<AnalyticsTrendResponseDto>
  >();
  private readonly dailyCache = new Map<
    string,
    CacheEntry<DailyOrdersAnalyticsItemDto[]>
  >();

  private syncingFromRoute = false;

  constructor() {
    this.registerCustomerFilterGuardEffect();
    this.initializeFromRoute();
    this.registerRouteListener();
    this.registerFiltersEffect();
    this.registerActiveMonthEffect();
  }

  setFilters(filters: DashboardFilters): void {
    const normalized = this.normalizeFilters(filters);
    if (!this.validateFilters(normalized)) {
      this.message.error(
        'Zakres dat jest nieprawidłowy. Upewnij się, że data początkowa nie przekracza końcowej.'
      );
      return;
    }

    const prev = this.filtersSignal();
    if (this.areFiltersEqual(prev, normalized)) {
      return;
    }

    const rangeChanged =
      prev.dateFrom !== normalized.dateFrom || prev.dateTo !== normalized.dateTo;

    this.filtersSignal.set(normalized);

    if (rangeChanged) {
      this.clearMonth({ skipNavigation: true });
    }
  }

  resetFilters(): void {
    const defaults = this.createDefaultFilters();
    this.filtersSignal.set(defaults);
    this.clearMonth({ skipNavigation: true });
  }

  async refreshAll(force = false): Promise<void> {
    const manualState = this.manualRefreshStateSignal();
    if (
      !force &&
      manualState.lastRefreshedAt &&
      Date.now() - manualState.lastRefreshedAt.getTime() < manualState.ttlMs
    ) {
      return;
    }

    if (this.manualRefreshStateSignal().isRefreshing) {
      return;
    }

    this.manualRefreshStateSignal.update((state) => ({
      ...state,
      isRefreshing: true,
      error: null,
    }));

    const filters = this.filtersSignal();
    const activeMonth = this.activeMonthSignal();

    const results = await Promise.allSettled([
      this.loadKpi(filters, { force: true }),
      this.loadTrend(filters, { force: true }),
      activeMonth ? this.loadDaily(activeMonth, { force: true }) : Promise.resolve(false),
    ]);

    const anySuccess = results.some(
      (result) => result.status === 'fulfilled' && result.value
    );
    const anyFailure = results.some(
      (result) => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value)
    );

    this.manualRefreshStateSignal.update((state) => ({
      ...state,
      isRefreshing: false,
      lastRefreshedAt: anySuccess ? new Date() : state.lastRefreshedAt,
      error: anyFailure
        ? MANUAL_REFRESH_ERROR
        : null,
    }));

    if (anyFailure) {
      this.notification.error(
        'Odświeżanie nie powiodło się',
        MANUAL_REFRESH_ERROR
      );
    }
  }

  selectMonth(selection: MonthSelection): void {
    if (!this.isMonthSelectionAllowed(selection)) {
      this.message.warning('Wybrany miesiąc nie jest dostępny w aktualnym trendzie.');
      return;
    }

    if (
      this.activeMonthSignal()?.year === selection.year &&
      this.activeMonthSignal()?.month === selection.month
    ) {
      return;
    }

    this.activeMonthSignal.set(selection);
  }

  clearMonth(options: { skipNavigation?: boolean } = {}): void {
    if (!this.activeMonthSignal()) {
      return;
    }

    this.activeMonthSignal.set(undefined);
    this.dailyStateSignal.set({
      data: undefined,
      isLoading: false,
      error: null,
    });

    if (!options.skipNavigation && !this.syncingFromRoute) {
      this.navigateWithParams(this.filtersSignal(), undefined);
    }
  }

  async refreshDaily(force = true): Promise<void> {
    const selection = this.activeMonthSignal();
    if (!selection) {
      return;
    }

    await this.loadDaily(selection, { force });
  }

  private registerFiltersEffect(): void {
    toObservable(this.filtersSignal)
      .pipe(
        debounceTime(FILTERS_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => this.areFiltersEqual(a, b)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((filters) => {
        if (!this.validateFilters(filters)) {
          return;
        }

        if (!this.syncingFromRoute) {
          this.navigateWithParams(filters, this.activeMonthSignal());
        }

        void this.loadKpi(filters, { force: true });
        void this.loadTrend(filters, { force: true });
      });
  }

  private registerActiveMonthEffect(): void {
    effect(
      () => {
        const selection = this.activeMonthSignal();
        const filters = this.filtersSignal();

        if (!selection) {
          if (!this.syncingFromRoute) {
            this.navigateWithParams(filters, undefined);
          }
          return;
        }

        if (!this.syncingFromRoute) {
          this.navigateWithParams(filters, selection);
        }

        void this.loadDaily(selection, { force: true });
      },
      { allowSignalWrites: true }
    );
  }

  private registerCustomerFilterGuardEffect(): void {
    effect(
      () => {
        if (!this.canFilterByCustomer()) {
          this.stripCustomerFilter();
        }
      },
      { allowSignalWrites: true }
    );
  }

  private stripCustomerFilter(): void {
    const current = this.filtersSignal();
    if (!current.customerId) {
      return;
    }

    const next: DashboardFilters = {
      ...current,
      customerId: undefined,
    };

    this.filtersSignal.set(next);

    if (!this.syncingFromRoute) {
      this.navigateWithParams(next, this.activeMonthSignal());
    }
  }

  private hasCustomerFilterPermission(): boolean {
    const roles = this.authSession.user()?.roles ?? [];
    return roles.some((role) => role === 'editor' || role === 'owner');
  }


  private initializeFromRoute(): void {
    const initial = this.normalizeQueryParams(
      this.route.snapshot.queryParamMap
    );
    this.filtersSignal.set(initial.filters);
    if (initial.activeMonth) {
      this.activeMonthSignal.set(initial.activeMonth);
    }

    void this.loadKpi(initial.filters, { force: true });
    void this.loadTrend(initial.filters, { force: true });
    if (initial.activeMonth) {
      void this.loadDaily(initial.activeMonth, { force: true });
    }
  }

  private registerRouteListener(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paramMap) => {
        const parsed = this.normalizeQueryParams(paramMap);
        const filtersChanged = !this.areFiltersEqual(
          parsed.filters,
          this.filtersSignal()
        );
        const monthChanged = !this.areMonthSelectionsEqual(
          parsed.activeMonth,
          this.activeMonthSignal()
        );

        this.syncingFromRoute = true;

        if (filtersChanged) {
          this.filtersSignal.set(parsed.filters);
        }

        if (monthChanged) {
          this.activeMonthSignal.set(parsed.activeMonth);
        }

        this.syncingFromRoute = false;
      });
  }

  private async loadKpi(
    filters: DashboardFilters,
    options: LoadOptions = {}
  ): Promise<boolean> {
    const cacheKey = this.createCacheKey(filters);
    if (!options.force) {
      const cached = this.getFromCache(this.kpiCache, cacheKey);
      if (cached) {
        this.kpiStateSignal.set({
          data: cached,
          isLoading: false,
          error: null,
        });
        return true;
      }
    }

    this.kpiStateSignal.update((state) => ({
      ...state,
      isLoading: true,
      error: null,
    }));

    const response = await lastValueFrom(
      this.api.fetchKpi(filters).pipe(
        catchError((error) => {
          this.handleFetchError('KPI', error);
          this.kpiStateSignal.update((state) => ({
            ...state,
            isLoading: false,
            error: this.extractErrorMessage(error),
          }));
          return of(null);
        })
      )
    );

    if (!response) {
      return false;
    }

    this.kpiCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + DEFAULT_TTL_MS,
    });

    this.kpiStateSignal.set({
      data: response,
      isLoading: false,
      error: null,
    });

    this.touchLastRefreshed();

    return true;
  }

  private async loadTrend(
    filters: DashboardFilters,
    options: LoadOptions = {}
  ): Promise<boolean> {
    const cacheKey = this.createCacheKey(filters);
    if (!options.force) {
      const cached = this.getFromCache(this.trendCache, cacheKey);
      if (cached) {
        this.trendStateSignal.set({
          data: cached,
          isLoading: false,
          error: null,
        });
        return true;
      }
    }

    this.trendStateSignal.update((state) => ({
      ...state,
      isLoading: true,
      error: null,
    }));

    const response = await lastValueFrom(
      this.api.fetchTrend(filters).pipe(
        catchError((error) => {
          this.handleFetchError('Trend m/m', error);
          this.trendStateSignal.update((state) => ({
            ...state,
            isLoading: false,
            error: this.extractErrorMessage(error),
          }));
          return of(null);
        })
      )
    );

    if (!response) {
      return false;
    }

    this.trendCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + DEFAULT_TTL_MS,
    });

    this.trendStateSignal.set({
      data: response,
      isLoading: false,
      error: null,
    });

    this.touchLastRefreshed();

    return true;
  }

  private async loadDaily(
    selection: MonthSelection,
    options: LoadOptions = {}
  ): Promise<boolean> {
    const filters = this.filtersSignal();
    const cacheKey = `${selection.year}-${selection.month}-${filters.customerId ?? 'all'}`;

    if (!options.force) {
      const cached = this.getFromCache(this.dailyCache, cacheKey);
      if (cached) {
        this.dailyStateSignal.set({
          data: cached,
          isLoading: false,
          error: null,
        });
        return true;
      }
    }

    this.dailyStateSignal.update((state) => ({
      ...state,
      isLoading: true,
      error: null,
    }));

    const response = await lastValueFrom(
      this.api
        .fetchDaily({
          year: selection.year,
          month: selection.month,
          customerId: filters.customerId,
        })
        .pipe(
          catchError((error) => {
            this.handleFetchError('Dane dzienne', error);
            this.dailyStateSignal.update((state) => ({
              ...state,
              isLoading: false,
              error: this.extractErrorMessage(error),
            }));
            return of(null);
          })
        )
    );

    if (!response) {
      return false;
    }

    this.dailyCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + DEFAULT_TTL_MS,
    });

    this.dailyStateSignal.set({
      data: response,
      isLoading: false,
      error: null,
    });

    return true;
  }

  private buildKpiViewModel(): KpiViewModel[] {
    const data = this.kpiStateSignal().data;
    if (!data) {
      return [
        { key: 'sumNet', label: 'Suma netto (PLN)', value: '—' },
        { key: 'ordersCount', label: 'Liczba zamówień', value: '—' },
        { key: 'avgOrder', label: 'Średnia wartość', value: '—' },
      ];
    }

    return [
      {
        key: 'sumNet',
        label: 'Suma netto (PLN)',
        value: CURRENCY_FORMATTER.format(data.sumNetPln),
        tooltip: 'Łączna wartość netto zamówień w zadanym zakresie',
      },
      {
        key: 'ordersCount',
        label: 'Liczba zamówień',
        value: INTEGER_FORMATTER.format(data.ordersCount),
        tooltip: 'Łączna liczba zamówień',
      },
      {
        key: 'avgOrder',
        label: 'Średnia wartość zamówienia',
        value: CURRENCY_FORMATTER.format(data.avgOrderValue),
        tooltip: 'Średnia wartość = suma netto / liczba zamówień',
      },
    ];
  }

  private buildTrendViewModel(): TrendPointViewModel[] {
    const data = this.trendStateSignal().data ?? [];
    const active = this.activeMonthSignal();

    return data.map((entry) => {
      const sumValue = entry.sumNetPln;
      const resolved = this.parsePeriod(entry.period);
      const isActive = Boolean(
        active &&
          resolved &&
          active.year === resolved.year &&
          active.month === resolved.month
      );

      const formattedValue =
        sumValue == null ? '—' : CURRENCY_FORMATTER.format(sumValue);

      return {
        period: entry.period,
        year: resolved?.year ?? 0,
        month: resolved?.month ?? 0,
        valuePln: sumValue,
        formattedValue,
        isActive,
      };
    });
  }

  private buildDailyViewModel(): DailyPointViewModel[] {
    const data = this.dailyStateSignal().data ?? [];

    return data.map((entry) => ({
      date: entry.date,
      day: this.getDayFromDate(entry.date),
      netPln: entry.sumNetPln,
      ordersCount: entry.ordersCount,
      formattedNet: CURRENCY_FORMATTER.format(entry.sumNetPln),
    }));
  }

  private normalizeFilters(filters: DashboardFilters): DashboardFilters {
    const dateFrom =
      this.normalizeDate(filters.dateFrom) ??
      this.filtersSignal().dateFrom ??
      this.createDefaultFilters().dateFrom;
    const dateTo =
      this.normalizeDate(filters.dateTo) ??
      this.filtersSignal().dateTo ??
      this.createDefaultFilters().dateTo;
    const customerId = this.canFilterByCustomer()
      ? this.normalizeCustomerId(filters.customerId)
      : undefined;

    if (this.compareDates(dateFrom, dateTo) > 0) {
      return { dateFrom, dateTo: dateFrom, customerId };
    }

    return { dateFrom, dateTo, customerId };
  }

  private normalizeQueryParams(
    params: ParamMap | Params
  ): { filters: DashboardFilters; activeMonth?: MonthSelection } {
    const getter = (key: string) =>
      this.isParamMap(params) ? params.get(key) : params[key];

    const defaultFilters = this.createDefaultFilters();
    const filters: DashboardFilters = {
      dateFrom:
        this.normalizeDate(getter('dateFrom')) ?? defaultFilters.dateFrom,
      dateTo: this.normalizeDate(getter('dateTo')) ?? defaultFilters.dateTo,
      customerId: this.canFilterByCustomer()
        ? this.normalizeCustomerId(getter('customerId'))
        : undefined,
    };

    const year = Number(getter('year'));
    const month = Number(getter('month'));
    const monthSelection = this.normalizeMonthSelection(year, month);

    return { filters, activeMonth: monthSelection };
  }

  private isParamMap(value: unknown): value is ParamMap {
    return Boolean(value && typeof (value as ParamMap).get === 'function');
  }

  private normalizeMonthSelection(
    year?: number,
    month?: number
  ): MonthSelection | undefined {
    if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) {
      return undefined;
    }

    if (month < 1 || month > 12) {
      return undefined;
    }

    return {
      year,
      month,
      label: MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1))),
    };
  }

  private normalizeDate(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    if (!ISO_DATE_REGEX.test(value)) {
      return undefined;
    }

    return value;
  }

  private normalizeCustomerId(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ?? undefined;
  }

  private validateFilters(filters: DashboardFilters): boolean {
    return this.compareDates(filters.dateFrom, filters.dateTo) <= 0;
  }

  private compareDates(a: string, b: string): number {
    return Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  }

  private createDefaultFilters(): DashboardFilters {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));

    return {
      dateFrom: this.formatDate(start),
      dateTo: this.formatDate(end),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private navigateWithParams(
    filters: DashboardFilters,
    month?: MonthSelection
  ): void {
    const queryParams: DashboardQueryParams = {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      customerId: this.canFilterByCustomer() ? filters.customerId : undefined,
      year: month?.year,
      month: month?.month,
    };

    Object.keys(queryParams).forEach((key) => {
      if (
        queryParams[key as keyof DashboardQueryParams] === undefined ||
        queryParams[key as keyof DashboardQueryParams] === null
      ) {
        delete queryParams[key as keyof DashboardQueryParams];
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private getFromCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string
  ): T | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private createCacheKey(filters: DashboardFilters): string {
    return JSON.stringify(filters);
  }

  private touchLastRefreshed(): void {
    this.manualRefreshStateSignal.update((state) => ({
      ...state,
      lastRefreshedAt: new Date(),
      error: null,
    }));
  }

  clearManualRefreshError(): void {
    this.manualRefreshStateSignal.update((state) => ({
      ...state,
      error: null,
    }));
  }

  private parsePeriod(
    period: string
  ): { year: number; month: number } | undefined {
    if (!period) {
      return undefined;
    }

    const [yearString, monthString] = period.split('-');
    const year = Number(yearString);
    const month = Number(monthString);

    if (!year || !month) {
      return undefined;
    }

    return { year, month };
  }

  private getDayFromDate(date: string): number {
    const parsed = new Date(`${date}T00:00:00Z`);
    return parsed.getUTCDate();
  }

  private handleFetchError(context: string, error: unknown): void {
    console.error(`[Dashboard] ${context} fetch error`, error);
    const description =
      this.extractErrorMessage(error) ??
      'Spróbuj ponownie później lub zmień zakres filtrów.';
    this.notification.error(
      `Nie udało się pobrać danych (${context})`,
      description
    );
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

      const nested = (error as { error?: { message?: string } }).error?.message;
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private areFiltersEqual(
    a: DashboardFilters,
    b: DashboardFilters
  ): boolean {
    return (
      a.dateFrom === b.dateFrom &&
      a.dateTo === b.dateTo &&
      (a.customerId ?? null) === (b.customerId ?? null)
    );
  }

  private areMonthSelectionsEqual(
    a?: MonthSelection,
    b?: MonthSelection
  ): boolean {
    if (!a && !b) {
      return true;
    }

    if (!a || !b) {
      return false;
    }

    return a.year === b.year && a.month === b.month;
  }

  private isMonthSelectionAllowed(selection: MonthSelection): boolean {
    const trend = this.trendStateSignal().data;
    if (!trend || trend.length === 0) {
      return false;
    }

    return trend.some((entry) => {
      const parsed = this.parsePeriod(entry.period);
      if (entry.sumNetPln == null) {
        return false;
      }

      return (
        parsed?.year === selection.year && parsed?.month === selection.month
      );
    });
  }
}


