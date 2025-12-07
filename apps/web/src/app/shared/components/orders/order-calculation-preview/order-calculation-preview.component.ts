import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';

import type { OrderCalculationResult } from '../../../../pages/orders/new/orders-new.types';
import { OrdersNewPageComponent } from '../../../../pages/orders/new/orders-new.page';

@Component({
  selector: 'app-order-calculation-preview',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzStatisticModule, NzTagModule],
  templateUrl: './order-calculation-preview.component.html',
  styleUrl: './order-calculation-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderCalculationPreviewComponent {
  readonly calculation = input.required<OrderCalculationResult | null>();

  protected readonly profitState = computed(() => {
    const calc = this.calculation() ?? OrdersNewPageComponent.EMPTY_CALCULATION;
    const profit = calc?.profitPln ?? 0;
    if (profit >= 0) {
      return { color: 'green', label: 'Marża dodatnia' };
    }

    return { color: 'volcano', label: 'Marża ujemna' };
  });
}
