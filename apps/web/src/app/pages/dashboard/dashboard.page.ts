import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { provideEcharts } from 'ngx-echarts';

import { ManualRefreshButtonComponent } from '../../shared/components/manual-refresh-button/manual-refresh-button.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  DashboardFilters,
  MonthSelection,
} from '../../service/analytics/dashboard-store.types';
import { DashboardStoreService } from '../../service/analytics/dashboard-store.service';
import { DashboardFilterBarComponent } from './components/filter-bar/dashboard-filter-bar.component';
import { CustomersService } from '../../service/customers/customers.service';
import { CustomerOption } from './dashboard.types';
import { KpiCardsComponent } from './components/kpi-cards/kpi-cards.component';
import { TrendBarChartComponent } from './components/trend-bar-chart/trend-bar-chart.component';
import { DailyBreakdownComponent } from './components/daily-breakdown/daily-breakdown.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    NzTypographyModule,
    NzCardModule,
    NzDividerModule,
    NzSpinModule,
    NzAlertModule,
    ManualRefreshButtonComponent,
    EmptyStateComponent,
    DashboardFilterBarComponent,
    KpiCardsComponent,
    TrendBarChartComponent,
    DailyBreakdownComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideEcharts()],
})
export class DashboardPageComponent {
  private readonly store = inject(DashboardStoreService);
  private readonly customersService = inject(CustomersService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly customerOptionsSignal = signal<CustomerOption[]>([]);
  private readonly customerOptionsLoadingSignal = signal<boolean>(false);

  protected readonly filters = this.store.filters;
  protected readonly kpiState = this.store.kpiState;
  protected readonly trendState = this.store.trendState;
  protected readonly dailyState = this.store.dailyState;
  protected readonly activeMonth = this.store.activeMonth;
  protected readonly manualRefreshState = this.store.manualRefreshState;
  protected readonly canFilterByCustomer = this.store.canFilterByCustomer;
  protected readonly kpiViewModel = this.store.kpiViewModel;
  protected readonly trendViewModel = this.store.trendViewModel;
  protected readonly dailyViewModel = this.store.dailyViewModel;

  protected readonly hasKpiError = computed(
    () => Boolean(this.kpiState().error)
  );
  protected readonly hasTrendError = computed(
    () => Boolean(this.trendState().error)
  );
  protected readonly hasDailyError = computed(
    () => Boolean(this.dailyState().error)
  );
  protected readonly showKpiEmpty = computed(
    () =>
      !this.kpiState().isLoading &&
      !this.hasKpiError() &&
      !this.kpiState().data
  );
  protected readonly manualRefreshError = computed(
    () => this.manualRefreshState().error ?? null
  );
  protected readonly customerOptions = this.customerOptionsSignal.asReadonly();
  protected readonly customerOptionsLoading =
    this.customerOptionsLoadingSignal.asReadonly();

  protected readonly pageTitle = 'Dashboard sprzedażowy';
  protected readonly subtitle =
    'Monitoruj KPI, trend miesięczny i dzienny rozkład sprzedaży';

  protected readonly isInitialLoading = computed(
    () =>
      this.kpiState().isLoading &&
      this.trendState().isLoading &&
      !this.kpiState().data &&
      !this.trendState().data
  );

  constructor() {
    this.registerCustomerOptionsWatcher();
  }

  protected onFiltersChange(filters: DashboardFilters): void {
    this.store.setFilters(filters);
  }

  protected onFiltersSubmit(filters: DashboardFilters): void {
    this.store.setFilters(filters);
  }

  protected onFiltersReset(): void {
    this.store.resetFilters();
  }

  protected onMonthSelect(selection: MonthSelection): void {
    this.store.selectMonth(selection);
  }

  protected onMonthClear(): void {
    this.store.clearMonth();
  }

  protected onManualRefresh(): void {
    this.store.refreshAll(true);
  }

  protected onRetryAll(): void {
    this.store.refreshAll(true);
  }

  protected onDailyRetry(): void {
    void this.store.refreshDaily(true);
  }

  protected onManualErrorDismiss(): void {
    this.store.clearManualRefreshError();
  }

  private registerCustomerOptionsWatcher(): void {
    effect(
      () => {
        const canFilter = this.canFilterByCustomer();
        if (!canFilter) {
          this.customerOptionsSignal.set([]);
          this.customerOptionsLoadingSignal.set(false);
          return;
        }

        this.loadCustomerOptions();
      },
      { allowSignalWrites: true }
    );
  }

  private loadCustomerOptions(): void {
    this.customerOptionsLoadingSignal.set(true);
    this.customersService
      .get({ limit: 1000 })
      .pipe(
        finalize(() => this.customerOptionsLoadingSignal.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (customers) => {
          const options = customers
            .filter((customer) => customer.isActive)
            .map<CustomerOption>((customer) => ({
              value: customer.id,
              label: customer.name,
            }))
            .sort((a, b) =>
              a.label.localeCompare(b.label, 'pl', { sensitivity: 'base' })
            );

          this.customerOptionsSignal.set(options);
        },
        error: () => {
          this.customerOptionsSignal.set([]);
        },
      });
  }
}


