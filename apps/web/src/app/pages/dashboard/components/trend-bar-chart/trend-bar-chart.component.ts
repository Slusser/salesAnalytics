import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption, ECElementEvent } from 'echarts';

import {
  MonthSelection,
  TrendPointViewModel,
} from '../../../../service/analytics/dashboard-store.types';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

const ACTIVE_BAR_COLOR = '#2563eb';
const DEFAULT_BAR_COLOR = '#cbd5f5';
const FUTURE_BAR_COLOR = '#e2e8f0';

@Component({
  selector: 'app-dashboard-trend-bar-chart',
  standalone: true,
  imports: [
    CommonModule,
    NgxEchartsDirective,
    NzButtonModule,
    NzSkeletonModule,
    EmptyStateComponent,
  ],
  templateUrl: './trend-bar-chart.component.html',
  styleUrl: './trend-bar-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendBarChartComponent {
  private readonly monthLabelFormatter = new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
  });
  private readonly currencyFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  });

  readonly data = input<TrendPointViewModel[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly hasError = input<boolean>(false);
  readonly selectedMonth = input<MonthSelection | undefined>(undefined);

  readonly monthSelect = output<MonthSelection>();
  readonly clearSelection = output<void>();
  readonly retry = output<void>();

  protected readonly hasData = computed(() => (this.data()?.length ?? 0) > 0);
  protected readonly emptyTitle = computed(() =>
    this.hasError()
      ? 'Nie udało się pobrać trendu'
      : 'Brak danych trendu'
  );
  protected readonly emptyDescription = computed(() =>
    this.hasError()
      ? 'Spróbuj ponownie odświeżyć dane lub zmień zakres filtrów.'
      : 'Brak zamówień w wybranym okresie.'
  );
  protected readonly emptyActionLabel = computed(() =>
    this.hasError() ? 'Spróbuj ponownie' : null
  );

  protected readonly chartOptions = computed<EChartsOption>(() => {
    const entries = this.data() ?? [];
    if (!entries.length) {
      return {};
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const point = Array.isArray(params) ? params[0] : params;
          const value = (point?.data?.value ?? null) as number | null;
          return `${point.name}<br/>Suma netto: ${this.formatCurrency(value)}`;
        },
      },
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: entries.map((entry) => this.formatTick(entry)),
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`,
        },
      },
      series: [
        {
          type: 'bar',
          data: entries.map((entry) => ({
            value: entry.valuePln,
            itemStyle: {
              color: this.resolveBarColor(entry),
              borderRadius: [6, 6, 0, 0],
            },
          })),
        },
      ],
    };
  });

  protected onChartClick(event: ECElementEvent): void {
    const entries = this.data() ?? [];
    if (!entries.length || !event?.name) {
      return;
    }

    const picked = entries.find((entry) => this.formatTick(entry) === event.name);
    if (!picked || picked.valuePln == null) {
      return;
    }

    this.monthSelect.emit({
      year: picked.year,
      month: picked.month,
      label: this.formatMonthLabel(picked.year, picked.month),
    });
  }

  protected onClearClick(): void {
    this.clearSelection.emit();
  }

  protected onEmptyAction(): void {
    if (!this.hasError()) {
      return;
    }
    this.retry.emit();
  }

  private formatTick(entry: TrendPointViewModel): string {
    return `${entry.year}-${String(entry.month).padStart(2, '0')}`;
  }

  private formatMonthLabel(year: number, month: number): string {
    return this.monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  }

  private resolveBarColor(entry: TrendPointViewModel): string {
    if (entry.valuePln == null) {
      return FUTURE_BAR_COLOR;
    }

    return entry.isActive ? ACTIVE_BAR_COLOR : DEFAULT_BAR_COLOR;
  }

  private formatCurrency(value: number | null): string {
    if (value == null) {
      return '—';
    }

    return this.currencyFormatter.format(value);
  }
}


