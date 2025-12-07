import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule, NzTableSortOrder } from 'ng-zorro-antd/table';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import {
  DailyPointViewModel,
  MonthSelection,
} from '../../../../service/analytics/dashboard-store.types';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

type SortKey =
  | 'day'
  | 'netPln'
  | 'grossPln'
  | 'profitPln'
  | 'avgMarginPct'
  | 'ordersCount';

@Component({
  selector: 'app-dashboard-daily-breakdown',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzTableModule,
    NzSkeletonModule,
    NgxEchartsDirective,
    EmptyStateComponent,
  ],
  templateUrl: './daily-breakdown.component.html',
  styleUrl: './daily-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyBreakdownComponent {
  readonly selectedMonth = input<MonthSelection | undefined>(undefined);
  readonly data = input<DailyPointViewModel[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly hasError = input<boolean>(false);

  readonly clear = output<void>();
  readonly retry = output<void>();

  private readonly sortState = signal<{ key: SortKey; order: NzTableSortOrder }>({
    key: 'day',
    order: 'ascend',
  });

  protected readonly hasSelection = computed(() => !!this.selectedMonth());
  protected readonly hasData = computed(() => (this.data()?.length ?? 0) > 0);

  protected readonly chartOptions = computed<EChartsOption>(() => {
    const seriesData = this.data() ?? [];
    if (!seriesData.length) {
      return {};
    }

    return {
      legend: {
        data: ['Netto', 'Marża'],
        bottom: 0,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params: any) => {
          const point = Array.isArray(params) ? params[0] : params;
          const datum = seriesData[point.dataIndex];
          return `
            ${datum.date}<br/>
            Netto: ${datum.formattedNet}<br/>
            Brutto: ${datum.formattedGross}<br/>
            Cena dystrybutora: ${datum.formattedDistributor}<br/>
            Cena kontrahenta: ${datum.formattedCustomer}<br/>
            Marża: ${datum.formattedProfit}<br/>
            Średnia marża: ${datum.formattedAvgMargin}<br/>
            Zamówienia: ${datum.ordersCount}
          `;
        },
      },
      grid: { left: 48, right: 24, top: 24, bottom: 72 },
      xAxis: {
        type: 'category',
        data: seriesData.map((point) => point.day),
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
          name: 'Netto',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 3, color: '#2563eb' },
          itemStyle: {
            color: '#2563eb',
          },
          data: seriesData.map((point) => point.netPln),
        },
        {
          name: 'Marża',
          type: 'line',
          smooth: true,
          lineStyle: { width: 2, color: '#16a34a', type: 'dashed' },
          itemStyle: { color: '#16a34a' },
          data: seriesData.map((point) => point.profitPln),
        },
      ],
    };
  });

  protected readonly sortedData = computed(() => {
    const rows = [...(this.data() ?? [])];
    const { key, order } = this.sortState();
    if (!order) {
      return rows;
    }

    return rows.sort((a, b) => {
      const first = a[key];
      const second = b[key];
      if (first === second) {
        return 0;
      }
      const factor = order === 'ascend' ? 1 : -1;
      return first > second ? factor : -factor;
    });
  });

  protected onClear(): void {
    this.clear.emit();
  }

  protected onRetry(): void {
    this.retry.emit();
  }

  protected sortOrderFor(column: SortKey): NzTableSortOrder {
    const state = this.sortState();
    return state.key === column ? state.order : null;
  }

  protected onSort(column: SortKey, order: NzTableSortOrder): void {
    this.sortState.set({
      key: column,
      order,
    });
  }
}


