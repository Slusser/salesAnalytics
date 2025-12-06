import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

import { KpiViewModel } from '../../../../service/analytics/dashboard-store.types';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-dashboard-kpi-cards',
  standalone: true,
  imports: [
    CommonModule,
    NzCardModule,
    NzSkeletonModule,
    NzToolTipModule,
    EmptyStateComponent,
  ],
  templateUrl: './kpi-cards.component.html',
  styleUrl: './kpi-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardsComponent {
  readonly data = input.required<KpiViewModel[]>();
  readonly isLoading = input<boolean>(false);
  readonly hasError = input<boolean>(false);
  readonly showEmpty = input<boolean>(false);

  protected readonly showSkeletons = computed(
    () => this.isLoading() && (!this.data()?.length)
  );

  protected readonly cards = computed(() => this.data() ?? []);

  protected readonly shouldShowEmpty = computed(
    () => this.showEmpty() && !this.isLoading() && !this.hasError()
  );
}


