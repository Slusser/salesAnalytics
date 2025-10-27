import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzIconModule } from 'ng-zorro-antd/icon';

import {
  OrdersFilterFormState,
  OrdersQueryParamsVm,
  OrdersRolePermissionsVm,
} from '../../../../service/orders/orders-list.types';
import { OrdersFilterBarComponent } from '../orders-filter-bar/orders-filter-bar.component';

@Component({
  selector: 'app-orders-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OrdersFilterBarComponent,
    NzButtonModule,
    NzSwitchModule,
    NzIconModule,
  ],
  templateUrl: './orders-toolbar.component.html',
  styleUrl: './orders-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersToolbarComponent {
  @Input({ required: true }) filters!: OrdersQueryParamsVm;
  @Input({ required: true }) loading!: boolean;
  @Input({ required: true }) permissions!: OrdersRolePermissionsVm;

  @Output() readonly filtersChange = new EventEmitter<OrdersFilterFormState>();
  @Output() readonly filtersReset = new EventEmitter<void>();
  @Output() readonly includeDeletedToggle = new EventEmitter<boolean>();

  protected readonly includeDeleted = computed(() =>
    Boolean(this.filters.includeDeleted)
  );
  protected readonly filterFormValue = computed<OrdersFilterFormState>(() => ({
    orderNo: this.filters.orderNo,
    customerId: this.filters.customerId,
    dateRange:
      this.filters.dateFrom && this.filters.dateTo
        ? [this.filters.dateFrom, this.filters.dateTo]
        : undefined,
  }));

  protected readonly includeDeletedAllowed = computed(
    () => this.permissions.canIncludeDeleted
  );

  protected onFiltersChange(partial: Partial<OrdersFilterFormState>): void {
    this.filtersChange.emit({ ...this.filterFormValue(), ...partial });
  }

  protected onReset(): void {
    this.filtersReset.emit();
  }

  protected onIncludeDeletedChange(checked: boolean): void {
    this.includeDeletedToggle.emit(checked);
  }
}
